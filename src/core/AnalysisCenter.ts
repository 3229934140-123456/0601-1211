import type {
  SubmissionRecord,
  GroupDimension,
  AutoGroupResult,
  TrendResult,
  TrendPoint,
  KeywordChangeResult,
  WeeklyReportResult,
  ComparisonGroup,
  SurveyComparisonResult,
  RichResultSummary,
} from '../types';

import { StatisticsCalculator } from './StatisticsCalculator';

export class AnalysisCenter {
  private records: SubmissionRecord[] = [];

  ingest(records: SubmissionRecord[]): void {
    for (const r of records) {
      this.records.push(r);
    }
  }

  clear(): void {
    this.records = [];
  }

  getRecords(): SubmissionRecord[] {
    return this.records.slice();
  }

  getRecordCount(): number {
    return this.records.length;
  }

  autoGroup(dimension: GroupDimension, customKey?: (r: SubmissionRecord) => string): AutoGroupResult {
    const groupMap = new Map<string, SubmissionRecord[]>();

    for (const r of this.records) {
      let key: string;
      switch (dimension) {
        case 'department':
          key = r.user.department || '未指定部门';
          break;
        case 'timePeriod':
          key = this.toTimePeriod(r.submittedAt);
          break;
        case 'version':
          key = r.surveyVersion || 'default';
          break;
        case 'custom':
          key = customKey ? customKey(r) : 'default';
          break;
        default:
          key = 'all';
      }

      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)!.push(r);
    }

    const groups: AutoGroupResult['groups'] = [];
    for (const [key, recs] of groupMap) {
      groups.push({ key, label: this.groupLabel(dimension, key), records: recs });
    }

    if (dimension === 'timePeriod') {
      groups.sort((a, b) => a.key.localeCompare(b.key));
    } else {
      groups.sort((a, b) => b.records.length - a.records.length);
    }

    return { dimension, groups };
  }

  getAggregatedSummary(dimension: GroupDimension, customKey?: (r: SubmissionRecord) => string): {
    groups: { key: string; label: string; summary: RichResultSummary; count: number }[];
    overall: RichResultSummary | null;
  } {
    const grouped = this.autoGroup(dimension, customKey);
    const results: { key: string; label: string; summary: RichResultSummary; count: number }[] = [];

    for (const g of grouped.groups) {
      if (g.records.length === 0) continue;
      const merged = this.mergeSummaries(g.records);
      results.push({ key: g.key, label: g.label, summary: merged, count: g.records.length });
    }

    const overall = this.records.length > 0 ? this.mergeSummaries(this.records) : null;

    return { groups: results, overall };
  }

  getTrends(metric: 'completionRate' | 'averageScore' | 'weightedAverage' | 'nps', dimension?: 'week' | 'month'): TrendResult[] {
    const periodType = dimension || 'week';
    const periodMap = new Map<string, number[]>();

    for (const r of this.records) {
      const period = periodType === 'week' ? this.toWeekPeriod(r.submittedAt) : this.toMonthPeriod(r.submittedAt);
      if (!periodMap.has(period)) {
        periodMap.set(period, []);
      }
      const value = this.extractMetric(r.summary, metric);
      if (value !== null) {
        periodMap.get(period)!.push(value);
      }
    }

    const periods = Array.from(periodMap.keys()).sort();
    const points: TrendPoint[] = periods.map((p) => {
      const values = periodMap.get(p) || [];
      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      return { period: p, value: Math.round(avg * 1000) / 1000, count: values.length };
    });

    const trends: TrendResult[] = [];
    const metricLabels: Record<string, string> = {
      completionRate: '完成率',
      averageScore: '平均分',
      weightedAverage: '加权平均分',
      nps: 'NPS 净推荐值',
    };

    let direction: TrendResult['direction'] = 'stable';
    let changeRate = 0;
    if (points.length >= 2) {
      const first = points[0].value;
      const last = points[points.length - 1].value;
      changeRate = first !== 0 ? Math.round(((last - first) / first) * 1000) / 1000 : 0;
      if (changeRate > 0.05) direction = 'up';
      else if (changeRate < -0.05) direction = 'down';
    }

    trends.push({
      metric,
      label: metricLabels[metric] || metric,
      points,
      direction,
      changeRate,
    });

    return trends;
  }

  getKeywordChanges(dimension?: 'week' | 'month'): KeywordChangeResult[] {
    const periodType = dimension || 'week';
    const questionMap = new Map<string, Map<string, string[]>>();

    for (const r of this.records) {
      const period = periodType === 'week' ? this.toWeekPeriod(r.submittedAt) : this.toMonthPeriod(r.submittedAt);
      for (const ts of r.summary.textSummaries) {
        if (!questionMap.has(ts.questionId)) {
          questionMap.set(ts.questionId, new Map());
        }
        const periodKeywords = questionMap.get(ts.questionId)!;
        if (!periodKeywords.has(period)) {
          periodKeywords.set(period, []);
        }
        const existing = periodKeywords.get(period)!;
        for (const k of ts.keywords) {
          existing.push(k);
        }
      }
    }

    const results: KeywordChangeResult[] = [];
    for (const [qId, periodMap] of questionMap) {
      const sortedPeriods = Array.from(periodMap.keys()).sort();
      const prevKeywords: string[] = [];
      const periods: KeywordChangeResult['periods'] = [];

      for (const p of sortedPeriods) {
        const raw = periodMap.get(p) || [];
        const freq: Record<string, number> = {};
        for (const k of raw) {
          freq[k] = (freq[k] || 0) + 1;
        }
        const keywords = Object.entries(freq)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15)
          .map(([k]) => k);

        const emerging = prevKeywords.length > 0
          ? keywords.filter((k) => !prevKeywords.includes(k))
          : [];
        const declining = prevKeywords.length > 0
          ? prevKeywords.filter((k) => !keywords.includes(k))
          : [];

        periods.push({ period: p, keywords, emerging, declining });

        prevKeywords.length = 0;
        for (const k of keywords) prevKeywords.push(k);
      }

      let title = qId;
      if (this.records.length > 0) {
        const found = this.records[0].summary.textSummaries.find((t) => t.questionId === qId);
        if (found) title = found.questionTitle;
      }

      results.push({ questionId: qId, questionTitle: title, periods });
    }

    return results;
  }

  generateWeeklyReport(startDate?: string, endDate?: string): WeeklyReportResult {
    let filtered = this.records;
    if (startDate) {
      const start = new Date(startDate).getTime();
      filtered = filtered.filter((r) => r.submittedAt >= start);
    }
    if (endDate) {
      const end = new Date(endDate).getTime();
      filtered = filtered.filter((r) => r.submittedAt <= end);
    }

    const grouped = this.autoGroup('department');
    const groupSummaries: WeeklyReportResult['groupSummaries'] = [];
    const comparisonGroups: ComparisonGroup[] = [];

    for (const g of grouped.groups) {
      if (g.records.length === 0) continue;
      const merged = this.mergeSummaries(g.records);
      groupSummaries.push({
        key: g.key,
        label: g.label,
        completionRate: merged.completionRate,
        averageScore: merged.averageScore ?? null,
        count: g.records.length,
      });
      comparisonGroups.push({
        id: g.key,
        label: `${g.label}（${g.records.length}人）`,
        summary: merged,
      });
    }

    const comparison = comparisonGroups.length > 1
      ? StatisticsCalculator.compareSummaries(comparisonGroups)
      : null;

    const trends = [
      ...this.getTrends('completionRate', 'week'),
      ...this.getTrends('averageScore', 'week'),
    ];

    const keywordChanges = this.getKeywordChanges('week');

    const highlights: string[] = [];
    if (groupSummaries.length > 0) {
      const bestGroup = groupSummaries.reduce((a, b) =>
        (b.averageScore ?? 0) > (a.averageScore ?? 0) ? b : a
      );
      if (bestGroup.averageScore !== null) {
        highlights.push(`${bestGroup.label} 评分最高（${bestGroup.averageScore.toFixed(1)}分）`);
      }
      const bestCompletion = groupSummaries.reduce((a, b) =>
        b.completionRate > a.completionRate ? b : a
      );
      highlights.push(`${bestCompletion.label} 完成率最高（${Math.round(bestCompletion.completionRate * 100)}%）`);
    }
    for (const t of trends) {
      if (t.direction === 'up' && t.points.length > 0) {
        highlights.push(`${t.label} 呈上升趋势（变化率 ${Math.round(t.changeRate * 100)}%）`);
      }
    }

    const now = Date.now();
    const defaultStart = startDate || new Date(now - 7 * 86400000).toISOString().slice(0, 10);
    const defaultEnd = endDate || new Date(now).toISOString().slice(0, 10);

    return {
      surveyId: this.records.length > 0 ? this.records[0].surveyId : '',
      generatedAt: now,
      period: { start: defaultStart, end: defaultEnd },
      totalSubmissions: filtered.length,
      groupSummaries,
      trends,
      keywordChanges,
      comparison,
      highlights,
    };
  }

  private mergeSummaries(records: SubmissionRecord[]): RichResultSummary {
    if (records.length === 0) {
      return this.emptySummary();
    }
    if (records.length === 1) {
      return records[0].summary;
    }

    const first = records[0].summary;
    let totalCompletion = 0;
    let totalScore = 0;
    let scoreCount = 0;
    let totalWeighted = 0;
    let weightedCount = 0;
    let totalRequired = 0;
    let requiredAnswered = 0;
    let totalAnswered = 0;
    let totalQuestions = 0;

    for (const r of records) {
      const s = r.summary;
      totalCompletion += s.completionRate;
      totalQuestions = Math.max(totalQuestions, s.totalQuestions);
      totalAnswered += s.answeredQuestions;
      totalRequired += s.requiredTotal;
      requiredAnswered += s.requiredAnswered;
      if (s.averageScore != null) {
        totalScore += s.averageScore;
        scoreCount++;
      }
      totalWeighted += s.ratingOverview.weightedAverage;
      weightedCount++;
    }

    const n = records.length;
    const avgCompletion = totalCompletion / n;
    const avgScore = scoreCount > 0 ? totalScore / scoreCount : undefined;
    const avgWeighted = weightedCount > 0 ? totalWeighted / weightedCount : 0;

    const optionDistributions = this.mergeOptionDistributions(records);
    const textSummaries = this.mergeTextSummaries(records);
    const ratingOverview = this.mergeRatingOverviews(records, avgWeighted);

    return {
      surveyId: first.surveyId,
      surveyTitle: first.surveyTitle,
      surveyVersion: first.surveyVersion,
      totalQuestions: totalQuestions,
      answeredQuestions: Math.round(totalAnswered / n),
      requiredTotal: totalRequired,
      requiredAnswered: requiredAnswered,
      completionRate: avgCompletion,
      averageScore: avgScore,
      totalScore: totalScore,
      maxScore: first.maxScore,
      highlights: first.highlights,
      submissionTime: new Date().toISOString(),
      durationSeconds: first.durationSeconds,
      optionDistributions,
      textSummaries,
      ratingOverview,
      questionCountByType: first.questionCountByType,
      answeredIds: first.answeredIds,
      unansweredIds: first.unansweredIds,
      invalidIds: first.invalidIds,
      userSnapshot: undefined,
    };
  }

  private mergeOptionDistributions(records: SubmissionRecord[]) {
    const map = new Map<string, { questionId: string; questionTitle: string; type: 'single' | 'multiple'; items: Map<string, { value: string; label: string; count: number }>; totalResponses: number }>();

    for (const r of records) {
      for (const d of r.summary.optionDistributions) {
        if (!map.has(d.questionId)) {
          const itemsMap = new Map<string, { value: string; label: string; count: number }>();
          map.set(d.questionId, {
            questionId: d.questionId,
            questionTitle: d.questionTitle,
            type: d.type,
            items: itemsMap,
            totalResponses: 0,
          });
        }
        const entry = map.get(d.questionId)!;
        entry.totalResponses += d.totalResponses;
        for (const item of d.items) {
          if (!entry.items.has(item.value)) {
            entry.items.set(item.value, { value: item.value, label: item.label, count: 0 });
          }
          entry.items.get(item.value)!.count += item.count;
        }
      }
    }

    return Array.from(map.values()).map((entry) => ({
      questionId: entry.questionId,
      questionTitle: entry.questionTitle,
      type: entry.type,
      totalResponses: entry.totalResponses,
      items: Array.from(entry.items.values()).map((it) => ({
        value: it.value,
        label: it.label,
        count: it.count,
        percentage: entry.totalResponses > 0 ? Math.round((it.count / entry.totalResponses) * 10000) / 100 : 0,
        selected: false,
      })),
    }));
  }

  private mergeTextSummaries(records: SubmissionRecord[]) {
    const map = new Map<string, { questionId: string; questionTitle: string; totalResponses: number; allText: string[]; keywords: Map<string, number> }>();

    for (const r of records) {
      for (const t of r.summary.textSummaries) {
        if (!map.has(t.questionId)) {
          map.set(t.questionId, {
            questionId: t.questionId,
            questionTitle: t.questionTitle,
            totalResponses: 0,
            allText: [],
            keywords: new Map(),
          });
        }
        const entry = map.get(t.questionId)!;
        entry.totalResponses += t.totalResponses;
        for (const item of t.items) {
          entry.allText.push(item.value);
        }
        for (const kw of t.keywords) {
          entry.keywords.set(kw, (entry.keywords.get(kw) || 0) + 1);
        }
      }
    }

    return Array.from(map.values()).map((entry) => ({
      questionId: entry.questionId,
      questionTitle: entry.questionTitle,
      totalResponses: entry.totalResponses,
      items: entry.allText.slice(0, 20).map((v) => ({ value: v, length: v.length })),
      totalLength: entry.allText.reduce((a, b) => a + b.length, 0),
      averageLength: entry.allText.length > 0 ? entry.allText.reduce((a, b) => a + b.length, 0) / entry.allText.length : 0,
      keywords: Array.from(entry.keywords.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([k]) => k),
    }));
  }

  private mergeRatingOverviews(records: SubmissionRecord[], avgWeighted: number) {
    const first = records[0].summary.ratingOverview;
    const avgScore = first.averageScore;
    return {
      totalRatingQuestions: first.totalRatingQuestions,
      averageScore: avgScore,
      totalScore: first.totalScore,
      maxScore: first.maxScore,
      weightedAverage: avgWeighted,
      items: first.items,
      netPromoterScore: first.netPromoterScore,
    };
  }

  private emptySummary(): RichResultSummary {
    return {
      surveyId: '',
      surveyTitle: '',
      totalQuestions: 0,
      answeredQuestions: 0,
      requiredTotal: 0,
      requiredAnswered: 0,
      completionRate: 0,
      highlights: {},
      optionDistributions: [],
      textSummaries: [],
      ratingOverview: {
        totalRatingQuestions: 0,
        averageScore: 0,
        totalScore: 0,
        maxScore: 0,
        weightedAverage: 0,
        items: [],
      },
      questionCountByType: { single: 0, multiple: 0, rating: 0, text: 0 },
      answeredIds: [],
      unansweredIds: [],
      invalidIds: [],
    };
  }

  private extractMetric(summary: RichResultSummary, metric: string): number | null {
    switch (metric) {
      case 'completionRate': return summary.completionRate;
      case 'averageScore': return summary.averageScore ?? null;
      case 'weightedAverage': return summary.ratingOverview.weightedAverage;
      case 'nps': return summary.ratingOverview.netPromoterScore ?? null;
      default: return null;
    }
  }

  private toTimePeriod(ts: number): string {
    const d = new Date(ts);
    const month = d.getMonth();
    if (month < 3) return 'Q1';
    if (month < 6) return 'Q2';
    if (month < 9) return 'Q3';
    return 'Q4';
  }

  private toWeekPeriod(ts: number): string {
    const d = new Date(ts);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d);
    monday.setDate(diff);
    return monday.toISOString().slice(0, 10);
  }

  private toMonthPeriod(ts: number): string {
    return new Date(ts).toISOString().slice(0, 7);
  }

  private groupLabel(dimension: GroupDimension, key: string): string {
    switch (dimension) {
      case 'department': return key;
      case 'timePeriod': return `${key}`;
      case 'version': return `v${key}`;
      default: return key;
    }
  }
}
