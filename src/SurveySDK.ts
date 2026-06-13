import type {
  Survey,
  AnswerValue,
  AnswersMap,
  UserContext,
  SDKConfig,
  SurveyStatus,
  SubmitPayload,
  SubmitResult,
  CompletionRate,
  QuestionStatistics,
  ResultSummary,
  SurveyRenderer,
  RenderConfig,
  ButtonTexts,
  ValidationResult,
  SurveyEventName,
  SurveyEventMap,
  RenderContext,
} from './types';

import type { SubmitAdapter as SubmitAdapterType } from './core/SubmitAdapter';

import { EventEmitter } from './core/EventEmitter';
import { SurveyEngine } from './core/SurveyEngine';
import { ProgressStorage } from './core/ProgressStorage';
import {
  DefaultSubmitAdapter,
  SubmitAdapter,
} from './core/SubmitAdapter';
import { StatisticsCalculator } from './core/StatisticsCalculator';
import { DOMRenderer } from './renderer/DOMRenderer';

const DEFAULT_CONFIG: Required<Pick<SDKConfig, 'autoSave' | 'autoSaveInterval' | 'storageKeyPrefix' | 'enableLogging' | 'startFromSavedProgress'>> =
  {
    autoSave: true,
    autoSaveInterval: 30000,
    storageKeyPrefix: 'survey_sdk',
    enableLogging: false,
    startFromSavedProgress: true,
  };

const DEFAULT_RENDER_CONFIG: Required<Pick<RenderConfig, 'showProgress' | 'showQuestionIndex' | 'theme'>> =
  {
    showProgress: true,
    showQuestionIndex: true,
    theme: 'light',
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
  };
  private logger: (msg: string, ...args: unknown[]) => void;

  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  private lastSubmittedResult: SubmitResult | null = null;

  constructor(survey: Survey, config?: SDKConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.renderConfig = {
      ...DEFAULT_RENDER_CONFIG,
      ...(this.config.renderConfig || {}),
      buttonTexts: this.config.renderConfig?.buttonTexts || {},
    };

    this.emitter = new EventEmitter();
    this.engine = new SurveyEngine(survey);
    this.storage = new ProgressStorage(this.config.storageKeyPrefix);
    this.submitAdapter = new DefaultSubmitAdapter(this.config.submitUrl);

    this.logger = this.config.enableLogging
      ? (msg, ...args) => console.log(`[SurveySDK] ${msg}`, ...args)
      : () => {};

    this.engine.onUpdate(() => {
      this.renderIfMounted();
    });

    if (this.config.startFromSavedProgress) {
      this.tryLoadDraft();
    }
  }

  static create(survey: Survey, config?: SDKConfig): SurveySDK {
    return new SurveySDK(survey, config);
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
      this.renderer = new DOMRenderer(this.renderConfig);
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

    const newIndex = this.engine.getCurrentIndex();
    if (prevIndex !== newIndex) {
      const q = this.engine.getCurrentQuestion();
      this.emit('questionChange', {
        fromIndex: prevIndex,
        toIndex: newIndex,
        questionId: q?.id || '',
      });
    }

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
    }
    this.renderIfMounted();
    return success;
  }

  validateQuestion(questionId: string): ValidationResult {
    return this.engine.validateQuestion(questionId);
  }

  validateAll(): ValidationResult {
    return this.engine.validateAll();
  }

  async saveDraft(): Promise<boolean> {
    const progress = this.engine.getProgress();
    const success = this.storage.save(progress);
    if (success) {
      this.engine.setStatus('draft_saved');
      this.emit('draftSaved', { progress });
      this.logger('草稿保存成功');
    } else {
      this.logger('草稿保存失败');
    }
    this.renderIfMounted();
    return success;
  }

  loadDraft(): boolean {
    const survey = this.engine.getSurvey();
    const user = this.engine.getUser();
    const progress = this.storage.load(survey.meta.id, user);
    if (progress) {
      this.engine.loadProgress(progress);
      this.emit('draftLoaded', { progress });
      this.logger('草稿加载成功');
      this.renderIfMounted();
      return true;
    }
    return false;
  }

  clearDraft(): boolean {
    const survey = this.engine.getSurvey();
    const user = this.engine.getUser();
    return this.storage.clear(survey.meta.id, user);
  }

  hasDraft(): boolean {
    const survey = this.engine.getSurvey();
    const user = this.engine.getUser();
    return this.storage.exists(survey.meta.id, user);
  }

  async submit(): Promise<SubmitResult> {
    const validation = this.engine.validateAll();
    if (!validation.valid) {
      this.emit('validateError', {
        questionId: validation.questionId || '',
        errorMessage: validation.errorMessage || '存在未完成的必填项',
      });
      this.showErrorToUser(validation.errorMessage);
      if (validation.questionId) {
        this.goToQuestion(validation.questionId);
      }
      throw new Error(validation.errorMessage || '校验失败');
    }

    const user = this.engine.getUser();
    if (!user) {
      this.showErrorToUser('缺少用户标识');
      throw new Error('[SurveySDK] 提交前必须设置用户标识 (setUser)');
    }

    const survey = this.engine.getSurvey();
    const payload: SubmitPayload = {
      surveyId: survey.meta.id,
      surveyVersion: survey.meta.version,
      user,
      answers: this.engine.getAnswers(),
      submittedAt: Date.now(),
      duration: this.engine.getDuration(),
    };

    this.emit('submit', { payload });
    this.setSubmittingState(true);

    try {
      const result = await this.submitAdapter.submit(payload);
      this.lastSubmittedResult = result;

      if (result.success) {
        this.engine.setStatus('submitted');
        this.clearDraft();
        this.stopAutoSave();

        const summary = this.getResultSummary();
        this.emit('submitSuccess', { result });
        this.emit('complete', {
          answers: this.engine.getAnswers(),
          summary,
          result,
        });
        this.logger('问卷提交成功', result);
      } else {
        this.engine.setStatus('error');
        this.emit('submitError', {
          error: new Error(result.message || '提交失败'),
        });
        this.showErrorToUser(result.message || '提交失败');
        this.logger('问卷提交失败', result);
      }

      return result;
    } catch (e) {
      const error = e as Error;
      this.engine.setStatus('error');
      this.emit('submitError', { error });
      this.showErrorToUser(error.message || '网络错误，请稍后重试');
      this.logger('提交异常', error);
      throw error;
    } finally {
      this.setSubmittingState(false);
    }
  }

  restart(): void {
    this.engine.reset();
    this.clearDraft();
    this.lastSubmittedResult = null;
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

  getResultSummary(): ResultSummary {
    return StatisticsCalculator.generateResultSummary(
      this.engine.getSurvey(),
      this.engine.getQuestions(),
      this.engine.getAnswers()
    );
  }

  getLastSubmitResult(): SubmitResult | null {
    return this.lastSubmittedResult;
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

    const context: RenderContext = {
      survey: this.engine.getSurvey(),
      questions: this.engine.getQuestions(),
      currentQuestionIndex: this.engine.getCurrentIndex(),
      totalQuestions: this.engine.getTotalQuestions(),
      isFirstQuestion: this.engine.isFirstQuestion(),
      isLastQuestion: this.engine.isLastQuestion(),
      answers: this.engine.getAnswers(),
      completionRate: this.getCompletionRate(),
      buttonTexts: this.renderConfig.buttonTexts,
      showProgress: this.renderConfig.showProgress,
      showQuestionIndex: this.renderConfig.showQuestionIndex,
      status: this.engine.getStatus(),
    };

    this.renderer.render(context, {
      onAnswer: (qid, val) => this.setAnswer(qid, val),
      onPrev: () => this.prev(),
      onNext: () => this.next(),
      onSubmit: () => this.submit().catch(() => {}),
      onSaveDraft: () => this.saveDraft().catch(() => {}),
      onRestart: () => this.restart(),
    });
  }

  private showErrorToUser(message: string | undefined): void {
    if (!this.renderer || !this.container) return;
    const renderer = this.renderer;
    if (renderer instanceof DOMRenderer) {
      renderer.setError(message || null);
      this.render();
      setTimeout(() => {
        if (renderer && renderer.setError) {
          renderer.setError(null);
          this.render();
        }
      }, 4000);
    }
  }

  private setSubmittingState(value: boolean): void {
    if (!this.renderer || !this.container) return;
    if (this.renderer instanceof DOMRenderer) {
      this.renderer.setSubmitting(value);
      this.render();
    }
  }
}
