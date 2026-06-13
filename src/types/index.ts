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
  successPageConfig?: Partial<SuccessPageConfig>;
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
  | 'displayModeChange'
  | 'close';

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
  close: Record<string, never>;
}

export interface RendererEventHandlers {
  onAnswer: (questionId: string, value: AnswerValue) => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onSaveDraft: () => void;
  onRestart: () => void;
  onClose?: () => void;
  onSetMode?: (mode: DisplayMode) => void;
  onToggleMode?: () => void;
  onJumpToQuestion?: (questionId: string) => void;
}

export interface ToolbarState {
  surveyId: string;
  status: SurveyStatus;
  displayMode: DisplayMode;
  currentQuestionIndex: number;
  totalQuestions: number;
  completionRate: number;
  answeredCount: number;
  requiredTotal: number;
  requiredAnswered: number;
  requiredUnansweredCount: number;
  invalidQuestionIds: string[];
  draftSavedAt?: number;
}

export type SuccessCardType =
  | 'completion'
  | 'score'
  | 'rating'
  | 'options'
  | 'texts'
  | 'keywords'
  | 'duration'
  | 'submissionId';

export interface SuccessPageButtonConfig {
  label: string;
  type?: 'primary' | 'secondary' | 'ghost';
  icon?: string;
  action: 'restart' | 'close' | 'navigate' | 'custom';
  navigateUrl?: string;
  customHandler?: () => void;
}

export interface SuccessPageConfig {
  showTitle?: boolean;
  title?: string;
  subtitle?: string;
  icon?: string;
  cards: SuccessCardType[];
  buttons: SuccessPageButtonConfig[];
  showRestartButton?: boolean;
  showBackButton?: boolean;
  backLabel?: string;
  onBack?: () => void;
}

export interface ComparisonGroup {
  id: string;
  label: string;
  summary: RichResultSummary;
  meta?: Record<string, unknown>;
}

export interface ComparisonMetric {
  key: string;
  label: string;
  values: { groupId: string; value: number | string | null; delta?: number }[];
  winner?: string;
}

export interface SurveyComparisonResult {
  groups: ComparisonGroup[];
  completionRates: ComparisonMetric;
  averageScores: ComparisonMetric;
  weightedAverages: ComparisonMetric;
  netPromoterScores?: ComparisonMetric;
  requiredCompletionRates: ComparisonMetric;
  durationSeconds?: ComparisonMetric;
  optionDistributionMap: Record<string, ComparisonMetric>;
  keywordsMap: Record<string, {
    groupId: string;
    keywords: string[];
    common: string[];
    unique: string[];
  }[]>;
  overallBestGroup?: string;
  overallWorstGroup?: string;
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
  submissionId?: string;
  durationSeconds?: number;
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

export interface SubmissionRecord {
  submissionId: string;
  surveyId: string;
  surveyVersion?: string;
  user: UserContext;
  answers: AnswersMap;
  submittedAt: number;
  durationSeconds?: number;
  summary: RichResultSummary;
}

export type GroupDimension = 'department' | 'timePeriod' | 'version' | 'custom';

export interface AutoGroupResult {
  dimension: GroupDimension;
  groups: { key: string; label: string; records: SubmissionRecord[] }[];
}

export interface TrendPoint {
  period: string;
  value: number;
  count: number;
}

export interface TrendResult {
  metric: string;
  label: string;
  points: TrendPoint[];
  direction: 'up' | 'down' | 'stable';
  changeRate: number;
}

export interface KeywordChangeResult {
  questionId: string;
  questionTitle: string;
  periods: {
    period: string;
    keywords: string[];
    emerging: string[];
    declining: string[];
  }[];
}

export interface WeeklyReportResult {
  surveyId: string;
  generatedAt: number;
  period: { start: string; end: string };
  totalSubmissions: number;
  groupSummaries: { key: string; label: string; completionRate: number; averageScore: number | null; count: number }[];
  trends: TrendResult[];
  keywordChanges: KeywordChangeResult[];
  comparison: SurveyComparisonResult | null;
  highlights: string[];
}

export interface ToolbarSyncState extends ToolbarState {
  lastEvent: string;
  lastEventAt: number;
  isSubmitting: boolean;
  lastSubmitResult: SubmitResult | null;
  lastRichSummary: RichResultSummary | null;
}

export type ToolbarSyncEventType =
  | 'stateChange'
  | 'answerUpdate'
  | 'modeChange'
  | 'draftSave'
  | 'submitStart'
  | 'submitComplete'
  | 'validationUpdate';

export interface ToolbarSyncSubscription {
  id: string;
  callback: (state: ToolbarSyncState, event: ToolbarSyncEventType) => void;
  events?: ToolbarSyncEventType[];
}

export interface ResultBlock {
  id: string;
  type: 'completion' | 'score' | 'rating' | 'options' | 'texts' | 'keywords' | 'duration' | 'submissionId' | 'custom';
  title?: string;
  visible?: boolean;
  order?: number;
  customRenderer?: (data: SubmissionResultContext, container: HTMLElement) => void;
}

export interface SubmissionResultContext {
  submissionId: string;
  submittedAt: number;
  durationSeconds?: number;
  surveyId: string;
  surveyTitle: string;
  surveyVersion?: string;
  user: UserContext | null;
  answers: AnswersMap;
  summary: RichResultSummary;
  customFields: Record<string, unknown>;
}

export interface ResultCenterConfig {
  blocks: ResultBlock[];
  customFields?: Record<string, (ctx: SubmissionResultContext) => unknown>;
  secondaryActions?: ResultCenterAction[];
}

export interface ResultCenterAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'ghost';
  icon?: string;
  handler: (ctx: SubmissionResultContext) => void;
}

export interface ResultCenterSnapshot {
  context: SubmissionResultContext;
  renderedAt: number;
  source: 'completionPage' | 'detailDrawer' | 'listCard';
}
