import type {
  SkipCondition,
  SkipLogic,
  Answer,
  AnswerValue,
  AnswersMap,
} from '../types';

export class SkipLogicEvaluator {
  evaluateCondition(
    condition: SkipCondition,
    answers: AnswersMap
  ): boolean {
    const answer = answers[condition.questionId];
    if (!answer) return false;

    const answerValue = this.normalizeValue(answer.value);
    const conditionValue = this.normalizeValue(condition.value);

    switch (condition.operator) {
      case 'eq':
        return this.valuesEqual(answerValue, conditionValue);
      case 'ne':
        return !this.valuesEqual(answerValue, conditionValue);
      case 'in':
        return this.containsAny(answerValue, conditionValue);
      case 'notIn':
        return !this.containsAny(answerValue, conditionValue);
      case 'gt':
        return this.compareNumbers(answerValue, conditionValue, '>');
      case 'gte':
        return this.compareNumbers(answerValue, conditionValue, '>=');
      case 'lt':
        return this.compareNumbers(answerValue, conditionValue, '<');
      case 'lte':
        return this.compareNumbers(answerValue, conditionValue, '<=');
      default:
        return false;
    }
  }

  evaluateSkipLogic(
    skipLogics: SkipLogic[],
    answers: AnswersMap
  ): string | null {
    for (const logic of skipLogics) {
      const logicType = logic.logic || 'AND';
      const conditionResults = logic.conditions.map((c) =>
        this.evaluateCondition(c, answers)
      );

      const conditionMet =
        logicType === 'AND'
          ? conditionResults.every((r) => r)
          : conditionResults.some((r) => r);

      if (conditionMet) {
        return logic.targetQuestionId;
      }
    }
    return null;
  }

  private normalizeValue(v: AnswerValue): unknown {
    if (v === null || v === undefined) return undefined;
    if (Array.isArray(v)) {
      return v.map((item) =>
        typeof item === 'number' ? item : String(item)
      );
    }
    return typeof v === 'number' ? v : String(v);
  }

  private valuesEqual(a: unknown, b: unknown): boolean {
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      const sortedA = [...a].sort();
      const sortedB = [...b].sort();
      return sortedA.every((item, idx) => item === sortedB[idx]);
    }
    if (Array.isArray(a) && !Array.isArray(b)) {
      return a.includes(b);
    }
    if (!Array.isArray(a) && Array.isArray(b)) {
      return b.includes(a);
    }
    return a === b;
  }

  private containsAny(answer: unknown, target: unknown): boolean {
    const targetArr = Array.isArray(target) ? target : [target];
    if (Array.isArray(answer)) {
      return answer.some((item) => targetArr.includes(item));
    }
    return targetArr.includes(answer);
  }

  private compareNumbers(
    a: unknown,
    b: unknown,
    op: '>' | '>=' | '<' | '<='
  ): boolean {
    const numA = this.toNumber(a);
    const numB = this.toNumber(b);
    if (numA === null || numB === null) return false;
    switch (op) {
      case '>':
        return numA > numB;
      case '>=':
        return numA >= numB;
      case '<':
        return numA < numB;
      case '<=':
        return numA <= numB;
    }
  }

  private toNumber(v: unknown): number | null {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
      const parsed = Number(v);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  }
}
