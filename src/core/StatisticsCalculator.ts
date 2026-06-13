import type {
  Survey,
  Question,
  Answer,
  AnswersMap,
  CompletionRate,
  QuestionStatistics,
  ResultSummary,
  RatingQuestion,
  MultipleChoiceQuestion,
  SingleChoiceQuestion,
} from '../types';

export class StatisticsCalculator {
  static getCompletionRate(
    survey: Survey,
    questions: Question[],
    answers: AnswersMap
  ): CompletionRate {
    let answered = 0;
    let skipped = 0;
    const total = questions.length;

    for (const question of questions) {
      const answer = answers[question.id];
      if (this.isAnswered(answer)) {
        answered++;
      } else {
        skipped++;
      }
    }

    return {
      totalQuestions: total,
      answeredQuestions: answered,
      skippedQuestions: skipped,
      rate: total > 0 ? answered / total : 0,
    };
  }

  static getQuestionAverageScore(
    question: Question,
    answers: AnswersMap
  ): number | null {
    if (question.type !== 'rating') {
      return null;
    }

    const rating = question as RatingQuestion;
    const answer = answers[question.id];
    if (!answer || answer.value === null || answer.value === undefined) {
      return null;
    }

    const value = Number(answer.value);
    if (isNaN(value)) return null;

    return value;
  }

  static getAverageScore(
    questions: Question[],
    answers: AnswersMap
  ): { average: number; total: number; max: number; count: number } {
    let totalScore = 0;
    let maxScore = 0;
    let count = 0;

    for (const question of questions) {
      if (question.type === 'rating') {
        const rating = question as RatingQuestion;
        const avg = this.getQuestionAverageScore(question, answers);
        if (avg !== null) {
          totalScore += avg;
          maxScore += rating.maxValue;
          count++;
        }
      }
    }

    return {
      average: count > 0 ? totalScore / count : 0,
      total: totalScore,
      max: maxScore,
      count,
    };
  }

  static getQuestionStatistics(
    question: Question,
    answers: AnswersMap
  ): QuestionStatistics {
    const base: QuestionStatistics = {
      questionId: question.id,
      questionTitle: question.title,
      type: question.type,
      totalResponses: 0,
    };

    const answer = answers[question.id];
    if (!this.isAnswered(answer)) {
      return base;
    }

    base.totalResponses = 1;

    switch (question.type) {
      case 'single': {
        const singleQ = question as SingleChoiceQuestion;
        const counts: Record<string, number> = {};
        for (const opt of singleQ.options) {
          counts[String(opt.value)] = 0;
        }
        const val = answer!.value;
        if (val !== null && val !== undefined) {
          counts[String(val)] = 1;
        }
        base.optionCounts = counts;
        break;
      }
      case 'multiple': {
        const multiQ = question as MultipleChoiceQuestion;
        const counts: Record<string, number> = {};
        for (const opt of multiQ.options) {
          counts[String(opt.value)] = 0;
        }
        const val = answer!.value;
        if (Array.isArray(val)) {
          for (const v of val) {
            counts[String(v)] = 1;
          }
        }
        base.optionCounts = counts;
        break;
      }
      case 'rating': {
        const avg = this.getQuestionAverageScore(question, answers);
        base.averageScore = avg ?? undefined;
        break;
      }
      case 'text': {
        const textVal = answer!.value;
        if (typeof textVal === 'string' && textVal.trim()) {
          base.textResponses = [textVal.trim()];
        }
        break;
      }
    }

    return base;
  }

  static getAllStatistics(
    survey: Survey,
    questions: Question[],
    answers: AnswersMap
  ): QuestionStatistics[] {
    return questions.map((q) => this.getQuestionStatistics(q, answers));
  }

  static generateResultSummary(
    survey: Survey,
    questions: Question[],
    answers: AnswersMap
  ): ResultSummary {
    const completion = this.getCompletionRate(survey, questions, answers);
    const scoreInfo = this.getAverageScore(questions, answers);

    const ratingQuestions = questions.filter(
      (q) => q.type === 'rating'
    ) as RatingQuestion[];

    let highestRated:
      | { questionId: string; title: string; score: number }
      | undefined;
    let lowestRated:
      | { questionId: string; title: string; score: number }
      | undefined;

    for (const rq of ratingQuestions) {
      const score = this.getQuestionAverageScore(rq, answers);
      if (score !== null) {
        if (!highestRated || score > highestRated.score) {
          highestRated = { questionId: rq.id, title: rq.title, score };
        }
        if (!lowestRated || score < lowestRated.score) {
          lowestRated = { questionId: rq.id, title: rq.title, score };
        }
      }
    }

    return {
      surveyId: survey.meta.id,
      surveyTitle: survey.meta.title,
      totalQuestions: completion.totalQuestions,
      answeredQuestions: completion.answeredQuestions,
      completionRate: completion.rate,
      averageScore: scoreInfo.count > 0 ? scoreInfo.average : undefined,
      totalScore: scoreInfo.total,
      maxScore: scoreInfo.max,
      highlights: {
        highestRated,
        lowestRated,
      },
      submissionTime: new Date().toISOString(),
    };
  }

  private static isAnswered(answer: Answer | undefined): boolean {
    if (!answer || answer.value === null || answer.value === undefined) {
      return false;
    }
    if (Array.isArray(answer.value)) {
      return answer.value.length > 0;
    }
    if (typeof answer.value === 'string') {
      return answer.value.trim().length > 0;
    }
    return true;
  }
}
