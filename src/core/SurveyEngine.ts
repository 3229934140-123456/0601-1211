import type {
  Survey,
  Question,
  Answer,
  AnswerValue,
  AnswersMap,
  SurveyProgress,
  SurveyStatus,
  UserContext,
  ValidationResult,
} from '../types';
import { SkipLogicEvaluator } from './SkipLogicEvaluator';
import { AnswerValidator } from './AnswerValidator';

export class SurveyEngine {
  private survey: Survey;
  private questions: Question[];
  private visibleQuestions: Question[];
  private answers: AnswersMap = {};
  private currentIndex: number = 0;
  private status: SurveyStatus = 'not_started';
  private user: UserContext | null = null;
  private startedAt: number = Date.now();

  private skipEvaluator: SkipLogicEvaluator;
  private validator: AnswerValidator;
  private updateCallbacks: Array<() => void> = [];

  constructor(survey: Survey) {
    this.survey = survey;
    this.questions = [...survey.questions].sort((a, b) => a.order - b.order);
    this.visibleQuestions = [...this.questions];
    this.skipEvaluator = new SkipLogicEvaluator();
    this.validator = new AnswerValidator();
  }

  setUser(user: UserContext): void {
    this.user = user;
  }

  getUser(): UserContext | null {
    return this.user;
  }

  getSurvey(): Survey {
    return this.survey;
  }

  getQuestions(): Question[] {
    return this.visibleQuestions;
  }

  getAllQuestions(): Question[] {
    return this.questions;
  }

  getCurrentQuestion(): Question | null {
    return this.visibleQuestions[this.currentIndex] || null;
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  getTotalQuestions(): number {
    return this.visibleQuestions.length;
  }

  getAnswers(): AnswersMap {
    return { ...this.answers };
  }

  getAnswer(questionId: string): Answer | undefined {
    return this.answers[questionId];
  }

  getStatus(): SurveyStatus {
    return this.status;
  }

  setAnswer(questionId: string, value: AnswerValue): void {
    const question = this.findQuestion(questionId);
    if (!question) return;

    this.answers[questionId] = {
      questionId,
      value,
      timestamp: Date.now(),
    };

    if (this.status === 'not_started') {
      this.status = 'in_progress';
    }

    this.reevaluateVisibleQuestions();
    this.notifyUpdate();
  }

  setAnswers(answers: AnswersMap): void {
    this.answers = { ...answers };
    this.reevaluateVisibleQuestions();
    if (this.status === 'not_started') {
      this.status = 'in_progress';
    }
    this.notifyUpdate();
  }

  goToQuestion(questionId: string): boolean {
    const index = this.visibleQuestions.findIndex((q) => q.id === questionId);
    if (index === -1) return false;
    this.currentIndex = index;
    this.notifyUpdate();
    return true;
  }

  next(): boolean {
    const current = this.getCurrentQuestion();
    if (!current) return false;

    const validation = this.validateCurrent();
    if (!validation.valid) {
      return false;
    }

    const skippedTarget = this.evaluateSkipTarget(current);
    if (skippedTarget) {
      if (skippedTarget === 'END') {
        this.notifyUpdate();
        return true;
      }
      const success = this.goToQuestion(skippedTarget);
      if (success) return true;
    }

    if (this.currentIndex < this.visibleQuestions.length - 1) {
      this.currentIndex++;
      this.notifyUpdate();
      return true;
    }
    return false;
  }

  prev(): boolean {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.notifyUpdate();
      return true;
    }
    return false;
  }

  isFirstQuestion(): boolean {
    return this.currentIndex === 0;
  }

  isLastQuestion(): boolean {
    const current = this.getCurrentQuestion();
    if (!current) return true;

    if (this.evaluateSkipTarget(current) === 'END') {
      return true;
    }

    return this.currentIndex >= this.visibleQuestions.length - 1;
  }

  isAtEnd(): boolean {
    return this.currentIndex >= this.visibleQuestions.length;
  }

  validateCurrent(): ValidationResult {
    const question = this.getCurrentQuestion();
    if (!question) return { valid: true };
    return this.validator.validateQuestion(
      question,
      this.answers[question.id]
    );
  }

  validateAll(): ValidationResult {
    return this.validator.validateAll(this.visibleQuestions, this.answers);
  }

  validateQuestion(questionId: string): ValidationResult {
    const question = this.findQuestion(questionId);
    if (!question) return { valid: true };
    return this.validator.validateQuestion(
      question,
      this.answers[questionId]
    );
  }

  getProgress(): SurveyProgress {
    return {
      surveyId: this.survey.meta.id,
      user: this.user,
      answers: { ...this.answers },
      currentQuestionIndex: this.currentIndex,
      startedAt: this.startedAt,
      lastSavedAt: Date.now(),
      status: this.status,
    };
  }

  loadProgress(progress: SurveyProgress): void {
    if (progress.surveyId !== this.survey.meta.id) {
      console.warn('[SurveyEngine] Survey ID mismatch when loading progress');
      return;
    }
    this.answers = { ...progress.answers };
    this.currentIndex = progress.currentQuestionIndex;
    this.startedAt = progress.startedAt;
    this.status = progress.status;
    this.user = progress.user;
    this.reevaluateVisibleQuestions();
    this.notifyUpdate();
  }

  setStatus(status: SurveyStatus): void {
    this.status = status;
  }

  reset(): void {
    this.answers = {};
    this.currentIndex = 0;
    this.status = 'not_started';
    this.startedAt = Date.now();
    this.visibleQuestions = [...this.questions];
    this.notifyUpdate();
  }

  getStartedAt(): number {
    return this.startedAt;
  }

  getDuration(): number {
    return Date.now() - this.startedAt;
  }

  onUpdate(callback: () => void): () => void {
    this.updateCallbacks.push(callback);
    return () => {
      this.updateCallbacks = this.updateCallbacks.filter((c) => c !== callback);
    };
  }

  private notifyUpdate(): void {
    for (const cb of this.updateCallbacks) {
      try {
        cb();
      } catch (e) {
        console.error('[SurveyEngine] Update callback error:', e);
      }
    }
  }

  private findQuestion(questionId: string): Question | undefined {
    return this.questions.find((q) => q.id === questionId);
  }

  private reevaluateVisibleQuestions(): void {
    const visible: Question[] = [];
    let skipUntil: string | null = null;

    for (const question of this.questions) {
      if (skipUntil) {
        if (question.id === skipUntil) {
          skipUntil = null;
        } else {
          continue;
        }
      }

      visible.push(question);

      const answer = this.answers[question.id];
      if (question.skipLogic && question.skipLogic.length > 0 && answer) {
        const target = this.skipEvaluator.evaluateSkipLogic(
          question.skipLogic,
          this.answers
        );
        if (target && target !== 'END') {
          skipUntil = target;
        }
      }
    }

    this.visibleQuestions = visible;

    if (this.currentIndex >= this.visibleQuestions.length) {
      this.currentIndex = Math.max(0, this.visibleQuestions.length - 1);
    }
  }

  private evaluateSkipTarget(question: Question): string | null {
    if (!question.skipLogic || question.skipLogic.length === 0) {
      return null;
    }
    const answer = this.answers[question.id];
    if (!answer) return null;
    return this.skipEvaluator.evaluateSkipLogic(
      question.skipLogic,
      this.answers
    );
  }
}
