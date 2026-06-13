import type { SurveyProgress, UserContext } from '../types';

export class ProgressStorage {
  private prefix: string;

  constructor(prefix: string = 'survey_sdk') {
    this.prefix = prefix;
  }

  private getStorageKey(surveyId: string, user: UserContext | null): string {
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
