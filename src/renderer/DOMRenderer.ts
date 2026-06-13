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
} from '../types';
import { StatisticsCalculator } from '../core/StatisticsCalculator';

const DEFAULT_BUTTON_TEXTS = {
  prev: '上一题',
  next: '下一题',
  submit: '提交问卷',
  restart: '重新开始',
  saveDraft: '保存草稿',
};

const CSS_STYLES = `
.survey-sdk-container {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  max-width: 720px;
  margin: 0 auto;
  padding: 24px;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  color: #1f2937;
}
.survey-sdk-header {
  margin-bottom: 28px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e5e7eb;
}
.survey-sdk-title {
  font-size: 24px;
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
.survey-sdk-progress-bar {
  width: 100%;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 24px;
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
  text-align: right;
}
.survey-sdk-question-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 24px;
  margin-bottom: 24px;
}
.survey-sdk-question-index {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  color: #3b82f6;
  background: #eff6ff;
  padding: 4px 10px;
  border-radius: 20px;
  margin-bottom: 12px;
}
.survey-sdk-question-required {
  color: #ef4444;
  margin-left: 4px;
  font-weight: 700;
}
.survey-sdk-question-title {
  font-size: 17px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: #111827;
  line-height: 1.5;
}
.survey-sdk-question-desc {
  font-size: 13px;
  color: #6b7280;
  margin: 0 0 20px 0;
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
}
.survey-sdk-actions-left,
.survey-sdk-actions-right {
  display: flex;
  gap: 10px;
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
.survey-sdk-success-page {
  text-align: center;
  padding: 40px 20px;
}
.survey-sdk-success-icon {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #10b981, #059669);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24px;
  color: white;
  font-size: 40px;
  font-weight: bold;
}
.survey-sdk-success-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 12px 0;
  color: #111827;
}
.survey-sdk-success-msg {
  font-size: 15px;
  color: #6b7280;
  margin: 0 0 24px 0;
}
.survey-sdk-summary-card {
  background: #f9fafb;
  border-radius: 10px;
  padding: 20px;
  text-align: left;
  margin: 24px 0;
}
.survey-sdk-summary-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid #e5e7eb;
  font-size: 14px;
}
.survey-sdk-summary-row:last-child {
  border-bottom: none;
}
.survey-sdk-summary-label {
  color: #6b7280;
}
.survey-sdk-summary-value {
  color: #111827;
  font-weight: 600;
}
.survey-sdk-highlight {
  padding: 12px;
  border-radius: 8px;
  margin-top: 8px;
  font-size: 13px;
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
  width: 16px;
  height: 16px;
  border: 2px solid #ffffff;
  border-bottom-color: transparent;
  border-radius: 50%;
  animation: survey-spin 0.8s linear infinite;
  vertical-align: middle;
  margin-right: 8px;
}
@keyframes survey-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

export class DOMRenderer implements SurveyRenderer {
  private container: HTMLElement | null = null;
  private stylesInjected: boolean = false;
  private currentError: string | null = null;
  private submitting: boolean = false;
  private renderConfig: RenderConfig = {};

  constructor(renderConfig?: RenderConfig) {
    if (renderConfig) {
      this.renderConfig = renderConfig;
    }
  }

  setError(error: string | null): void {
    this.currentError = error;
  }

  setSubmitting(value: boolean): void {
    this.submitting = value;
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

    html.push(this.renderHeader(context));

    if (context.showProgress) {
      html.push(this.renderProgress(context));
    }

    const currentQuestion = context.questions[context.currentQuestionIndex];
    if (currentQuestion) {
      html.push(this.renderQuestionCard(currentQuestion, context));
    }

    if (this.currentError) {
      html.push(`<div class="survey-sdk-error">${this.escapeHtml(
        this.currentError
      )}</div>`);
    }

    html.push(this.renderActions(context, buttonTexts, handlers));

    html.push('</div>');

    this.container.innerHTML = html.join('');
    this.bindEvents(context, handlers);
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

  private renderHeader(context: RenderContext): string {
    return `
      <div class="survey-sdk-header">
        <h2 class="survey-sdk-title">${this.escapeHtml(context.survey.meta.title)}</h2>
        ${context.survey.meta.description
          ? `<p class="survey-sdk-description">${this.escapeHtml(context.survey.meta.description)}</p>`
          : ''}
      </div>
    `;
  }

  private renderProgress(context: RenderContext): string {
    const rate = context.completionRate;
    const percent = Math.round(rate.rate * 100);
    const currentDisplay = context.currentQuestionIndex + 1;
    const total = context.totalQuestions;

    return `
      <div class="survey-sdk-progress-text">
        进度：${currentDisplay}/${total} 题 &middot; 完成度 ${percent}%
      </div>
      <div class="survey-sdk-progress-bar">
        <div class="survey-sdk-progress-fill" style="width: ${percent}%"></div>
      </div>
    `;
  }

  private renderQuestionCard(
    question: Question,
    context: RenderContext
  ): string {
    const html: string[] = [];
    html.push('<div class="survey-sdk-question-card">');

    if (context.showQuestionIndex) {
      html.push(
        `<span class="survey-sdk-question-index">第 ${context.currentQuestionIndex + 1} 题</span>`
      );
    }

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

  private renderQuestionBody(question: Question, answer: Answer | undefined): string {
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
          <label class="survey-sdk-option ${isSelected ? 'selected' : ''}" data-single-option data-value="${this.escapeAttr(val)}">
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
           </p>`
        : '';

    const optionsHtml = question.options
      .map((opt) => {
        const val = String(opt.value);
        const isSelected = selectedStr.includes(val);
        return `
          <label class="survey-sdk-option ${isSelected ? 'selected' : ''}" data-multi-option data-value="${this.escapeAttr(val)}">
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
                data-rating data-value="${val}">
          <span>${val}</span>
          ${label ? `<span class="survey-sdk-rating-label">${this.escapeHtml(label)}</span>` : ''}
        </button>
      `);
    }

    return `<div class="survey-sdk-rating-group">${buttons.join('')}</div>`;
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
                   data-text-input
                   ${question.maxLength ? `maxlength="${question.maxLength}"` : ''}
                   ${question.minLength ? `minlength="${question.minLength}"` : ''}
      >${this.escapeHtml(value)}</textarea>`
      : `<input type="text" 
                class="survey-sdk-text-input" 
                name="q_${question.id}" 
                value="${this.escapeAttr(value)}"
                placeholder="${this.escapeAttr(question.placeholder || '')}"
                data-text-input
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
    const isFirst = context.isFirstQuestion;
    const isLast = context.isLastQuestion;
    const canSubmit = context.status !== 'submitted';

    return `
      <div class="survey-sdk-actions">
        <div class="survey-sdk-actions-left">
          <button type="button" class="survey-sdk-btn survey-sdk-btn-secondary" data-action="save-draft" ${context.status === 'submitted' ? 'disabled' : ''}>
            ${this.escapeHtml(buttonTexts.saveDraft || '保存草稿')}
          </button>
        </div>
        <div class="survey-sdk-actions-right">
          <button type="button" class="survey-sdk-btn survey-sdk-btn-secondary" data-action="prev" ${isFirst ? 'disabled' : ''}>
            ${this.escapeHtml(buttonTexts.prev || '上一题')}
          </button>
          ${isLast
            ? `<button type="button" class="survey-sdk-btn survey-sdk-btn-success" data-action="submit" ${!canSubmit || this.submitting ? 'disabled' : ''}>
                 ${this.submitting ? '<span class="survey-sdk-loading"></span>' : ''}${this.escapeHtml(buttonTexts.submit || '提交问卷')}
               </button>`
            : `<button type="button" class="survey-sdk-btn survey-sdk-btn-primary" data-action="next">
                 ${this.escapeHtml(buttonTexts.next || '下一题')}
               </button>`
          }
        </div>
      </div>
    `;
  }

  private renderSuccessPage(
    context: RenderContext,
    handlers: RendererEventHandlers
  ): void {
    if (!this.container) return;

    const summary = StatisticsCalculator.generateResultSummary(
      context.survey,
      context.questions,
      context.answers
    );

    const buttonTexts = {
      ...DEFAULT_BUTTON_TEXTS,
      ...context.buttonTexts,
    };

    const summaryRows: string[] = [
      `<div class="survey-sdk-summary-row"><span class="survey-sdk-summary-label">总题数</span><span class="survey-sdk-summary-value">${summary.totalQuestions} 题</span></div>`,
      `<div class="survey-sdk-summary-row"><span class="survey-sdk-summary-label">已答</span><span class="survey-sdk-summary-value">${summary.answeredQuestions} 题</span></div>`,
      `<div class="survey-sdk-summary-row"><span class="survey-sdk-summary-label">完成率</span><span class="survey-sdk-summary-value">${Math.round(summary.completionRate * 100)}%</span></div>`,
    ];

    if (summary.averageScore !== undefined) {
      summaryRows.push(
        `<div class="survey-sdk-summary-row"><span class="survey-sdk-summary-label">平均得分</span><span class="survey-sdk-summary-value">${summary.averageScore.toFixed(1)} / ${(summary.maxScore! / (summary.totalScore ? summary.totalScore / summary.averageScore : 1)).toFixed(0)}</span></div>`
      );
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

    this.container.innerHTML = `
      <div class="survey-sdk-container">
        <div class="survey-sdk-success-page">
          <div class="survey-sdk-success-icon">✓</div>
          <h2 class="survey-sdk-success-title">问卷提交成功！</h2>
          <p class="survey-sdk-success-msg">感谢您的宝贵反馈，您的意见对我们非常重要。</p>
          
          <div class="survey-sdk-summary-card">
            ${summaryRows.join('')}
            ${highlights.length > 0 ? `<div style="margin-top:12px;">${highlights.join('')}</div>` : ''}
          </div>

          <button type="button" class="survey-sdk-btn survey-sdk-btn-primary" data-action="restart">
            ${this.escapeHtml(buttonTexts.restart || '重新开始')}
          </button>
        </div>
      </div>
    `;

    const restartBtn = this.container.querySelector('[data-action="restart"]');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => handlers.onRestart());
    }
  }

  private bindEvents(
    context: RenderContext,
    handlers: RendererEventHandlers
  ): void {
    if (!this.container) return;

    const question = context.questions[context.currentQuestionIndex];
    if (!question) return;

    const singleOptions = this.container.querySelectorAll(
      '[data-single-option]'
    );
    singleOptions.forEach((el) => {
      el.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const value = target.getAttribute('data-value')!;
        handlers.onAnswer(question.id, value);
      });
    });

    const multiOptions = this.container.querySelectorAll(
      '[data-multi-option]'
    );
    multiOptions.forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const target = e.currentTarget as HTMLElement;
        const value = target.getAttribute('data-value')!;
        const input = target.querySelector('input') as HTMLInputElement;
        const isChecked = input.checked;

        const current = context.answers[question.id]?.value;
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

        handlers.onAnswer(question.id, currentArr);
      });
    });

    const ratingBtns = this.container.querySelectorAll('[data-rating]');
    ratingBtns.forEach((el) => {
      el.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        const value = Number(target.getAttribute('data-value'));
        handlers.onAnswer(question.id, value);
      });
    });

    const textInput = this.container.querySelector(
      '[data-text-input]'
    ) as HTMLInputElement | HTMLTextAreaElement | null;
    if (textInput) {
      const handler = (e: Event) => {
        const target = e.target as HTMLInputElement | HTMLTextAreaElement;
        handlers.onAnswer(question.id, target.value);
      };
      textInput.addEventListener('input', handler);
      textInput.addEventListener('change', handler);
    }

    const prevBtn = this.container.querySelector('[data-action="prev"]');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => handlers.onPrev());
    }

    const nextBtn = this.container.querySelector('[data-action="next"]');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => handlers.onNext());
    }

    const submitBtn = this.container.querySelector('[data-action="submit"]');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => handlers.onSubmit());
    }

    const saveDraftBtn = this.container.querySelector(
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
