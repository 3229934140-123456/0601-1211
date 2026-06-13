import type {
  SubmissionResultContext,
  ResultBlock,
  ResultCenterConfig,
  ResultCenterAction,
  ResultCenterSnapshot,
  WorkbenchConfig,
  WorkbenchAction,
  SubmitResult,
  RichResultSummary,
  UserContext,
  AnswersMap,
} from '../types';

export class ResultCenter {
  private config: ResultCenterConfig;
  private snapshots: Map<string, ResultCenterSnapshot> = new Map();
  private currentContext: SubmissionResultContext | null = null;
  private workbenchConfig: WorkbenchConfig | null = null;

  constructor(config?: Partial<ResultCenterConfig>) {
    const defaultBlocks: ResultBlock[] = [
      { id: 'completion', type: 'completion', visible: true, order: 0 },
      { id: 'score', type: 'score', visible: true, order: 1 },
      { id: 'rating', type: 'rating', visible: true, order: 2 },
      { id: 'options', type: 'options', visible: true, order: 3 },
      { id: 'texts', type: 'texts', visible: true, order: 4 },
      { id: 'keywords', type: 'keywords', visible: true, order: 5 },
      { id: 'duration', type: 'duration', visible: true, order: 6 },
      { id: 'submissionId', type: 'submissionId', visible: true, order: 7 },
    ];

    this.config = {
      blocks: config?.blocks || defaultBlocks,
      customFields: config?.customFields || {},
      secondaryActions: config?.secondaryActions || [],
    };
  }

  setWorkbench(config: WorkbenchConfig): void {
    this.workbenchConfig = config;
  }

  clearWorkbench(): void {
    this.workbenchConfig = null;
  }

  getWorkbenchConfig(): WorkbenchConfig | null {
    return this.workbenchConfig;
  }

  getVisibleWorkbenchActions(): WorkbenchAction[] {
    if (!this.workbenchConfig || !this.currentContext) return [];
    return this.workbenchConfig.actions.filter(
      (a) => !a.visible || a.visible(this.currentContext!)
    );
  }

  async runWorkbenchAction(actionId: string, options?: Record<string, unknown>): Promise<boolean> {
    if (!this.workbenchConfig || !this.currentContext) return false;
    const action = this.workbenchConfig.actions.find((a) => a.id === actionId);
    if (!action) return false;
    if (action.visible && !action.visible(this.currentContext)) return false;
    try {
      await action.handler(this.currentContext, options);
      return true;
    } catch (e) {
      console.error('[ResultCenter] Workbench action error:', e);
      return false;
    }
  }

  buildContext(params: {
    result: SubmitResult;
    summary: RichResultSummary;
    surveyId: string;
    surveyTitle: string;
    surveyVersion?: string;
    user: UserContext | null;
    answers: AnswersMap;
    durationSeconds?: number;
    extraFields?: Record<string, unknown>;
  }): SubmissionResultContext {
    const customFields: Record<string, unknown> = {};
    if (this.config.customFields) {
      const tempCtx: SubmissionResultContext = {
        submissionId: params.result.submissionId || '',
        submittedAt: params.result.timestamp || Date.now(),
        durationSeconds: params.durationSeconds,
        surveyId: params.surveyId,
        surveyTitle: params.surveyTitle,
        surveyVersion: params.surveyVersion,
        user: params.user,
        answers: params.answers,
        summary: params.summary,
        customFields: {},
      };
      for (const [key, fn] of Object.entries(this.config.customFields)) {
        try {
          customFields[key] = fn(tempCtx);
        } catch (_) {}
      }
    }

    if (params.extraFields) {
      for (const [key, value] of Object.entries(params.extraFields)) {
        customFields[key] = value;
      }
    }

    const ctx: SubmissionResultContext = {
      submissionId: params.result.submissionId || '',
      submittedAt: params.result.timestamp || Date.now(),
      durationSeconds: params.durationSeconds,
      surveyId: params.surveyId,
      surveyTitle: params.surveyTitle,
      surveyVersion: params.surveyVersion,
      user: params.user,
      answers: params.answers,
      summary: params.summary,
      customFields,
    };

    this.currentContext = ctx;
    return ctx;
  }

  getContextFor(source: 'completionPage' | 'detailDrawer' | 'listCard'): SubmissionResultContext | null {
    if (!this.currentContext) return null;

    this.snapshots.set(source, {
      context: this.currentContext,
      renderedAt: Date.now(),
      source,
    });

    return this.currentContext;
  }

  getSnapshot(source: 'completionPage' | 'detailDrawer' | 'listCard'): ResultCenterSnapshot | null {
    return this.snapshots.get(source) || null;
  }

  getVisibleBlocks(): ResultBlock[] {
    return this.config.blocks
      .filter((b) => b.visible !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  getSecondaryActions(): ResultCenterAction[] {
    return this.config.secondaryActions || [];
  }

  updateConfig(partial: Partial<ResultCenterConfig>): void {
    if (partial.blocks) this.config.blocks = partial.blocks;
    if (partial.customFields) this.config.customFields = partial.customFields;
    if (partial.secondaryActions) this.config.secondaryActions = partial.secondaryActions;
  }

  addBlock(block: ResultBlock): void {
    const existing = this.config.blocks.findIndex((b) => b.id === block.id);
    if (existing >= 0) {
      this.config.blocks[existing] = block;
    } else {
      this.config.blocks.push(block);
    }
  }

  removeBlock(blockId: string): void {
    this.config.blocks = this.config.blocks.filter((b) => b.id !== blockId);
  }

  addAction(action: ResultCenterAction): void {
    if (!this.config.secondaryActions) this.config.secondaryActions = [];
    this.config.secondaryActions.push(action);
  }

  removeAction(actionId: string): void {
    if (this.config.secondaryActions) {
      this.config.secondaryActions = this.config.secondaryActions.filter((a) => a.id !== actionId);
    }
  }

  renderBlock(blockId: string, container: HTMLElement): boolean {
    if (!this.currentContext) return false;
    const block = this.config.blocks.find((b) => b.id === blockId);
    if (!block || block.visible === false) return false;

    if (block.type === 'custom' && block.customRenderer) {
      block.customRenderer(this.currentContext, container);
      return true;
    }

    this.renderBuiltinBlock(block, container);
    return true;
  }

  verifyConsistency(): boolean {
    const sources: Array<'completionPage' | 'detailDrawer' | 'listCard'> = ['completionPage', 'detailDrawer', 'listCard'];
    const snapshots = sources
      .map((s) => this.snapshots.get(s))
      .filter((s): s is ResultCenterSnapshot => s !== null && s !== undefined);

    if (snapshots.length <= 1) return true;

    const first = snapshots[0].context;
    for (let i = 1; i < snapshots.length; i++) {
      const other = snapshots[i].context;
      if (first.submissionId !== other.submissionId) return false;
      if (first.submittedAt !== other.submittedAt) return false;
      if (first.durationSeconds !== other.durationSeconds) return false;
      if (first.surveyId !== other.surveyId) return false;
      if (first.summary.completionRate !== other.summary.completionRate) return false;
    }

    return true;
  }

  destroy(): void {
    this.snapshots.clear();
    this.currentContext = null;
  }

  private renderBuiltinBlock(block: ResultBlock, container: HTMLElement): void {
    if (!this.currentContext) return;
    const ctx = this.currentContext;

    switch (block.type) {
      case 'completion': {
        const pct = Math.round(ctx.summary.completionRate * 100);
        container.innerHTML = `<div class="rc-block rc-completion"><span class="rc-label">${block.title || '完成率'}</span><span class="rc-value">${pct}%</span></div>`;
        break;
      }
      case 'score': {
        const score = ctx.summary.averageScore;
        container.innerHTML = `<div class="rc-block rc-score"><span class="rc-label">${block.title || '平均分'}</span><span class="rc-value">${score != null ? score.toFixed(1) : 'N/A'}</span></div>`;
        break;
      }
      case 'duration': {
        const sec = ctx.durationSeconds;
        const display = sec != null ? `${Math.floor(sec / 60)}分${sec % 60}秒` : 'N/A';
        container.innerHTML = `<div class="rc-block rc-duration"><span class="rc-label">${block.title || '答题时长'}</span><span class="rc-value">${display}</span></div>`;
        break;
      }
      case 'submissionId': {
        container.innerHTML = `<div class="rc-block rc-sid"><span class="rc-label">${block.title || '提交编号'}</span><span class="rc-value">${ctx.submissionId}</span></div>`;
        break;
      }
      default: {
        container.innerHTML = `<div class="rc-block rc-default"><span class="rc-label">${block.title || block.type}</span></div>`;
        break;
      }
    }
  }
}
