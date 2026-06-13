import type {
  Survey,
  AnswerValue,
  AnswersMap,
  UserContext,
  SDKConfig,
  SurveyStatus,
  SubmitPayload,
  SubmitResult,
  SubmitAdapter as SubmitAdapterType,
  CompletionRate,
  QuestionStatistics,
  ResultSummary,
  RichResultSummary,
  OptionDistribution,
  TextSummary,
  RatingOverview,
  SurveyRenderer,
  RenderConfig,
  ButtonTexts,
  ValidationResult,
  SurveyEventName,
  SurveyEventMap,
  RenderContext,
  DisplayMode,
  ToolbarState,
  ToolbarSyncState,
  ToolbarSyncEventType,
  ComparisonGroup,
  SurveyComparisonResult,
  SubmissionRecord,
  GroupDimension,
  AutoGroupResult,
  TrendResult,
  KeywordChangeResult,
  WeeklyReportResult,
  MonthlyReportResult,
  VersionComparisonResult,
  AnalysisFilter,
  BusinessExportResult,
  SubmissionResultContext,
  ResultBlock,
  ResultCenterConfig,
  ResultCenterAction,
  WorkbenchConfig,
  WorkbenchAction,
  SyncContainerConfig,
  CrossContainerSyncResult,
  SyncBroadcastMessage,
} from './types';

import { EventEmitter } from './core/EventEmitter';
import { SurveyEngine } from './core/SurveyEngine';
import { ProgressStorage } from './core/ProgressStorage';
import {
  DefaultSubmitAdapter,
  SubmitAdapter,
} from './core/SubmitAdapter';
import { StatisticsCalculator } from './core/StatisticsCalculator';
import { DOMRenderer } from './renderer/DOMRenderer';
import { AnalysisCenter } from './core/AnalysisCenter';
import { ToolbarSync } from './core/ToolbarSync';
import { ResultCenter } from './core/ResultCenter';

const DEFAULT_CONFIG: Required<Pick<SDKConfig, 'autoSave' | 'autoSaveInterval' | 'storageKeyPrefix' | 'enableLogging' | 'startFromSavedProgress'>> =
  {
    autoSave: true,
    autoSaveInterval: 30000,
    storageKeyPrefix: 'survey_sdk',
    enableLogging: false,
    startFromSavedProgress: true,
  };

const DEFAULT_RENDER_CONFIG: Required<Pick<RenderConfig, 'showProgress' | 'showQuestionIndex' | 'theme' | 'displayMode'>> =
  {
    showProgress: true,
    showQuestionIndex: true,
    theme: 'light',
    displayMode: 'single',
  };

type EventCallback<K extends SurveyEventName> = (
  payload: SurveyEventMap[K]
) => void;

export class SurveySDK {
  private emitter: EventEmitter;
  private engine: SurveyEngine;
  private storage: ProgressStorage;
  private submitAdapter: SubmitAdapterType;
  private renderer: SurveyRenderer | null = null;
  private container: HTMLElement | null = null;

  private config: SDKConfig;
  private renderConfig: RenderConfig & {
    buttonTexts: ButtonTexts;
    showProgress: boolean;
    showQuestionIndex: boolean;
    theme: 'light' | 'dark' | 'auto';
    displayMode: DisplayMode;
  };
  private logger: (msg: string, ...args: unknown[]) => void;

  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private lastSubmittedResult: SubmitResult | null = null;
  private lastRichSummary: RichResultSummary | null = null;
  private pendingInvalidQuestionIds: string[] = [];
  private pendingHighlightId: string | null = null;
  private analysisCenter: AnalysisCenter;
  private toolbarSync: ToolbarSync;
  private resultCenter: ResultCenter;
  private isSubmitting: boolean = false;

  constructor(survey: Survey, config?: SDKConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.renderConfig = {
      ...DEFAULT_RENDER_CONFIG,
      ...(this.config.renderConfig || {}),
      buttonTexts: this.config.renderConfig?.buttonTexts || {},
      displayMode: this.config.renderConfig?.displayMode || 'single',
    };

    this.emitter = new EventEmitter();
    this.engine = new SurveyEngine(survey);
    this.storage = new ProgressStorage(this.config.storageKeyPrefix);
    this.submitAdapter = new DefaultSubmitAdapter(this.config.submitUrl);

    this.logger = this.config.enableLogging
      ? (msg, ...args) => console.log(`[SurveySDK] ${msg}`, ...args)
      : () => {};

    this.analysisCenter = new AnalysisCenter();
    this.toolbarSync = new ToolbarSync();
    this.resultCenter = new ResultCenter(this.config.renderConfig?.successPageConfig as Partial<ResultCenterConfig> | undefined);

    this.engine.onUpdate(() => {
      this.renderIfMounted();
      this.syncToolbarState('stateChange');
    });

    this.engine.setDisplayMode(this.renderConfig.displayMode);

    if (this.config.startFromSavedProgress) {
      this.tryLoadDraft();
    }
  }

  static create(survey: Survey, config?: SDKConfig): SurveySDK {
    return new SurveySDK(survey, config);
  }

  static compareSummaries(
    groups: ComparisonGroup[]
  ): SurveyComparisonResult {
    return StatisticsCalculator.compareSummaries(groups);
  }

  setSubmitAdapter(adapter: SubmitAdapterType): void {
    this.submitAdapter = adapter;
  }

  setCustomRenderer(renderer: SurveyRenderer): void {
    this.renderer = renderer;
  }

  setButtonTexts(texts: ButtonTexts): void {
    this.renderConfig.buttonTexts = {
      ...this.renderConfig.buttonTexts,
      ...texts,
    };
    this.renderIfMounted();
  }

  setDisplayMode(mode: DisplayMode): void {
    const prev = this.engine.getDisplayMode();
    if (prev === mode) return;
    this.engine.setDisplayMode(mode);
    this.renderConfig.displayMode = mode;
    this.emit('displayModeChange', { from: prev, to: mode });
    this.syncToolbarState('modeChange');
    this.logger(`显示模式切换: ${prev} -> ${mode}`);
    this.renderIfMounted();
  }

  getDisplayMode(): DisplayMode {
    return this.engine.getDisplayMode();
  }

  toggleDisplayMode(): DisplayMode {
    const next: DisplayMode = this.engine.getDisplayMode() === 'single' ? 'all' : 'single';
    this.setDisplayMode(next);
    return next;
  }

  mount(container: HTMLElement | string): void {
    const el =
      typeof container === 'string'
        ? document.querySelector<HTMLElement>(container)
        : container;

    if (!el) {
      throw new Error('[SurveySDK] 未找到渲染容器元素');
    }

    this.container = el;

    if (!this.renderer) {
      const domRenderer = new DOMRenderer(this.renderConfig);
      domRenderer.setDisplayMode(this.renderConfig.displayMode);
      this.renderer = domRenderer;
    }

    this.renderer.mount(el);
    this.logger('SDK 挂载成功');

    this.startAutoSave();

    if (this.engine.getStatus() === 'not_started') {
      this.emit('start', {
        surveyId: this.engine.getSurvey().meta.id,
        user: this.engine.getUser(),
      });
    }

    this.render();
  }

  unmount(): void {
    this.stopAutoSave();
    if (this.renderer) {
      this.renderer.unmount();
    }
    this.container = null;
    this.logger('SDK 已卸载');
  }

  destroy(): void {
    this.unmount();
    this.emitter.removeAllListeners();
    this.analysisCenter.clear();
    this.toolbarSync.destroy();
    this.resultCenter.destroy();
  }

  setUser(user: UserContext): void {
    this.engine.setUser(user);
    if (this.config.startFromSavedProgress) {
      this.tryLoadDraft();
    }
    this.renderIfMounted();
  }

  getUser(): UserContext | null {
    return this.engine.getUser();
  }

  setAnswer(questionId: string, value: AnswerValue): void {
    const prevIndex = this.engine.getCurrentIndex();
    this.engine.setAnswer(questionId, value);

    this.emit('questionAnswer', {
      questionId,
      value,
      answers: this.engine.getAnswers(),
    });

    this.syncToolbarState('answerUpdate');

    const newIndex = this.engine.getCurrentIndex();
    if (prevIndex !== newIndex) {
      const q = this.engine.getCurrentQuestion();
      this.emit('questionChange', {
        fromIndex: prevIndex,
        toIndex: newIndex,
        questionId: q?.id || '',
      });
    }

    this.clearInvalidAndHighlight();
    this.renderIfMounted();
  }

  getAnswer(questionId: string) {
    return this.engine.getAnswer(questionId);
  }

  getAnswers(): AnswersMap {
    return this.engine.getAnswers();
  }

  setAnswers(answers: AnswersMap): void {
    this.engine.setAnswers(answers);
    this.renderIfMounted();
  }

  next(): boolean {
    const current = this.engine.getCurrentQuestion();
    if (current) {
      const validation = this.engine.validateCurrent();
      if (!validation.valid) {
        this.emit('validateError', {
          questionId: validation.questionId || current.id,
          errorMessage: validation.errorMessage || '校验失败',
          invalidQuestionIds: validation.invalidQuestionIds,
        });
        this.showErrorToUser(validation.errorMessage);
        return false;
      }
    }

    const prevIndex = this.engine.getCurrentIndex();
    const success = this.engine.next();
    if (success) {
      const q = this.engine.getCurrentQuestion();
      this.emit('questionChange', {
        fromIndex: prevIndex,
        toIndex: this.engine.getCurrentIndex(),
        questionId: q?.id || '',
      });
    }
    this.renderIfMounted();
    return success;
  }

  prev(): boolean {
    const prevIndex = this.engine.getCurrentIndex();
    const success = this.engine.prev();
    if (success) {
      const q = this.engine.getCurrentQuestion();
      this.emit('questionChange', {
        fromIndex: prevIndex,
        toIndex: this.engine.getCurrentIndex(),
        questionId: q?.id || '',
      });
    }
    this.renderIfMounted();
    return success;
  }

  goToQuestion(questionId: string): boolean {
    const prevIndex = this.engine.getCurrentIndex();
    const success = this.engine.goToQuestion(questionId);
    if (success) {
      this.emit('questionChange', {
        fromIndex: prevIndex,
        toIndex: this.engine.getCurrentIndex(),
        questionId,
      });
      this.setHighlightQuestionId(questionId);
    }
    this.renderIfMounted();
    return success;
  }

  jumpAndHighlight(questionId: string): boolean {
    const ok = this.goToQuestion(questionId);
    if (ok) {
      this.setHighlightQuestionId(questionId);
    }
    return ok;
  }

  setHighlightQuestionId(questionId: string | null): void {
    this.pendingHighlightId = questionId;
    if (this.renderer && this.renderer instanceof DOMRenderer) {
      this.renderer.setHighlightQuestionId(questionId);
    }
    if (questionId) {
      setTimeout(() => {
        this.pendingHighlightId = null;
        if (this.renderer && this.renderer instanceof DOMRenderer) {
          this.renderer.setHighlightQuestionId(null);
        }
        this.renderIfMounted();
      }, 2500);
    }
  }

  validateQuestion(questionId: string): ValidationResult {
    return this.engine.validateQuestion(questionId);
  }

  validateAll(): ValidationResult {
    const result = this.engine.validateAll();
    if (!result.valid && result.invalidQuestionIds) {
      this.pendingInvalidQuestionIds = result.invalidQuestionIds;
      if (this.renderer && this.renderer instanceof DOMRenderer) {
        this.renderer.setInvalidQuestionIds(result.invalidQuestionIds);
      }
      this.syncToolbarState('validationUpdate');
    }
    return result;
  }

  listInvalidQuestions(): string[] {
    const ids = this.engine.listInvalidQuestions();
    this.pendingInvalidQuestionIds = ids;
    if (this.renderer && this.renderer instanceof DOMRenderer) {
      this.renderer.setInvalidQuestionIds(ids);
    }
    return ids;
  }

  clearInvalidAndHighlight(): void {
    this.pendingInvalidQuestionIds = [];
    this.pendingHighlightId = null;
    if (this.renderer && this.renderer instanceof DOMRenderer) {
      this.renderer.setInvalidQuestionIds([]);
      this.renderer.setHighlightQuestionId(null);
    }
  }

  async saveDraft(): Promise<boolean> {
    const progress = this.engine.getProgress();
    const meta = this.storage.saveAndReturnMeta(progress);
    if (meta.success) {
      this.engine.setStatus('draft_saved');
      const updatedProgress = this.engine.getProgress();
      const updatedRate = this.getCompletionRate();
      this.emit('draftSaved', {
        progress: updatedProgress,
        storageKey: meta.key,
        answeredCount: updatedRate.answeredQuestions,
        totalCount: updatedRate.totalQuestions,
        completionRate: updatedRate.rate,
        status: 'draft_saved',
      });
      this.syncToolbarState('draftSave');
      this.logger(
        `草稿保存成功 | ${updatedRate.answeredQuestions}/${updatedRate.totalQuestions}题 | ${Math.round(
          updatedRate.rate * 100
        )}% | key=${meta.key}`
      );
    } else {
      this.logger('草稿保存失败');
    }
    this.renderIfMounted();
    return meta.success;
  }

  loadDraft(): boolean {
    const meta = this.storage.loadAndReturnMeta(
      this.engine.getSurvey().meta.id,
      this.engine.getUser()
    );
    if (meta.progress) {
      this.engine.loadProgress(meta.progress);

      const mode = this.engine.getDisplayMode();
      if (mode && this.renderer && this.renderer instanceof DOMRenderer) {
        this.renderer.setDisplayMode(mode);
      }

      this.emit('draftLoaded', {
        progress: meta.progress,
        storageKey: meta.key,
        answeredCount: meta.answeredCount,
        totalCount: meta.totalCount,
        completionRate: meta.completionRate,
        status: meta.status,
        resumedFromIndex: meta.resumedFromIndex,
      });
      this.logger(
        `草稿加载成功 | 恢复到第${meta.resumedFromIndex + 1}题 | ${meta.answeredCount}/${meta.totalCount}题`
      );
      this.renderIfMounted();
      return true;
    }
    return false;
  }

  clearDraft(): boolean {
    const ok = this.storage.clear(
      this.engine.getSurvey().meta.id,
      this.engine.getUser()
    );
    if (ok) this.logger('草稿已清除');
    return ok;
  }

  hasDraft(): boolean {
    return this.storage.exists(
      this.engine.getSurvey().meta.id,
      this.engine.getUser()
    );
  }

  getDraftStorageKey(): string {
    return this.storage.getStorageKey(
      this.engine.getSurvey().meta.id,
      this.engine.getUser()
    );
  }

  async submit(): Promise<SubmitResult> {
    const validation = this.validateAll();
    if (!validation.valid) {
      this.emit('validateError', {
        questionId: validation.questionId || '',
        errorMessage:
          validation.errorMessage ||
          `存在 ${validation.invalidQuestionIds?.length || 1} 道必填题未完成`,
        invalidQuestionIds: validation.invalidQuestionIds,
      });
      this.showErrorToUser(
        validation.errorMessage || '存在必填项未填写，请查看红色标记'
      );
      if (validation.questionId) {
        this.jumpAndHighlight(validation.questionId);
      }
      throw new Error(validation.errorMessage || '校验失败');
    }

    const user = this.engine.getUser();
    if (!user) {
      this.showErrorToUser('缺少用户标识');
      throw new Error('[SurveySDK] 提交前必须设置用户标识 (setUser)');
    }

    const survey = this.engine.getSurvey();
    const durationMs = this.engine.getDuration();
    const payload: SubmitPayload = {
      surveyId: survey.meta.id,
      surveyVersion: survey.meta.version,
      user,
      answers: this.engine.getAnswers(),
      submittedAt: Date.now(),
      duration: durationMs,
    };

    this.emit('submit', { payload });
    this.setSubmittingState(true);
    this.isSubmitting = true;
    this.syncToolbarState('submitStart');

    try {
      const result = await this.submitAdapter.submit(payload);

      const richSummary = StatisticsCalculator.generateRichResultSummary(
        survey,
        this.engine.getQuestions(),
        this.engine.getAnswers(),
        user,
        durationMs
      );
      this.lastRichSummary = richSummary;

      const enrichedResult: SubmitResult = {
        ...result,
        summary: richSummary,
      };
      this.lastSubmittedResult = enrichedResult;

      if (result.success) {
        this.engine.setStatus('submitted');
        this.clearDraft();
        this.stopAutoSave();
        this.clearInvalidAndHighlight();

        const allStats = StatisticsCalculator.getAllStatistics(
          survey,
          this.engine.getQuestions(),
          this.engine.getAnswers()
        );

        this.resultCenter.buildContext({
          result: enrichedResult,
          summary: richSummary,
          surveyId: survey.meta.id,
          surveyTitle: survey.meta.title,
          surveyVersion: survey.meta.version,
          user: this.engine.getUser(),
          answers: this.engine.getAnswers(),
          durationSeconds: richSummary.durationSeconds,
        });

        this.resultCenter.getContextFor('completionPage');
        this.resultCenter.getContextFor('detailDrawer');
        this.resultCenter.getContextFor('listCard');

        this.isSubmitting = false;
        this.syncToolbarState('submitComplete', {
          lastSubmitResult: enrichedResult,
          lastRichSummary: richSummary,
        });

        this.emit('submitSuccess', { result: enrichedResult, summary: richSummary });
        this.emit('complete', {
          answers: this.engine.getAnswers(),
          summary: richSummary,
          result: enrichedResult,
          statistics: allStats,
        });
        this.logger(
          `问卷提交成功 | submissionId=${result.submissionId} | 完成率=${Math.round(
            richSummary.completionRate * 100
          )}%`
        );
      } else {
        this.engine.setStatus('error');
        this.emit('submitError', {
          error: new Error(result.message || '提交失败'),
        });
        this.showErrorToUser(result.message || '提交失败');
        this.logger('问卷提交失败', result);
      }

      return enrichedResult;
    } catch (e) {
      const error = e as Error;
      this.engine.setStatus('error');
      this.emit('submitError', { error });
      this.showErrorToUser(error.message || '网络错误，请稍后重试');
      this.logger('提交异常', error);
      throw error;
    } finally {
      this.isSubmitting = false;
      this.setSubmittingState(false);
    }
  }

  restart(): void {
    this.engine.reset();
    this.clearDraft();
    this.lastSubmittedResult = null;
    this.lastRichSummary = null;
    this.clearInvalidAndHighlight();

    this.emit('restart', {
      surveyId: this.engine.getSurvey().meta.id,
    });
    this.emit('start', {
      surveyId: this.engine.getSurvey().meta.id,
      user: this.engine.getUser(),
    });
    this.startAutoSave();
    this.renderIfMounted();
  }

  getStatus(): SurveyStatus {
    return this.engine.getStatus();
  }

  getToolbarState(): ToolbarState {
    const rate = this.getCompletionRate();
    const invalidIds = this.listInvalidQuestions();
    const progress = this.engine.getProgress();
    return {
      surveyId: this.engine.getSurvey().meta.id,
      status: this.engine.getStatus(),
      displayMode: this.engine.getDisplayMode(),
      currentQuestionIndex: this.engine.getCurrentIndex(),
      totalQuestions: rate.totalQuestions,
      completionRate: rate.rate,
      answeredCount: rate.answeredQuestions,
      requiredTotal: rate.requiredTotal,
      requiredAnswered: rate.requiredAnswered,
      requiredUnansweredCount: rate.requiredTotal - rate.requiredAnswered,
      invalidQuestionIds: invalidIds,
      draftSavedAt: progress.lastSavedAt,
    };
  }

  getCurrentQuestionIndex(): number {
    return this.engine.getCurrentIndex();
  }

  getTotalQuestions(): number {
    return this.engine.getTotalQuestions();
  }

  getCompletionRate(): CompletionRate {
    return StatisticsCalculator.getCompletionRate(
      this.engine.getSurvey(),
      this.engine.getQuestions(),
      this.engine.getAnswers()
    );
  }

  getQuestionAverageScore(questionId: string): number | null {
    const question = this.engine
      .getQuestions()
      .find((q) => q.id === questionId);
    if (!question) return null;
    return StatisticsCalculator.getQuestionAverageScore(
      question,
      this.engine.getAnswers()
    );
  }

  getAverageScore(): {
    average: number;
    total: number;
    max: number;
    count: number;
  } {
    return StatisticsCalculator.getAverageScore(
      this.engine.getQuestions(),
      this.engine.getAnswers()
    );
  }

  getQuestionStatistics(questionId: string): QuestionStatistics | null {
    const question = this.engine
      .getQuestions()
      .find((q) => q.id === questionId);
    if (!question) return null;
    return StatisticsCalculator.getQuestionStatistics(
      question,
      this.engine.getAnswers()
    );
  }

  getAllStatistics(): QuestionStatistics[] {
    return StatisticsCalculator.getAllStatistics(
      this.engine.getSurvey(),
      this.engine.getQuestions(),
      this.engine.getAnswers()
    );
  }

  getOptionDistributions(): OptionDistribution[] {
    return StatisticsCalculator.getOptionDistributions(
      this.engine.getSurvey(),
      this.engine.getQuestions(),
      this.engine.getAnswers()
    );
  }

  getTextSummaries(): TextSummary[] {
    return StatisticsCalculator.getTextSummaries(
      this.engine.getSurvey(),
      this.engine.getQuestions(),
      this.engine.getAnswers()
    );
  }

  getRatingOverview(): RatingOverview {
    return StatisticsCalculator.getRatingOverview(
      this.engine.getQuestions(),
      this.engine.getAnswers()
    );
  }

  getResultSummary(): ResultSummary {
    return StatisticsCalculator.generateResultSummary(
      this.engine.getSurvey(),
      this.engine.getQuestions(),
      this.engine.getAnswers(),
      this.engine.getDuration()
    );
  }

  getRichResultSummary(): RichResultSummary {
    return StatisticsCalculator.generateRichResultSummary(
      this.engine.getSurvey(),
      this.engine.getQuestions(),
      this.engine.getAnswers(),
      this.engine.getUser(),
      this.engine.getDuration()
    );
  }

  getLastSubmitResult(): SubmitResult | null {
    return this.lastSubmittedResult;
  }

  getLastRichSummary(): RichResultSummary | null {
    return this.lastRichSummary;
  }

  getAnalysisCenter(): AnalysisCenter {
    return this.analysisCenter;
  }

  getToolbarSync(): ToolbarSync {
    return this.toolbarSync;
  }

  getResultCenter(): ResultCenter {
    return this.resultCenter;
  }

  subscribeToolbar(
    callback: (state: ToolbarSyncState, event: ToolbarSyncEventType) => void,
    events?: ToolbarSyncEventType[]
  ): () => void {
    return this.toolbarSync.subscribe(callback, events);
  }

  ingestSubmissionRecords(records: SubmissionRecord[]): void {
    this.analysisCenter.ingest(records);
  }

  autoGroupSubmissions(dimension: GroupDimension, customKey?: (r: SubmissionRecord) => string): AutoGroupResult {
    return this.analysisCenter.autoGroup(dimension, customKey);
  }

  getAggregatedSummary(dimension: GroupDimension, customKey?: (r: SubmissionRecord) => string) {
    return this.analysisCenter.getAggregatedSummary(dimension, customKey);
  }

  getSubmissionTrends(metric: 'completionRate' | 'averageScore' | 'weightedAverage' | 'nps', dimension?: 'week' | 'month'): TrendResult[] {
    return this.analysisCenter.getTrends(metric, dimension);
  }

  getKeywordChanges(dimension?: 'week' | 'month'): KeywordChangeResult[] {
    return this.analysisCenter.getKeywordChanges(dimension);
  }

  generateWeeklyReport(startDate?: string, endDate?: string): WeeklyReportResult {
    return this.analysisCenter.generateWeeklyReport(startDate, endDate);
  }

  getSubmissionResultContext(source: 'completionPage' | 'detailDrawer' | 'listCard'): SubmissionResultContext | null {
    return this.resultCenter.getContextFor(source);
  }

  getResultCenterVisibleBlocks(): ResultBlock[] {
    return this.resultCenter.getVisibleBlocks();
  }

  getResultCenterActions(): ResultCenterAction[] {
    return this.resultCenter.getSecondaryActions();
  }

  configureResultCenter(config: Partial<ResultCenterConfig>): void {
    this.resultCenter.updateConfig(config);
  }

  verifyResultConsistency(): boolean {
    return this.resultCenter.verifyConsistency();
  }

  generateMonthlyReport(year?: number, month?: number): MonthlyReportResult {
    return this.analysisCenter.generateMonthlyReport(year, month);
  }

  compareVersions(versions?: string[]): VersionComparisonResult {
    return this.analysisCenter.compareVersions(versions);
  }

  getFilteredAnalysis(filter: AnalysisFilter) {
    return this.analysisCenter.getDashboards(filter);
  }

  applyAnalysisFilter(filter: AnalysisFilter): SubmissionRecord[] {
    return this.analysisCenter.applyFilter(filter);
  }

  exportBusinessReport(
    filter: AnalysisFilter,
    exportedBy: string = 'SurveySDK'
  ): BusinessExportResult {
    return this.analysisCenter.exportBusinessReport(filter, exportedBy);
  }

  setResultWorkbench(config: WorkbenchConfig): void {
    this.resultCenter.setWorkbench(config);
  }

  clearResultWorkbench(): void {
    this.resultCenter.clearWorkbench();
  }

  getWorkbenchActions(): WorkbenchAction[] {
    return this.resultCenter.getVisibleWorkbenchActions();
  }

  async runWorkbenchAction(actionId: string, options?: Record<string, unknown>): Promise<boolean> {
    return this.resultCenter.runWorkbenchAction(actionId, options);
  }

  registerSyncContainer(config: SyncContainerConfig): () => void {
    return this.toolbarSync.registerContainer(config);
  }

  unregisterSyncContainer(containerId: string): void {
    this.toolbarSync.unregisterContainer(containerId);
  }

  getRegisteredContainers(): string[] {
    return this.toolbarSync.getRegisteredContainers();
  }

  broadcastSyncMessage(
    sourceContainerId: string,
    event: ToolbarSyncEventType,
    overrides?: Partial<ToolbarState>
  ): boolean {
    const ok = this.toolbarSync.broadcast(sourceContainerId, event, overrides);
    if (ok && overrides && this.engine) {
      if (overrides.currentQuestionIndex !== undefined && this.engine.getStatus() !== 'submitted') {
        this.engine.setCurrentIndex(overrides.currentQuestionIndex);
      }
      if (overrides.displayMode !== undefined) {
        this.setDisplayMode(overrides.displayMode);
      }
    }
    return ok;
  }

  getSyncBroadcastHistory(limit: number = 20): SyncBroadcastMessage[] {
    return this.toolbarSync.getBroadcastHistory(limit);
  }

  getCrossContainerSyncResult(): CrossContainerSyncResult {
    return this.toolbarSync.getCrossContainerSyncResult();
  }

  on<K extends SurveyEventName>(
    eventName: K,
    callback: EventCallback<K>
  ): () => void {
    return this.emitter.on(eventName, callback);
  }

  off<K extends SurveyEventName>(
    eventName: K,
    callback: EventCallback<K>
  ): void {
    this.emitter.off(eventName, callback);
  }

  once<K extends SurveyEventName>(
    eventName: K,
    callback: EventCallback<K>
  ): () => void {
    return this.emitter.once(eventName, callback);
  }

  private emit<K extends SurveyEventName>(
    eventName: K,
    payload: SurveyEventMap[K]
  ): void {
    this.emitter.emit(eventName, payload);
  }

  private tryLoadDraft(): void {
    if (this.engine.getStatus() === 'not_started') {
      this.loadDraft();
    }
  }

  private startAutoSave(): void {
    if (!this.config.autoSave) return;
    this.stopAutoSave();
    this.autoSaveTimer = setInterval(() => {
      if (this.engine.getStatus() !== 'submitted') {
        this.saveDraft().catch(() => {});
      }
    }, this.config.autoSaveInterval || 30000);
  }

  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  private renderIfMounted(): void {
    if (this.container && this.renderer) {
      this.render();
    }
  }

  private render(): void {
    if (!this.renderer || !this.container) return;

    const completionRate = this.getCompletionRate();
    const status = this.engine.getStatus();
    const context: RenderContext = {
      survey: this.engine.getSurvey(),
      questions: this.engine.getQuestions(),
      currentQuestionIndex: this.engine.getCurrentIndex(),
      totalQuestions: this.engine.getTotalQuestions(),
      isFirstQuestion: this.engine.isFirstQuestion(),
      isLastQuestion: this.engine.isLastQuestion(),
      answers: this.engine.getAnswers(),
      completionRate,
      buttonTexts: this.renderConfig.buttonTexts,
      showProgress: this.renderConfig.showProgress,
      showQuestionIndex: this.renderConfig.showQuestionIndex,
      status,
      displayMode: this.engine.getDisplayMode(),
      invalidQuestionIds:
        this.pendingInvalidQuestionIds.length > 0
          ? this.pendingInvalidQuestionIds
          : undefined,
      highlightQuestionId: this.pendingHighlightId || undefined,
      submissionId: this.lastSubmittedResult?.submissionId,
      durationSeconds: this.lastSubmittedResult?.summary?.durationSeconds,
    };

    this.renderer.render(context, {
      onAnswer: (qid, val) => this.setAnswer(qid, val),
      onPrev: () => this.prev(),
      onNext: () => this.next(),
      onSubmit: () => this.submit().catch(() => {}),
      onSaveDraft: () => this.saveDraft().catch(() => {}),
      onRestart: () => this.restart(),
      onClose: () => this.handleClose(),
      onSetMode: (mode: DisplayMode) => this.setDisplayMode(mode),
      onToggleMode: () => this.toggleDisplayMode(),
      onJumpToQuestion: (qid) => this.jumpAndHighlight(qid),
    });
  }

  private handleClose(): void {
    this.emit('close', {});
    this.logger('用户点击关闭按钮');
  }

  private showErrorToUser(message: string | undefined): void {
    if (!this.renderer || !this.container) return;
    if (this.renderer instanceof DOMRenderer) {
      this.renderer.setError(message || null);
      this.render();
      setTimeout(() => {
        if (this.renderer instanceof DOMRenderer) {
          this.renderer.setError(null);
          this.render();
        }
      }, 5000);
    }
  }

  private setSubmittingState(value: boolean): void {
    if (!this.renderer || !this.container) return;
    if (this.renderer instanceof DOMRenderer) {
      this.renderer.setSubmitting(value);
      this.render();
    }
  }

  private syncToolbarState(
    event: ToolbarSyncEventType,
    extras?: {
      lastSubmitResult?: SubmitResult | null;
      lastRichSummary?: RichResultSummary | null;
    }
  ): void {
    const toolbarState = this.getToolbarState();
    this.toolbarSync.updateFromToolbarState(toolbarState, event, {
      isSubmitting: this.isSubmitting,
      lastSubmitResult: extras?.lastSubmitResult ?? this.lastSubmittedResult,
      lastRichSummary: extras?.lastRichSummary ?? this.lastRichSummary,
    });
  }
}
