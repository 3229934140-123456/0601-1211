export type QuestionType = 'single' | 'multiple' | 'rating' | 'text';

export interface QuestionOption {
  id: string;
  label: string;
  value: string | number;
}

export interface SkipCondition {
  questionId: string;
  operator: 'eq' | 'ne' | 'in' | 'notIn' | 'gt' | 'gte' | 'lt' | 'lte';
  value: string | number | (string | number)[];
}

export interface SkipLogic {
  conditions: SkipCondition[];
  logic?: 'AND' | 'OR';
  targetQuestionId: string | 'END';
}

export interface BaseQuestion {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  required?: boolean;
  order: number;
  skipLogic?: SkipLogic[];
}

export interface SingleChoiceQuestion extends BaseQuestion {
  type: 'single';
  options: QuestionOption[];
}

export interface MultipleChoiceQuestion extends BaseQuestion {
  type: 'multiple';
  options: QuestionOption[];
  minSelect?: number;
  maxSelect?: number;
}

export interface RatingQuestion extends BaseQuestion {
  type: 'rating';
  minValue: number;
  maxValue: number;
  step?: number;
  labels?: { value: number; label: string }[];
}

export interface TextQuestion extends BaseQuestion {
  type: 'text';
  placeholder?: string;
  maxLength?: number;
  minLength?: number;
  multiline?: boolean;
}

export type Question =
  | SingleChoiceQuestion
  | MultipleChoiceQuestion
  | RatingQuestion
  | TextQuestion;

export interface SurveyMeta {
  id: string;
  title: string;
  description?: string;
  version?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Survey {
  meta: SurveyMeta;
  questions: Question[];
}

export type AnswerValue =
  | string
  | number
  | (string | number)[]
  | null
  | undefined;

export interface Answer {
  questionId: string;
  value: AnswerValue;
  timestamp: number;
}

export type AnswersMap = Record<string, Answer>;

export interface UserContext {
  userId: string | number;
  username?: string;
  department?: string;
  [key: string]: unknown;
}

export interface SubmitPayload {
  surveyId: string;
  surveyVersion?: string;
  user: UserContext;
  answers: AnswersMap;
  submittedAt: number;
  duration?: number;
}

export interface SubmitResult {
  success: boolean;
  submissionId?: string;
  message?: string;
  timestamp?: number;
}

export interface ButtonTexts {
  prev?: string;
  next?: string;
  submit?: string;
  restart?: string;
  saveDraft?: string;
}

export interface RenderConfig {
  showProgress?: boolean;
  showQuestionIndex?: boolean;
  buttonTexts?: ButtonTexts;
  theme?: 'light' | 'dark' | 'auto';
  customClass?: string;
}

export interface SDKConfig {
  autoSave?: boolean;
  autoSaveInterval?: number;
  storageKeyPrefix?: string;
  submitUrl?: string;
  enableLogging?: boolean;
  renderConfig?: RenderConfig;
  startFromSavedProgress?: boolean;
}

export type SurveyStatus =
  | 'not_started'
  | 'in_progress'
  | 'draft_saved'
  | 'submitted'
  | 'error';

export interface SurveyProgress {
  surveyId: string;
  user: UserContext | null;
  answers: AnswersMap;
  currentQuestionIndex: number;
  startedAt: number;
  lastSavedAt?: number;
  status: SurveyStatus;
}

export interface ValidationResult {
  valid: boolean;
  questionId?: string;
  errorMessage?: string;
}

export interface CompletionRate {
  totalQuestions: number;
  answeredQuestions: number;
  skippedQuestions: number;
  rate: number;
}

export interface QuestionStatistics {
  questionId: string;
  questionTitle: string;
  type: QuestionType;
  totalResponses: number;
  optionCounts?: Record<string, number>;
  averageScore?: number;
  textResponses?: string[];
}

export interface ResultSummary {
  surveyId: string;
  surveyTitle: string;
  totalQuestions: number;
  answeredQuestions: number;
  completionRate: number;
  averageScore?: number;
  totalScore?: number;
  maxScore?: number;
  highlights: {
    highestRated?: { questionId: string; title: string; score: number };
    lowestRated?: { questionId: string; title: string; score: number };
  };
  submissionTime?: string;
}

export type SurveyEventName =
  | 'start'
  | 'questionAnswer'
  | 'questionChange'
  | 'validateError'
  | 'draftSaved'
  | 'draftLoaded'
  | 'submit'
  | 'submitSuccess'
  | 'submitError'
  | 'complete'
  | 'restart';

export interface SurveyEventMap {
  start: { surveyId: string; user: UserContext | null };
  questionAnswer: { questionId: string; value: AnswerValue; answers: AnswersMap };
  questionChange: { fromIndex: number; toIndex: number; questionId: string };
  validateError: { questionId: string; errorMessage: string };
  draftSaved: { progress: SurveyProgress };
  draftLoaded: { progress: SurveyProgress };
  submit: { payload: SubmitPayload };
  submitSuccess: { result: SubmitResult };
  submitError: { error: Error };
  complete: {
    answers: AnswersMap;
    summary: ResultSummary;
    result: SubmitResult;
  };
  restart: { surveyId: string };
}

export interface RendererEventHandlers {
  onAnswer: (questionId: string, value: AnswerValue) => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onSaveDraft: () => void;
  onRestart: () => void;
}

export interface RenderContext {
  survey: Survey;
  questions: Question[];
  currentQuestionIndex: number;
  totalQuestions: number;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  answers: AnswersMap;
  completionRate: CompletionRate;
  buttonTexts: ButtonTexts;
  showProgress: boolean;
  showQuestionIndex: boolean;
  status: SurveyStatus;
}

export interface SurveyRenderer {
  mount(container: HTMLElement): void;
  render(context: RenderContext, handlers: RendererEventHandlers): void;
  unmount(): void;
  setError?(error: string | null): void;
  setSubmitting?(value: boolean): void;
}
