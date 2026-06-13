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
  RichResultSummary,
  OptionDistribution,
  OptionDistributionItem,
  TextSummary,
  TextSummaryItem,
  RatingOverview,
  RatingOverviewItem,
  QuestionOption,
  ComparisonGroup,
  ComparisonMetric,
  SurveyComparisonResult,
} from '../types';

export class StatisticsCalculator {
  static getCompletionRate(
    survey: Survey,
    questions: Question[],
    answers: AnswersMap
  ): CompletionRate {
    let answered = 0;
    let skipped = 0;
    let requiredTotal = 0;
    let requiredAnswered = 0;
    const total = questions.length;

    for (const question of questions) {
      const isAnswered = this.isAnswered(answers[question.id]);
      if (question.required) requiredTotal++;
      if (isAnswered) {
        answered++;
        if (question.required) requiredAnswered++;
      } else {
        skipped++;
      }
    }

    return {
      totalQuestions: total,
      answeredQuestions: answered,
      skippedQuestions: skipped,
      requiredTotal,
      requiredAnswered,
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
    if (!this.isAnswered(answer)) {
      return null;
    }

    const value = Number(answer!.value);
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

  static getOptionDistribution(
    question: SingleChoiceQuestion | MultipleChoiceQuestion,
    answers: AnswersMap
  ): OptionDistribution {
    const answer = answers[question.id];
    const answered = this.isAnswered(answer);
    const selectedValues: string[] = [];

    if (answered) {
      const raw = answer!.value;
      if (Array.isArray(raw)) {
        for (const v of raw) selectedValues.push(String(v));
      } else if (raw !== null && raw !== undefined) {
        selectedValues.push(String(raw));
      }
    }

    const items: OptionDistributionItem[] = question.options.map(
      (opt: QuestionOption): OptionDistributionItem => {
        const valueStr = String(opt.value);
        const selected = selectedValues.includes(valueStr);
        const count = selected ? 1 : 0;
        const percentage = answered ? (count / Math.max(1, 1)) * 100 : 0;
        return {
          value: valueStr,
          label: opt.label,
          count,
          percentage,
          selected,
        };
      }
    );

    let otherCount = 0;
    const validValues = question.options.map((o) => String(o.value));
    for (const sv of selectedValues) {
      if (!validValues.includes(sv)) otherCount++;
    }

    return {
      questionId: question.id,
      questionTitle: question.title,
      type: question.type,
      totalResponses: answered ? 1 : 0,
      items,
      otherCount: otherCount || undefined,
    };
  }

  static getTextSummary(
    question: Question,
    answers: AnswersMap
  ): TextSummary | null {
    if (question.type !== 'text') return null;
    const answer = answers[question.id];
    const answered = this.isAnswered(answer);
    const rawText = answered ? String(answer!.value || '').trim() : '';

    const items: TextSummaryItem[] = [];
    let totalLength = 0;
    if (rawText) {
      const sentences = rawText
        .split(/[。！？!?.\n]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const s of sentences) {
        items.push({ value: s, length: s.length });
        totalLength += s.length;
      }
      if (items.length === 0) {
        items.push({ value: rawText, length: rawText.length });
        totalLength = rawText.length;
      }
    }

    const words = (rawText.match(/[\u4e00-\u9fa5]{2,}|[a-zA-Z][a-zA-Z0-9]{2,}/g) || []);
    const freq: Record<string, number> = {};
    for (const w of words) {
      freq[w] = (freq[w] || 0) + 1;
    }
    const keywords = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([k]) => k);

    return {
      questionId: question.id,
      questionTitle: question.title,
      totalResponses: answered ? 1 : 0,
      items,
      totalLength,
      averageLength: items.length ? totalLength / items.length : 0,
      keywords,
    };
  }

  static getRatingOverviewItem(
    question: RatingQuestion,
    answers: AnswersMap
  ): RatingOverviewItem | null {
    if (question.type !== 'rating') return null;
    const score = this.getQuestionAverageScore(question, answers);

    const distribution: Record<number, number> = {};
    for (
      let v = question.minValue;
      v <= question.maxValue;
      v += question.step || 1
    ) {
      distribution[v] = 0;
    }
    if (score !== null) {
      distribution[score] = (distribution[score] || 0) + 1;
    }

    const bucket: RatingOverviewItem['scoreBucket'] =
      score === null
        ? 'poor'
        : score >= question.maxValue * 0.8
        ? 'excellent'
        : score >= question.maxValue * 0.6
        ? 'good'
        : score >= question.maxValue * 0.4
        ? 'fair'
        : 'poor';

    return {
      questionId: question.id,
      questionTitle: question.title,
      minValue: question.minValue,
      maxValue: question.maxValue,
      averageScore: score ?? 0,
      median: score ?? 0,
      distribution,
      scoreBucket: bucket,
    };
  }

  static getRatingOverview(
    questions: Question[],
    answers: AnswersMap
  ): RatingOverview {
    const ratingQuestions = questions.filter(
      (q) => q.type === 'rating'
    ) as RatingQuestion[];

    const items: RatingOverviewItem[] = [];
    let sum = 0;
    let totalScore = 0;
    let maxScore = 0;
    let weights = 0;

    for (const rq of ratingQuestions) {
      const item = this.getRatingOverviewItem(rq, answers);
      if (item) {
        const hasScore = this.isAnswered(answers[rq.id]);
        items.push(item);
        if (hasScore) {
          sum += item.averageScore;
          totalScore += item.averageScore;
          const weight = rq.maxValue;
          maxScore += rq.maxValue;
          weights += weight;
        }
      }
    }

    const avg = items.length ? sum / items.length : 0;
    const weighted =
      maxScore > 0 && weights > 0
        ? totalScore /
          (maxScore / Math.max(1, ratingQuestions.length)) /
          Math.max(1, items.filter((i) => i.averageScore > 0).length || 1)
        : avg;

    let nps: number | undefined;
    if (ratingQuestions.some((q) => q.maxValue === 10 && q.minValue === 0)) {
      const promoters = items.filter((i) => i.averageScore >= 9).length;
      const detractors = items.filter((i) => i.averageScore > 0 && i.averageScore <= 6).length;
      const total = items.length;
      nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;
    }

    return {
      totalRatingQuestions: ratingQuestions.length,
      averageScore: avg,
      totalScore,
      maxScore,
      weightedAverage: isNaN(weighted) || !isFinite(weighted) ? avg : weighted,
      items,
      netPromoterScore: nps,
    };
  }

  static getQuestionStatistics(
    question: Question,
    answers: AnswersMap
  ): QuestionStatistics {
    const answer = answers[question.id];
    const hasAnswer = this.isAnswered(answer);

    const base: QuestionStatistics = {
      questionId: question.id,
      questionTitle: question.title,
      type: question.type,
      totalResponses: hasAnswer ? 1 : 0,
      required: !!question.required,
      hasAnswer,
    };

    switch (question.type) {
      case 'single': {
        const singleQ = question as SingleChoiceQuestion;
        const dist = this.getOptionDistribution(singleQ, answers);
        const counts: Record<string, number> = {};
        for (const it of dist.items) {
          counts[it.value] = it.count;
        }
        base.optionCounts = counts;
        base.optionDistribution = dist;
        break;
      }
      case 'multiple': {
        const multiQ = question as MultipleChoiceQuestion;
        const dist = this.getOptionDistribution(multiQ, answers);
        const counts: Record<string, number> = {};
        for (const it of dist.items) {
          counts[it.value] = it.count;
        }
        base.optionCounts = counts;
        base.optionDistribution = dist;
        break;
      }
      case 'rating': {
        const avg = this.getQuestionAverageScore(question, answers);
        base.averageScore = avg ?? undefined;
        const rq = question as RatingQuestion;
        const detail = this.getRatingOverviewItem(rq, answers);
        if (detail) base.ratingDetail = detail;
        break;
      }
      case 'text': {
        const textVal = hasAnswer ? String(answer!.value || '').trim() : '';
        if (textVal) base.textResponses = [textVal];
        const summary = this.getTextSummary(question, answers);
        if (summary) base.textSummary = summary;
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

  static getOptionDistributions(
    survey: Survey,
    questions: Question[],
    answers: AnswersMap
  ): OptionDistribution[] {
    const result: OptionDistribution[] = [];
    for (const q of questions) {
      if (q.type === 'single' || q.type === 'multiple') {
        const d = this.getOptionDistribution(
          q as SingleChoiceQuestion | MultipleChoiceQuestion,
          answers
        );
        result.push(d);
      }
    }
    return result;
  }

  static getTextSummaries(
    survey: Survey,
    questions: Question[],
    answers: AnswersMap
  ): TextSummary[] {
    const result: TextSummary[] = [];
    for (const q of questions) {
      if (q.type === 'text') {
        const d = this.getTextSummary(q, answers);
        if (d) result.push(d);
      }
    }
    return result;
  }

  static generateResultSummary(
    survey: Survey,
    questions: Question[],
    answers: AnswersMap,
    durationMs?: number
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
      surveyVersion: survey.meta.version,
      totalQuestions: completion.totalQuestions,
      answeredQuestions: completion.answeredQuestions,
      requiredTotal: completion.requiredTotal,
      requiredAnswered: completion.requiredAnswered,
      completionRate: completion.rate,
      averageScore: scoreInfo.count > 0 ? scoreInfo.average : undefined,
      totalScore: scoreInfo.total,
      maxScore: scoreInfo.max,
      highlights: {
        highestRated,
        lowestRated,
      },
      submissionTime: new Date().toISOString(),
      durationSeconds: durationMs ? Math.round(durationMs / 1000) : undefined,
    };
  }

  static generateRichResultSummary(
    survey: Survey,
    questions: Question[],
    answers: AnswersMap,
    user?: unknown,
    durationMs?: number
  ): RichResultSummary {
    const base = this.generateResultSummary(survey, questions, answers, durationMs);

    const countByType = { single: 0, multiple: 0, rating: 0, text: 0 };
    const answeredIds: string[] = [];
    const unansweredIds: string[] = [];
    for (const q of questions) {
      countByType[q.type]++;
      if (this.isAnswered(answers[q.id])) {
        answeredIds.push(q.id);
      } else {
        unansweredIds.push(q.id);
      }
    }

    return {
      ...base,
      optionDistributions: this.getOptionDistributions(survey, questions, answers),
      textSummaries: this.getTextSummaries(survey, questions, answers),
      ratingOverview: this.getRatingOverview(questions, answers),
      questionCountByType: countByType,
      answeredIds,
      unansweredIds,
      invalidIds: [],
      userSnapshot: user as Parameters<typeof Object>[0] | undefined,
    };
  }

  static compareSummaries(
    groups: ComparisonGroup[]
  ): SurveyComparisonResult {
    if (groups.length === 0) {
      return {
        groups: [],
        completionRates: { key: 'completion', label: '完成率', values: [], winner: undefined },
        averageScores: { key: 'avgScore', label: '平均分', values: [], winner: undefined },
        weightedAverages: { key: 'weightedAvg', label: '加权平均', values: [], winner: undefined },
        requiredCompletionRates: { key: 'requiredCompletion', label: '必填完成率', values: [], winner: undefined },
        optionDistributionMap: {},
        keywordsMap: {},
      };
    }

    const first = groups[0].summary;

    const completionValues = groups.map((g) => ({
      groupId: g.id,
      value: g.summary.completionRate,
    }));
    const bestCompletion = this.findBest(completionValues, 'high');

    const avgValues = groups.map((g) => ({
      groupId: g.id,
      value: g.summary.averageScore ?? null,
    }));
    const bestAvg = this.findBest(avgValues, 'high');

    const weightedValues = groups.map((g) => ({
      groupId: g.id,
      value: g.summary.ratingOverview.weightedAverage,
    }));
    const bestWeighted = this.findBest(weightedValues, 'high');

    const requiredValues = groups.map((g) => {
      const rate = g.summary.requiredTotal > 0
        ? g.summary.requiredAnswered / g.summary.requiredTotal
        : 0;
      return { groupId: g.id, value: rate };
    });
    const bestRequired = this.findBest(requiredValues, 'high');

    const durationValues = groups.map((g) => ({
      groupId: g.id,
      value: g.summary.durationSeconds ?? null,
    }));

    const npsValues = groups
      .filter((g) => typeof g.summary.ratingOverview.netPromoterScore === 'number')
      .map((g) => ({
        groupId: g.id,
        value: g.summary.ratingOverview.netPromoterScore!,
      }));

    const optionDistributionMap: Record<string, ComparisonMetric> = {};
    const optionQuestions = first.optionDistributions;
    for (const dist of optionQuestions) {
      const qid = dist.questionId;
      const allItems = dist.items.map((it) => it.value);
      const values = groups.map((g) => {
        const gDist = g.summary.optionDistributions.find((d) => d.questionId === qid);
        if (!gDist) return { groupId: g.id, value: null };
        const total = gDist.totalResponses;
        const topItem = gDist.items.reduce(
          (a, b) => (b.count > a.count ? b : a),
          gDist.items[0]
        );
        return {
          groupId: g.id,
          value: total > 0 ? `${topItem?.label ?? 'N/A'} (${Math.round((topItem?.count ?? 0) / total * 100)}%)` : null,
        };
      });
      optionDistributionMap[qid] = {
        key: `opt_${qid}`,
        label: dist.questionTitle,
        values,
      };
    }

    const keywordsMap: Record<string, { groupId: string; keywords: string[]; common: string[]; unique: string[] }[]> = {};
    const textQuestions = first.textSummaries;
    for (const ts of textQuestions) {
      const qid = ts.questionId;
      const groupKeywords = groups.map((g) => {
        const gTs = g.summary.textSummaries.find((t) => t.questionId === qid);
        return {
          groupId: g.id,
          keywords: gTs ? gTs.keywords : [],
        };
      });
      const allKeywords = new Set<string>();
      for (const gk of groupKeywords) {
        for (const k of gk.keywords) allKeywords.add(k);
      }
      const commonKeywords = groupKeywords
        .filter((gk) => gk.keywords.length > 0)
        .reduce((common, gk) => {
          return common.filter((k) => gk.keywords.includes(k));
        }, Array.from(allKeywords));

      const entries = groupKeywords.map((gk) => ({
        groupId: gk.groupId,
        keywords: gk.keywords,
        common: commonKeywords.filter((k) => gk.keywords.includes(k)),
        unique: gk.keywords.filter((k) => !commonKeywords.includes(k)),
      }));
      keywordsMap[qid] = entries;
    }

    let overallBest: string | undefined;
    let overallWorst: string | undefined;
    if (groups.length > 1) {
      const scores = new Map<string, number>();
      for (const g of groups) scores.set(g.id, 0);
      if (bestCompletion) scores.set(bestCompletion, (scores.get(bestCompletion) || 0) + 1);
      if (bestWeighted) scores.set(bestWeighted, (scores.get(bestWeighted) || 0) + 1);
      if (bestRequired) scores.set(bestRequired, (scores.get(bestRequired) || 0) + 1);
      const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
      overallBest = sorted[0][1] > 0 ? sorted[0][0] : undefined;
      overallWorst = sorted[sorted.length - 1][1] < sorted[0][1] ? sorted[sorted.length - 1][0] : undefined;
    }

    return {
      groups,
      completionRates: {
        key: 'completion',
        label: '完成率',
        values: completionValues,
        winner: bestCompletion,
      },
      averageScores: {
        key: 'avgScore',
        label: '平均分',
        values: avgValues,
        winner: bestAvg,
      },
      weightedAverages: {
        key: 'weightedAvg',
        label: '加权平均',
        values: weightedValues,
        winner: bestWeighted,
      },
      netPromoterScores: npsValues.length > 0 ? {
        key: 'nps',
        label: 'NPS 净推荐值',
        values: npsValues,
        winner: this.findBest(npsValues, 'high'),
      } : undefined,
      requiredCompletionRates: {
        key: 'requiredCompletion',
        label: '必填完成率',
        values: requiredValues,
        winner: bestRequired,
      },
      durationSeconds: {
        key: 'duration',
        label: '答题时长（秒）',
        values: durationValues,
        winner: this.findBest(durationValues, 'low'),
      },
      optionDistributionMap,
      keywordsMap,
      overallBestGroup: overallBest,
      overallWorstGroup: overallWorst,
    };
  }

  private static findBest(
    values: { groupId: string; value: number | string | null }[],
    direction: 'high' | 'low'
  ): string | undefined {
    const numeric = values.filter(
      (v): v is { groupId: string; value: number } => typeof v.value === 'number'
    );
    if (numeric.length === 0) return undefined;
    if (direction === 'high') {
      return numeric.reduce((a, b) => (b.value > a.value ? b : a)).groupId;
    } else {
      return numeric.reduce((a, b) => (b.value < a.value ? b : a)).groupId;
    }
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
