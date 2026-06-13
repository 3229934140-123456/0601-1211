export type QuestionType = 'single' | 'multiple' | 'rating' | 'text';

export type DisplayMode = 'single' | 'all';

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
  summary?: RichResultSummary;
}

export interface ButtonTexts {
  prev?: string;
  next?: string;
  submit?: string;
  restart?: string;
  saveDraft?: string;
  toggleMode?: string;
}

export interface RenderConfig {
  showProgress?: boolean;
  showQuestionIndex?: boolean;
  buttonTexts?: ButtonTexts;
  theme?: 'light' | 'dark' | 'auto';
  customClass?: string;
  displayMode?: DisplayMode;
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
  displayMode?: DisplayMode;
  completionRate?: CompletionRate;
  answeredCount?: number;
  totalCount?: number;
}

export interface ValidationResult {
  valid: boolean;
  questionId?: string;
  errorMessage?: string;
  invalidQuestionIds?: string[];
}

export interface CompletionRate {
  totalQuestions: number;
  answeredQuestions: number;
  skippedQuestions: number;
  requiredTotal: number;
  requiredAnswered: number;
  rate: number;
}

export interface OptionDistributionItem {
  value: string;
  label: string;
  count: number;
  percentage: number;
  selected: boolean;
}

export interface OptionDistribution {
  questionId: string;
  questionTitle: string;
  type: 'single' | 'multiple';
  totalResponses: number;
  items: OptionDistributionItem[];
  otherCount?: number;
}

export interface TextSummaryItem {
  value: string;
  length: number;
}

export interface TextSummary {
  questionId: string;
  questionTitle: string;
  totalResponses: number;
  items: TextSummaryItem[];
  totalLength: number;
  averageLength: number;
  keywords: string[];
}

export interface RatingOverviewItem {
  questionId: string;
  questionTitle: string;
  minValue: number;
  maxValue: number;
  averageScore: number;
  median: number;
  distribution: Record<number, number>;
  scoreBucket: 'poor' | 'fair' | 'good' | 'excellent';
}

export interface RatingOverview {
  totalRatingQuestions: number;
  averageScore: number;
  totalScore: number;
  maxScore: number;
  weightedAverage: number;
  items: RatingOverviewItem[];
  netPromoterScore?: number;
}

export interface QuestionStatistics {
  questionId: string;
  questionTitle: string;
  type: QuestionType;
  totalResponses: number;
  required: boolean;
  hasAnswer: boolean;
  optionCounts?: Record<string, number>;
  optionDistribution?: OptionDistribution;
  averageScore?: number;
  ratingDetail?: RatingOverviewItem;
  textResponses?: string[];
  textSummary?: TextSummary;
}

export interface ResultSummary {
  surveyId: string;
  surveyTitle: string;
  surveyVersion?: string;
  totalQuestions: number;
  answeredQuestions: number;
  requiredTotal: number;
  requiredAnswered: number;
  completionRate: number;
  averageScore?: number;
  totalScore?: number;
  maxScore?: number;
  highlights: {
    highestRated?: { questionId: string; title: string; score: number };
    lowestRated?: { questionId: string; title: string; score: number };
  };
  submissionTime?: string;
  durationSeconds?: number;
}

export interface RichResultSummary extends ResultSummary {
  optionDistributions: OptionDistribution[];
  textSummaries: TextSummary[];
  ratingOverview: RatingOverview;
  questionCountByType: {
    single: number;
    multiple: number;
    rating: number;
    text: number;
  };
  answeredIds: string[];
  unansweredIds: string[];
  invalidIds: string[];
  userSnapshot?: UserContext;
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
  | 'restart'
  | 'displayModeChange';

export interface SurveyEventMap {
  start: { surveyId: string; user: UserContext | null };
  questionAnswer: { questionId: string; value: AnswerValue; answers: AnswersMap };
  questionChange: { fromIndex: number; toIndex: number; questionId: string };
  validateError: {
    questionId: string;
    errorMessage: string;
    invalidQuestionIds?: string[];
  };
  draftSaved: {
    progress: SurveyProgress;
    storageKey: string;
    answeredCount: number;
    totalCount: number;
    completionRate: number;
    status: SurveyStatus;
  };
  draftLoaded: {
    progress: SurveyProgress;
    storageKey: string;
    answeredCount: number;
    totalCount: number;
    completionRate: number;
    status: SurveyStatus;
    resumedFromIndex: number;
  };
  submit: { payload: SubmitPayload };
  submitSuccess: { result: SubmitResult; summary: RichResultSummary };
  submitError: { error: Error };
  complete: {
    answers: AnswersMap;
    summary: RichResultSummary;
    result: SubmitResult;
    statistics: QuestionStatistics[];
  };
  restart: { surveyId: string };
  displayModeChange: {
    from: DisplayMode;
    to: DisplayMode;
  };
}

export interface RendererEventHandlers {
  onAnswer: (questionId: string, value: AnswerValue) => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onSaveDraft: () => void;
  onRestart: () => void;
  onToggleMode?: () => void;
  onJumpToQuestion?: (questionId: string) => void;
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
  displayMode: DisplayMode;
  invalidQuestionIds?: string[];
  highlightQuestionId?: string;
}

export interface SurveyRenderer {
  mount(container: HTMLElement): void;
  render(context: RenderContext, handlers: RendererEventHandlers): void;
  unmount(): void;
  setError?(error: string | null): void;
  setSubmitting?(value: boolean): void;
  setHighlightQuestionId?(id: string | null): void;
  setInvalidQuestionIds?(ids: string[]): void;
  setDisplayMode?(mode: DisplayMode): void;
}

export interface SubmitAdapter {
  submit(payload: SubmitPayload): Promise<SubmitResult>;
}
