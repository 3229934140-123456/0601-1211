import type { SurveyProgress, UserContext } from '../types';

export class ProgressStorage {
  private prefix: string;

  constructor(prefix: string = 'survey_sdk') {
    this.prefix = prefix;
  }

  getStorageKey(surveyId: string, user: UserContext | null): string {
    const userId = user ? String(user.userId) : 'anonymous';
    return `${this.prefix}:${surveyId}:${userId}`;
  }

  save(progress: SurveyProgress): boolean {
    try {
      if (!this.isAvailable()) return false;
      const key = this.getStorageKey(progress.surveyId, progress.user);
      const data = JSON.stringify(progress);
      localStorage.setItem(key, data);
      return true;
    } catch (e) {
      console.error('[ProgressStorage] Save failed:', e);
      return false;
    }
  }

  saveAndReturnMeta(progress: SurveyProgress): {
    success: boolean;
    key: string;
    answeredCount: number;
    totalCount: number;
    completionRate: number;
    status: SurveyProgress['status'];
    savedAt: number;
  } {
    const success = this.save(progress);
    const key = this.getStorageKey(progress.surveyId, progress.user);
    const answeredCount = progress.answeredCount ?? Object.keys(progress.answers).length;
    const totalCount = progress.totalCount ?? progress.completionRate?.totalQuestions ?? 0;
    const completionRate =
      progress.completionRate?.rate ??
      (totalCount > 0 ? answeredCount / totalCount : 0);
    return {
      success,
      key,
      answeredCount,
      totalCount,
      completionRate,
      status: progress.status,
      savedAt: progress.lastSavedAt || Date.now(),
    };
  }

  load(
    surveyId: string,
    user: UserContext | null
  ): SurveyProgress | null {
    try {
      if (!this.isAvailable()) return null;
      const key = this.getStorageKey(surveyId, user);
      const data = localStorage.getItem(key);
      if (!data) return null;
      return JSON.parse(data) as SurveyProgress;
    } catch (e) {
      console.error('[ProgressStorage] Load failed:', e);
      return null;
    }
  }

  loadAndReturnMeta(surveyId: string, user: UserContext | null) {
    const progress = this.load(surveyId, user);
    const key = this.getStorageKey(surveyId, user);
    if (!progress) return { progress: null as SurveyProgress | null, key, answeredCount: 0, totalCount: 0, completionRate: 0, status: 'not_started' as const, resumedFromIndex: 0 };
    const answeredCount = progress.answeredCount ?? Object.keys(progress.answers).length;
    const totalCount = progress.totalCount ?? progress.completionRate?.totalQuestions ?? 0;
    const completionRate =
      progress.completionRate?.rate ??
      (totalCount > 0 ? answeredCount / totalCount : 0);
    return {
      progress,
      key,
      answeredCount,
      totalCount,
      completionRate,
      status: progress.status,
      resumedFromIndex: progress.currentQuestionIndex,
    };
  }

  clear(surveyId: string, user: UserContext | null): boolean {
    try {
      if (!this.isAvailable()) return false;
      const key = this.getStorageKey(surveyId, user);
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      console.error('[ProgressStorage] Clear failed:', e);
      return false;
    }
  }

  exists(surveyId: string, user: UserContext | null): boolean {
    return this.load(surveyId, user) !== null;
  }

  isAvailable(): boolean {
    try {
      const test = '__survey_sdk_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }
}
