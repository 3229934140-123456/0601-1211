import type {
  SurveyRenderer,
  RenderContext,
  RendererEventHandlers,
  Question,
  SingleChoiceQuestion,
  MultipleChoiceQuestion,
  RatingQuestion,
  TextQuestion,
  Answer,
  RenderConfig,
  DisplayMode,
  SuccessCardType,
  SuccessPageButtonConfig,
} from '../types';
import { StatisticsCalculator } from '../core/StatisticsCalculator';

const DEFAULT_BUTTON_TEXTS = {
  prev: '上一题',
  next: '下一题',
  submit: '提交问卷',
  restart: '重新开始',
  saveDraft: '保存草稿',
  toggleMode: '切换模式',
};

const CSS_STYLES = `
.survey-sdk-container {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  max-width: 760px;
  margin: 0 auto;
  padding: 24px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  color: #1f2937;
}
.survey-sdk-header {
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}
.survey-sdk-header-info { flex: 1; min-width: 260px; }
.survey-sdk-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: #111827;
}
.survey-sdk-description {
  font-size: 14px;
  color: #6b7280;
  margin: 0;
  line-height: 1.6;
}
.survey-sdk-mode-switch {
  display: inline-flex;
  background: #f3f4f6;
  padding: 3px;
  border-radius: 8px;
  gap: 2px;
}
.survey-sdk-mode-btn {
  padding: 6px 14px;
  font-size: 12px;
  border: none;
  background: transparent;
  color: #374151;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-family: inherit;
}
.survey-sdk-mode-btn.active {
  background: #ffffff;
  color: #3b82f6;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}
.survey-sdk-progress-bar {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 20px;
}
.survey-sdk-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #6366f1);
  transition: width 0.3s ease;
  border-radius: 4px;
}
.survey-sdk-progress-text {
  font-size: 13px;
  color: #6b7280;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
}
.survey-sdk-question-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 24px;
  margin-bottom: 20px;
  position: relative;
  transition: all 0.2s ease;
  scroll-margin-top: 20px;
}
.survey-sdk-question-card.highlight {
  border-color: #f59e0b;
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15);
  animation: survey-pulse 1.2s ease-in-out;
}
.survey-sdk-question-card.invalid {
  border-color: #ef4444;
  background: #fef2f2;
}
.survey-sdk-question-card.answered {
  border-color: #10b981;
  background: #ecfdf5;
}
@keyframes survey-pulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.15); }
  50% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0.05); }
}
.survey-sdk-question-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.survey-sdk-question-index {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  color: #3b82f6;
  background: #eff6ff;
  padding: 4px 10px;
  border-radius: 20px;
}
.survey-sdk-question-type {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #e5e7eb;
  color: #374151;
  font-weight: 600;
}
.survey-sdk-question-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 600;
  margin-left: auto;
}
.survey-sdk-question-status.answered { background: #d1fae5; color: #065f46; }
.survey-sdk-question-status.required { background: #fee2e2; color: #991b1b; }
.survey-sdk-question-required {
  color: #ef4444;
  margin-left: 4px;
  font-weight: 700;
}
.survey-sdk-question-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #111827;
  line-height: 1.5;
}
.survey-sdk-question-desc {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 18px 0;
}
.survey-sdk-error {
  background: #fef2f2;
  color: #dc2626;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 16px;
  border-left: 3px solid #ef4444;
}
.survey-sdk-invalid-list {
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 20px;
}
.survey-sdk-invalid-title {
  font-size: 13px;
  font-weight: 700;
  color: #991b1b;
  margin: 0 0 8px 0;
}
.survey-sdk-invalid-links {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.survey-sdk-invalid-link {
  font-size: 12px;
  padding: 4px 10px;
  background: #fee2e2;
  color: #991b1b;
  border: 1px solid #fecaca;
  border-radius: 20px;
  cursor: pointer;
  font-weight: 600;
}
.survey-sdk-invalid-link:hover {
  background: #fecaca;
}
.survey-sdk-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.survey-sdk-option {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: #ffffff;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}
.survey-sdk-option:hover {
  border-color: #93c5fd;
  background: #eff6ff;
}
.survey-sdk-option.selected {
  border-color: #3b82f6;
  background: #eff6ff;
}
.survey-sdk-option input[type="radio"],
.survey-sdk-option input[type="checkbox"] {
  margin-right: 12px;
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #3b82f6;
}
.survey-sdk-option-label {
  font-size: 15px;
  color: #1f2937;
  cursor: pointer;
  flex: 1;
}
.survey-sdk-rating-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.survey-sdk-rating-btn {
  min-width: 52px;
  height: 52px;
  border: 2px solid #e5e7eb;
  background: #ffffff;
  border-radius: 10px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4px 10px;
}
.survey-sdk-rating-btn:hover {
  border-color: #93c5fd;
  background: #eff6ff;
}
.survey-sdk-rating-btn.selected {
  border-color: #3b82f6;
  background: #3b82f6;
  color: #ffffff;
  transform: scale(1.05);
}
.survey-sdk-rating-label {
  font-size: 11px;
  margin-top: 2px;
  opacity: 0.8;
}
.survey-sdk-text-input {
  width: 100%;
  padding: 12px 14px;
  font-size: 15px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
  font-family: inherit;
  resize: vertical;
}
.survey-sdk-text-input:focus {
  border-color: #3b82f6;
}
.survey-sdk-text-input.multiline {
  min-height: 100px;
}
.survey-sdk-text-hint {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 6px;
  text-align: right;
}
.survey-sdk-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.survey-sdk-actions-left,
.survey-sdk-actions-right {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.survey-sdk-btn {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}
.survey-sdk-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.survey-sdk-btn-primary {
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  color: white;
}
.survey-sdk-btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59,130,246,0.35);
}
.survey-sdk-btn-secondary {
  background: #ffffff;
  color: #374151;
  border: 2px solid #e5e7eb;
}
.survey-sdk-btn-secondary:hover:not(:disabled) {
  border-color: #9ca3af;
  background: #f9fafb;
}
.survey-sdk-btn-success {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
}
.survey-sdk-btn-success:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16,185,129,0.35);
}
.survey-sdk-btn-warning {
  background: #fef3c7;
  color: #92400e;
  border: 2px solid #fde68a;
}
.survey-sdk-btn-warning:hover:not(:disabled) {
  background: #fde68a;
}
.survey-sdk-success-page {
  text-align: center;
  padding: 32px 20px;
}
.survey-sdk-success-icon {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #10b981, #059669);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  color: white;
  font-size: 40px;
  font-weight: bold;
}
.survey-sdk-success-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: #111827;
}
.survey-sdk-success-msg {
  font-size: 14px;
  color: #6b7280;
  margin: 0 0 20px 0;
  line-height: 1.6;
}
.survey-sdk-summary-card {
  background: #f9fafb;
  border-radius: 10px;
  padding: 18px;
  text-align: left;
  margin: 20px 0;
}
.survey-sdk-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}
.survey-sdk-summary-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 10px;
  background: #ffffff;
  border-radius: 6px;
  font-size: 13px;
}
.survey-sdk-summary-label {
  color: #6b7280;
}
.survey-sdk-summary-value {
  color: #111827;
  font-weight: 600;
}
.survey-sdk-highlight {
  padding: 10px 12px;
  border-radius: 8px;
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.5;
}
.survey-sdk-highlight.good {
  background: #ecfdf5;
  color: #065f46;
}
.survey-sdk-highlight.bad {
  background: #fef2f2;
  color: #991b1b;
}
.survey-sdk-loading {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid #ffffff;
  border-bottom-color: transparent;
  border-radius: 50%;
  animation: survey-spin 0.8s linear infinite;
  vertical-align: middle;
  margin-right: 6px;
}
@keyframes survey-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@media (max-width: 640px) {
  .survey-sdk-container { padding: 16px; border-radius: 0; box-shadow: none; }
  .survey-sdk-question-card { padding: 16px; }
  .survey-sdk-title { font-size: 18px; }
  .survey-sdk-rating-btn { min-width: 44px; height: 44px; font-size: 14px; }
}
`;

export class DOMRenderer implements SurveyRenderer {
  private container: HTMLElement | null = null;
  private stylesInjected: boolean = false;
  private currentError: string | null = null;
  private submitting: boolean = false;
  private highlightQuestionId: string | null = null;
  private invalidQuestionIds: string[] = [];
  private displayMode: DisplayMode = 'single';
  private renderConfig: RenderConfig = {};

  constructor(renderConfig?: RenderConfig) {
    if (renderConfig) {
      this.renderConfig = renderConfig;
      if (renderConfig.displayMode) {
        this.displayMode = renderConfig.displayMode;
      }
    }
  }

  setError(error: string | null): void {
    this.currentError = error;
  }

  setSubmitting(value: boolean): void {
    this.submitting = value;
  }

  setHighlightQuestionId(id: string | null): void {
    this.highlightQuestionId = id;
  }

  setInvalidQuestionIds(ids: string[]): void {
    this.invalidQuestionIds = ids;
  }

  setDisplayMode(mode: DisplayMode): void {
    this.displayMode = mode;
  }

  getDisplayMode(): DisplayMode {
    return this.displayMode;
  }

  mount(container: HTMLElement): void {
    this.container = container;
    this.injectStyles();
  }

  unmount(): void {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.container = null;
  }

  render(
    context: RenderContext,
    handlers: RendererEventHandlers
  ): void {
    if (!this.container) return;

    if (context.displayMode) {
      this.displayMode = context.displayMode;
    }
    if (context.invalidQuestionIds) {
      this.invalidQuestionIds = context.invalidQuestionIds;
    }
    if (context.highlightQuestionId) {
      this.highlightQuestionId = context.highlightQuestionId;
    }

    if (context.status === 'submitted') {
      this.renderSuccessPage(context, handlers);
      return;
    }

    const buttonTexts = {
      ...DEFAULT_BUTTON_TEXTS,
      ...context.buttonTexts,
    };

    const html: string[] = [];
    html.push('<div class="survey-sdk-container">');

    html.push(this.renderHeader(context, buttonTexts));

    if (context.showProgress) {
      html.push(this.renderProgress(context));
    }

    if (this.displayMode === 'all' && this.invalidQuestionIds.length > 0) {
      html.push(this.renderInvalidList(context, this.invalidQuestionIds));
    }

    if (this.displayMode === 'single') {
      const currentQuestion = context.questions[context.currentQuestionIndex];
      if (currentQuestion) {
        html.push(
          this.renderQuestionCard(currentQuestion, context, -1, false)
        );
      }
    } else {
      for (let i = 0; i < context.questions.length; i++) {
        const q = context.questions[i];
        const isInvalid = this.invalidQuestionIds.includes(q.id);
        html.push(this.renderQuestionCard(q, context, i, isInvalid));
      }
    }

    if (this.currentError) {
      html.push(
        `<div class="survey-sdk-error">${this.escapeHtml(this.currentError)}</div>`
      );
    }

    html.push(
      this.renderActions(context, buttonTexts, handlers)
    );

    html.push('</div>');

    this.container.innerHTML = html.join('');
    this.bindEvents(context, handlers);
    this.scrollToHighlightIfNeeded();
  }

  private scrollToHighlightIfNeeded(): void {
    if (!this.container || !this.highlightQuestionId) return;
    const el = this.container.querySelector(
      `[data-question-id="${this.highlightQuestionId}"]`
    ) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  private injectStyles(): void {
    if (this.stylesInjected) return;
    if (document.getElementById('survey-sdk-styles')) {
      this.stylesInjected = true;
      return;
    }
    const style = document.createElement('style');
    style.id = 'survey-sdk-styles';
    style.textContent = CSS_STYLES;
    document.head.appendChild(style);
    this.stylesInjected = true;
  }

  private renderHeader(
    context: RenderContext,
    buttonTexts: Record<string, string>
  ): string {
    const isAll = this.displayMode === 'all';
    return `
      <div class="survey-sdk-header">
        <div class="survey-sdk-header-info">
          <h2 class="survey-sdk-title">${this.escapeHtml(context.survey.meta.title)}</h2>
          ${
            context.survey.meta.description
              ? `<p class="survey-sdk-description">${this.escapeHtml(context.survey.meta.description)}</p>`
              : ''
          }
        </div>
        <div class="survey-sdk-mode-switch" role="tablist" aria-label="显示模式">
          <button type="button" class="survey-sdk-mode-btn ${!isAll ? 'active' : ''}" data-mode="single" title="一题一页">
            📄 单页
          </button>
          <button type="button" class="survey-sdk-mode-btn ${isAll ? 'active' : ''}" data-mode="all" title="整页展开">
            📋 整页
          </button>
        </div>
      </div>
    `;
  }

  private renderProgress(context: RenderContext): string {
    const rate = context.completionRate;
    const percent = Math.round(rate.rate * 100);
    const currentDisplay =
      this.displayMode === 'single'
        ? `${context.currentQuestionIndex + 1}/${context.totalQuestions}`
        : `${rate.answeredQuestions}/${rate.totalQuestions}`;

    const requiredHint =
      rate.requiredTotal > 0
        ? `必答 ${rate.requiredAnswered}/${rate.requiredTotal}`
        : '';

    return `
      <div class="survey-sdk-progress-text">
        <span>进度：${currentDisplay} 题 ${requiredHint ? `&middot; ${requiredHint}` : ''}</span>
        <span>完成度 ${percent}%</span>
      </div>
      <div class="survey-sdk-progress-bar">
        <div class="survey-sdk-progress-fill" style="width: ${percent}%"></div>
      </div>
    `;
  }

  private renderInvalidList(
    context: RenderContext,
    invalidIds: string[]
  ): string {
    const links = invalidIds
      .map((id) => {
        const idx = context.questions.findIndex((q) => q.id === id);
        const q = context.questions[idx];
        if (!q) return '';
        return `<button type="button" class="survey-sdk-invalid-link" data-jump-question="${this.escapeAttr(id)}">
          第 ${idx + 1} 题 · ${this.escapeHtml(q.title.slice(0, 20))}${q.title.length > 20 ? '…' : ''}
        </button>`;
      })
      .join('');

    return `
      <div class="survey-sdk-invalid-list">
        <p class="survey-sdk-invalid-title">⚠ 还有 ${invalidIds.length} 道必填题未完成，点击快速定位：</p>
        <div class="survey-sdk-invalid-links">${links}</div>
      </div>
    `;
  }

  private getQuestionTypeLabel(q: Question): string {
    switch (q.type) {
      case 'single': return '单选';
      case 'multiple': return '多选';
      case 'rating': return '打分';
      case 'text': return q.multiline ? '多行文本' : '文本';
    }
  }

  private hasAnswered(question: Question, context: RenderContext): boolean {
    const a = context.answers[question.id];
    if (!a || a.value === null || a.value === undefined) return false;
    if (Array.isArray(a.value)) return a.value.length > 0;
    if (typeof a.value === 'string') return a.value.trim().length > 0;
    return true;
  }

  private renderQuestionCard(
    question: Question,
    context: RenderContext,
    visibleIndex: number,
    isInvalid: boolean
  ): string {
    const index =
      visibleIndex >= 0 ? visibleIndex : context.currentQuestionIndex;
    const answered = this.hasAnswered(question, context);
    const highlighted = this.highlightQuestionId === question.id;
    const classes = ['survey-sdk-question-card'];
    if (answered) classes.push('answered');
    if (isInvalid) classes.push('invalid');
    if (highlighted) classes.push('highlight');

    const typeLabel = this.getQuestionTypeLabel(question);

    let statusHtml = '';
    if (answered) {
      statusHtml = `<span class="survey-sdk-question-status answered">已答 ✓</span>`;
    } else if (question.required) {
      statusHtml = `<span class="survey-sdk-question-status required">必填</span>`;
    }

    const html: string[] = [];
    html.push(
      `<div class="${classes.join(' ')}" data-question-id="${this.escapeAttr(question.id)}">`
    );
    html.push('<div class="survey-sdk-question-header">');
    if (context.showQuestionIndex) {
      html.push(
        `<span class="survey-sdk-question-index">第 ${index + 1} 题</span>`
      );
    }
    html.push(`<span class="survey-sdk-question-type">${typeLabel}</span>`);
    html.push(statusHtml);
    html.push('</div>');

    html.push(
      `<h3 class="survey-sdk-question-title">${this.escapeHtml(question.title)}${question.required
        ? '<span class="survey-sdk-question-required">*</span>'
        : ''}</h3>`
    );

    if (question.description) {
      html.push(
        `<p class="survey-sdk-question-desc">${this.escapeHtml(question.description)}</p>`
      );
    }

    const answer = context.answers[question.id];
    html.push(this.renderQuestionBody(question, answer));

    html.push('</div>');
    return html.join('');
  }

  private renderQuestionBody(
    question: Question,
    answer: Answer | undefined
  ): string {
    switch (question.type) {
      case 'single':
        return this.renderSingleChoice(question, answer);
      case 'multiple':
        return this.renderMultipleChoice(question, answer);
      case 'rating':
        return this.renderRating(question, answer);
      case 'text':
        return this.renderText(question, answer);
    }
  }

  private renderSingleChoice(
    question: SingleChoiceQuestion,
    answer: Answer | undefined
  ): string {
    const selectedValue = answer?.value;
    const optionsHtml = question.options
      .map((opt) => {
        const val = String(opt.value);
        const isSelected =
          selectedValue !== undefined &&
          selectedValue !== null &&
          String(selectedValue) === val;
        return `
          <label class="survey-sdk-option ${isSelected ? 'selected' : ''}" data-single-option data-qid="${this.escapeAttr(question.id)}" data-value="${this.escapeAttr(val)}">
            <input type="radio" name="q_${question.id}" value="${this.escapeAttr(val)}" ${isSelected ? 'checked' : ''} />
            <span class="survey-sdk-option-label">${this.escapeHtml(opt.label)}</span>
          </label>
        `;
      })
      .join('');
    return `<div class="survey-sdk-options">${optionsHtml}</div>`;
  }

  private renderMultipleChoice(
    question: MultipleChoiceQuestion,
    answer: Answer | undefined
  ): string {
    const selectedValues: (string | number)[] = Array.isArray(answer?.value)
      ? (answer.value as (string | number)[])
      : [];
    const selectedStr = selectedValues.map(String);

    const hint =
      question.minSelect || question.maxSelect
        ? `<p class="survey-sdk-question-desc" style="margin-top:8px;">
            ${question.minSelect ? `最少选 ${question.minSelect} 项` : ''}
            ${question.minSelect && question.maxSelect ? '，' : ''}
            ${question.maxSelect ? `最多选 ${question.maxSelect} 项` : ''}
            <span style="color:#6b7280;">· 已选 ${selectedStr.length} 项</span>
           </p>`
        : '';

    const optionsHtml = question.options
      .map((opt) => {
        const val = String(opt.value);
        const isSelected = selectedStr.includes(val);
        return `
          <label class="survey-sdk-option ${isSelected ? 'selected' : ''}" data-multi-option data-qid="${this.escapeAttr(question.id)}" data-value="${this.escapeAttr(val)}">
            <input type="checkbox" name="q_${question.id}" value="${this.escapeAttr(val)}" ${isSelected ? 'checked' : ''} />
            <span class="survey-sdk-option-label">${this.escapeHtml(opt.label)}</span>
          </label>
        `;
      })
      .join('');

    return `<div class="survey-sdk-options">${optionsHtml}</div>${hint}`;
  }

  private renderRating(
    question: RatingQuestion,
    answer: Answer | undefined
  ): string {
    const selectedValue =
      answer?.value !== undefined && answer?.value !== null
        ? Number(answer.value)
        : null;
    const step = question.step || 1;
    const labelMap = new Map(
      (question.labels || []).map((l) => [l.value, l.label])
    );

    const buttons: string[] = [];
    for (let v = question.minValue; v <= question.maxValue; v += step) {
      const val = Number(v.toFixed(10));
      const isSelected = selectedValue === val;
      const label = labelMap.get(val);
      buttons.push(`
        <button type="button" class="survey-sdk-rating-btn ${isSelected ? 'selected' : ''}"
                data-rating data-qid="${this.escapeAttr(question.id)}" data-value="${val}">
          <span>${val}</span>
          ${label ? `<span class="survey-sdk-rating-label">${this.escapeHtml(label)}</span>` : ''}
        </button>
      `);
    }

    const currentHint =
      selectedValue !== null
        ? `<p class="survey-sdk-question-desc" style="margin-top:10px; color:#3b82f6;">当前选择：${selectedValue} 分${labelMap.has(selectedValue) ? `（${labelMap.get(selectedValue)}）` : ''}</p>`
        : '';

    return `<div class="survey-sdk-rating-group">${buttons.join('')}</div>${currentHint}`;
  }

  private renderText(
    question: TextQuestion,
    answer: Answer | undefined
  ): string {
    const value =
      answer?.value !== undefined && answer?.value !== null
        ? String(answer.value)
        : '';
    const multiline = question.multiline ? 'multiline' : '';
    const textareaOrInput = question.multiline
      ? `<textarea class="survey-sdk-text-input ${multiline}"
                   name="q_${question.id}"
                   placeholder="${this.escapeAttr(question.placeholder || '')}"
                   data-text-input data-qid="${this.escapeAttr(question.id)}"
                   ${question.maxLength ? `maxlength="${question.maxLength}"` : ''}
                   ${question.minLength ? `minlength="${question.minLength}"` : ''}
      >${this.escapeHtml(value)}</textarea>`
      : `<input type="text"
                class="survey-sdk-text-input"
                name="q_${question.id}"
                value="${this.escapeAttr(value)}"
                placeholder="${this.escapeAttr(question.placeholder || '')}"
                data-text-input data-qid="${this.escapeAttr(question.id)}"
                ${question.maxLength ? `maxlength="${question.maxLength}"` : ''}
                ${question.minLength ? `minlength="${question.minLength}"` : ''}
      />`;

    const hint = question.maxLength
      ? `<div class="survey-sdk-text-hint">${value.length}/${question.maxLength}</div>`
      : '';

    return `${textareaOrInput}${hint}`;
  }

  private renderActions(
    context: RenderContext,
    buttonTexts: Record<string, string>,
    _handlers: RendererEventHandlers
  ): string {
    const isAll = this.displayMode === 'all';
    const isFirst = context.isFirstQuestion;
    const isLast = context.isLastQuestion;
    const canSubmit = context.status !== 'submitted';

    const prevBtn = !isAll
      ? `<button type="button" class="survey-sdk-btn survey-sdk-btn-secondary" data-action="prev" ${isFirst ? 'disabled' : ''}>
           ${this.escapeHtml(buttonTexts.prev || '上一题')}
         </button>`
      : '';

    const nextBtn = !isAll && !isLast
      ? `<button type="button" class="survey-sdk-btn survey-sdk-btn-primary" data-action="next">
           ${this.escapeHtml(buttonTexts.next || '下一题')}
         </button>`
      : '';

    const submitBtn = isAll || isLast
      ? `<button type="button" class="survey-sdk-btn survey-sdk-btn-success" data-action="submit" ${!canSubmit || this.submitting ? 'disabled' : ''}>
           ${this.submitting ? '<span class="survey-sdk-loading"></span>' : ''}${this.escapeHtml(buttonTexts.submit || '提交问卷')}
         </button>`
      : '';

    return `
      <div class="survey-sdk-actions">
        <div class="survey-sdk-actions-left">
          <button type="button" class="survey-sdk-btn survey-sdk-btn-secondary" data-action="save-draft" ${context.status === 'submitted' ? 'disabled' : ''}>
            💾 ${this.escapeHtml(buttonTexts.saveDraft || '保存草稿')}
          </button>
        </div>
        <div class="survey-sdk-actions-right">
          ${prevBtn}
          ${nextBtn}
          ${submitBtn}
        </div>
      </div>
    `;
  }

  private renderSuccessPage(
    context: RenderContext,
    handlers: RendererEventHandlers
  ): void {
    if (!this.container) return;

    const summary = StatisticsCalculator.generateRichResultSummary(
      context.survey,
      context.questions,
      context.answers
    );

    const buttonTexts = {
      ...DEFAULT_BUTTON_TEXTS,
      ...context.buttonTexts,
    };

    const config = this.renderConfig?.successPageConfig || {};
    const defaultCards: SuccessCardType[] = ['completion', 'score', 'options', 'duration', 'submissionId'];
    const defaultButtons: SuccessPageButtonConfig[] = [
      {
        label: buttonTexts.restart || '重新开始',
        type: 'primary',
        action: 'restart',
      },
    ];
    const defaultConfig = {
      showTitle: true,
      title: '问卷提交成功！',
      subtitle: '感谢您的宝贵反馈，您的意见对我们非常重要。',
      icon: '✓',
      cards: defaultCards,
      buttons: defaultButtons,
      showRestartButton: true,
    };
    const merged = { ...defaultConfig, ...config };
    if (config.cards) merged.cards = config.cards;
    if (config.buttons) merged.buttons = config.buttons;

    const cardsHtml: string[] = [];

    if (merged.cards.includes('completion')) {
      cardsHtml.push(`
        <div class="survey-sdk-summary-row">
          <span class="survey-sdk-summary-label">总题数</span>
          <span class="survey-sdk-summary-value">${summary.totalQuestions} 题</span>
        </div>
        <div class="survey-sdk-summary-row">
          <span class="survey-sdk-summary-label">已答</span>
          <span class="survey-sdk-summary-value">${summary.answeredQuestions} 题</span>
        </div>
        <div class="survey-sdk-summary-row">
          <span class="survey-sdk-summary-label">必填完成</span>
          <span class="survey-sdk-summary-value">${summary.requiredAnswered}/${summary.requiredTotal}</span>
        </div>
        <div class="survey-sdk-summary-row">
          <span class="survey-sdk-summary-label">完成率</span>
          <span class="survey-sdk-summary-value">${Math.round(summary.completionRate * 100)}%</span>
        </div>
      `);
    }

    if (merged.cards.includes('score') && summary.averageScore !== undefined && summary.maxScore) {
      const displayMax =
        summary.ratingOverview.totalRatingQuestions > 0
          ? Math.round(
              summary.maxScore / summary.ratingOverview.totalRatingQuestions
            )
          : summary.maxScore;
      cardsHtml.push(`
        <div class="survey-sdk-summary-row">
          <span class="survey-sdk-summary-label">平均得分</span>
          <span class="survey-sdk-summary-value">${summary.averageScore.toFixed(1)} 分</span>
        </div>
      `);
    }

    if (merged.cards.includes('rating') && summary.ratingOverview.totalRatingQuestions > 0) {
      cardsHtml.push(`
        <div class="survey-sdk-summary-row">
          <span class="survey-sdk-summary-label">打分题数</span>
          <span class="survey-sdk-summary-value">${summary.ratingOverview.totalRatingQuestions}</span>
        </div>
        <div class="survey-sdk-summary-row">
          <span class="survey-sdk-summary-label">加权平均</span>
          <span class="survey-sdk-summary-value">${summary.ratingOverview.weightedAverage.toFixed(2)}</span>
        </div>
        ${
          summary.ratingOverview.netPromoterScore !== undefined
            ? `<div class="survey-sdk-summary-row">
                 <span class="survey-sdk-summary-label">NPS</span>
                 <span class="survey-sdk-summary-value">${summary.ratingOverview.netPromoterScore}</span>
               </div>`
            : ''
        }
      `);
    }

    if (merged.cards.includes('options')) {
      cardsHtml.push(`
        <div class="survey-sdk-summary-row">
          <span class="survey-sdk-summary-label">题目分布</span>
          <span class="survey-sdk-summary-value">
            单选${summary.questionCountByType.single} · 多选${summary.questionCountByType.multiple} · 打分${summary.questionCountByType.rating} · 文本${summary.questionCountByType.text}
          </span>
        </div>
      `);
    }

    if (merged.cards.includes('texts')) {
      cardsHtml.push(`
        <div class="survey-sdk-summary-row">
          <span class="survey-sdk-summary-label">文本题数</span>
          <span class="survey-sdk-summary-value">${summary.textSummaries.length} 题</span>
        </div>
      `);
    }

    if (merged.cards.includes('keywords') && summary.textSummaries.length > 0) {
      const allKeywords: string[] = [];
      for (const t of summary.textSummaries) {
        for (const k of t.keywords) allKeywords.push(k);
      }
      const topKeywords = allKeywords.slice(0, 6);
      if (topKeywords.length > 0 && cardsHtml.length > 0) {
        cardsHtml.push(`
          <div class="survey-sdk-summary-row" style="grid-column: 1 / -1;">
            <span class="survey-sdk-summary-label">关键词提取</span>
            <span class="survey-sdk-summary-value" style="font-size:12px;">
              ${topKeywords.map((k: string) => `<span style="display:inline-block;padding:2px 8px;margin:2px;background:rgba(99,102,241,0.15);border-radius:999px;">${this.escapeHtml(k)}</span>`).join('')}
            </span>
          </div>
        `);
      }
    }

    if (merged.cards.includes('duration') && summary.durationSeconds) {
      cardsHtml.push(`
        <div class="survey-sdk-summary-row">
          <span class="survey-sdk-summary-label">答题时长</span>
          <span class="survey-sdk-summary-value">${summary.durationSeconds} 秒</span>
        </div>
      `);
    }

    if (merged.cards.includes('submissionId')) {
      const subId = (context as { submissionId?: string }).submissionId;
      cardsHtml.push(`
        <div class="survey-sdk-summary-row" style="grid-column: 1 / -1;">
          <span class="survey-sdk-summary-label">提交编号</span>
          <span class="survey-sdk-summary-value" style="font-size:11px;word-break:break-all;">${this.escapeHtml(subId || '待生成')}</span>
        </div>
      `);
    }

    const highlights: string[] = [];
    if (summary.highlights.highestRated) {
      highlights.push(
        `<div class="survey-sdk-highlight good">✓ 最高评价：${this.escapeHtml(summary.highlights.highestRated.title)} (${summary.highlights.highestRated.score}分)</div>`
      );
    }
    if (summary.highlights.lowestRated) {
      highlights.push(
        `<div class="survey-sdk-highlight bad">⚠ 待改进项：${this.escapeHtml(summary.highlights.lowestRated.title)} (${summary.highlights.lowestRated.score}分)</div>`
      );
    }

    const buttonsHtml = merged.buttons
      .map((btn, idx) => {
        const typeClass =
          btn.type === 'primary'
            ? 'survey-sdk-btn-primary'
            : btn.type === 'secondary'
              ? 'survey-sdk-btn-secondary'
              : '';
        const iconHtml = btn.icon ? `<span style="margin-right:6px;">${btn.icon}</span>` : '';
        return `
          <button type="button" class="survey-sdk-btn ${typeClass}" data-success-action="${btn.action}" data-btn-index="${idx}" ${btn.navigateUrl ? `data-navigate-url="${this.escapeAttr(btn.navigateUrl)}"` : ''}>
            ${iconHtml}${this.escapeHtml(btn.label)}
          </button>
        `;
      })
      .join('');

    const titleHtml = merged.showTitle
      ? `
        <div class="survey-sdk-success-icon">${this.escapeHtml(merged.icon || '✓')}</div>
        <h2 class="survey-sdk-success-title">${this.escapeHtml(merged.title || '')}</h2>
        ${merged.subtitle ? `<p class="survey-sdk-success-msg">${this.escapeHtml(merged.subtitle)}</p>` : ''}
      `
      : '';

    this.container.innerHTML = `
      <div class="survey-sdk-container">
        <div class="survey-sdk-success-page">
          ${titleHtml}
          <div class="survey-sdk-summary-card">
            <div class="survey-sdk-summary-grid">
              ${cardsHtml.join('')}
            </div>
            ${highlights.length > 0 ? `<div style="margin-top:12px;">${highlights.join('')}</div>` : ''}
            ${
              summary.optionDistributions.length > 0
                ? `<p class="survey-sdk-question-desc" style="margin-top:14px; text-align:center;">📊 已生成完整统计（选项分布 ${summary.optionDistributions.length} 项 · 文本汇总 ${summary.textSummaries.length} 项），业务页面可直接读取</p>`
                : ''
            }
          </div>
          <div class="survey-sdk-success-buttons" style="display:flex;gap: 0 8px;">
            ${buttonsHtml}
          </div>
        </div>
      </div>
    `;

    const successBtns = this.container.querySelectorAll('[data-success-action]');
    successBtns.forEach((el) => {
      el.addEventListener('click', () => {
        const action = (el as HTMLElement).getAttribute('data-success-action');
        const idx = parseInt((el as HTMLElement).getAttribute('data-btn-index') || '0', 10);
        const navigateUrl = (el as HTMLElement).getAttribute('data-navigate-url');
        const btnConfig = merged.buttons[idx];
        if (!btnConfig) return;

        switch (action) {
          case 'restart':
            handlers.onRestart();
            break;
          case 'close':
            if (handlers.onClose) {
              handlers.onClose();
            }
            break;
          case 'navigate':
            if (navigateUrl) {
              window.location.href = navigateUrl;
            }
            break;
          case 'custom':
            if (btnConfig.customHandler && typeof btnConfig.customHandler === 'function') {
              btnConfig.customHandler();
            }
            break;
        }
      });
    });
  }

  private bindEvents(
    context: RenderContext,
    handlers: RendererEventHandlers
  ): void {
    const container = this.container;
    if (!container) return;

    const modeBtns = container.querySelectorAll('[data-mode]');
    modeBtns.forEach((el) => {
      el.addEventListener('click', () => {
        const mode = (el as HTMLElement).getAttribute('data-mode') as DisplayMode;
        if (!mode) return;
        if (handlers.onSetMode) {
          handlers.onSetMode(mode);
        } else if (handlers.onToggleMode) {
          handlers.onToggleMode();
        }
      });
    });

    const jumpBtns = container.querySelectorAll('[data-jump-question]');
    jumpBtns.forEach((el) => {
      el.addEventListener('click', () => {
        const qid = (el as HTMLElement).getAttribute('data-jump-question');
        if (qid && handlers.onJumpToQuestion) {
          handlers.onJumpToQuestion(qid);
        }
      });
    });

    const bindPerQuestion = (qid: string) => {
      const q = context.questions.find((x) => x.id === qid);
      if (!q) return;

      const singleOptions = container.querySelectorAll(
        `[data-single-option][data-qid="${qid}"]`
      );
      singleOptions.forEach((el) => {
        el.addEventListener('click', (e) => {
          const target = e.currentTarget as HTMLElement;
          const value = target.getAttribute('data-value')!;
          handlers.onAnswer(qid, value);
        });
      });

      const multiOptions = container.querySelectorAll(
        `[data-multi-option][data-qid="${qid}"]`
      );
      multiOptions.forEach((el) => {
        el.addEventListener('click', (e) => {
          e.preventDefault();
          const target = e.currentTarget as HTMLElement;
          const value = target.getAttribute('data-value')!;
          const input = target.querySelector('input') as HTMLInputElement;
          const isChecked = input.checked;

          const current = context.answers[qid]?.value;
          const currentArr: (string | number)[] = Array.isArray(current)
            ? [...current]
            : [];

          if (isChecked) {
            const idx = currentArr.findIndex((v) => String(v) === value);
            if (idx > -1) currentArr.splice(idx, 1);
          } else {
            if (!currentArr.some((v) => String(v) === value)) {
              currentArr.push(value);
            }
          }

          handlers.onAnswer(qid, currentArr);
        });
      });

      const ratingBtns = container.querySelectorAll(
        `[data-rating][data-qid="${qid}"]`
      );
      ratingBtns.forEach((el) => {
        el.addEventListener('click', () => {
          const target = el as HTMLElement;
          const value = Number(target.getAttribute('data-value'));
          handlers.onAnswer(qid, value);
        });
      });

      const textInput = container.querySelector(
        `[data-text-input][data-qid="${qid}"]`
      ) as HTMLInputElement | HTMLTextAreaElement | null;
      if (textInput) {
        const changeHandler = (e: Event) => {
          const target = e.target as HTMLInputElement | HTMLTextAreaElement;
          handlers.onAnswer(qid, target.value);
        };
        textInput.addEventListener('input', changeHandler);
        textInput.addEventListener('change', changeHandler);
      }
    };

    if (this.displayMode === 'single') {
      const q = context.questions[context.currentQuestionIndex];
      if (q) bindPerQuestion(q.id);
    } else {
      for (const q of context.questions) bindPerQuestion(q.id);
    }

    const prevBtn = container.querySelector('[data-action="prev"]');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => handlers.onPrev());
    }
    const nextBtn = container.querySelector('[data-action="next"]');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => handlers.onNext());
    }
    const submitBtn = container.querySelector('[data-action="submit"]');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => handlers.onSubmit());
    }
    const saveDraftBtn = container.querySelector(
      '[data-action="save-draft"]'
    );
    if (saveDraftBtn) {
      saveDraftBtn.addEventListener('click', () => handlers.onSaveDraft());
    }
  }

  private escapeHtml(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  private escapeAttr(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
