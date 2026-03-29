import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type ReviewWindow = {
  start: string;
  end: string;
  effectiveEnd: string;
};

type WeeklyReviewProps = {
  visible: boolean;
  onClose: () => void;
  report: any | null;
  sessions: any[];
  loading: boolean;
  error: string | null;
  reviewWindow: ReviewWindow | null;
  devOverrideEnabled?: boolean;
};

type ChartDatum = {
  label: string;
  value: number;
  hasSessions?: boolean;
};

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function minutesBetween(start: string | null | undefined, end: string | null | undefined) {
  if (!start || !end) {
    return 0;
  }

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return 0;
  }

  return Math.max((endDate.getTime() - startDate.getTime()) / 60_000, 0);
}

function getLatenessMinutes(session: any) {
  if (!session?.planned_start || !session?.actual_start) {
    return 0;
  }

  const plannedStart = new Date(session.planned_start);
  const actualStart = new Date(session.actual_start);
  if (Number.isNaN(plannedStart.getTime()) || Number.isNaN(actualStart.getTime())) {
    return 0;
  }

  return Math.max((actualStart.getTime() - plannedStart.getTime()) / 60_000, 0);
}

function getStartDeltaMinutes(session: any) {
  if (Number.isFinite(Number(session?.start_delta_minutes))) {
    return Number(session.start_delta_minutes);
  }

  if (!session?.planned_start || !session?.actual_start) {
    return null;
  }

  const plannedStart = new Date(session.planned_start);
  const actualStart = new Date(session.actual_start);
  if (Number.isNaN(plannedStart.getTime()) || Number.isNaN(actualStart.getTime())) {
    return null;
  }

  return (actualStart.getTime() - plannedStart.getTime()) / 60_000;
}

function formatRange(start: Date, end: Date) {
  return `${start.toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })} - ${end.toLocaleDateString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })}`;
}

function formatPercent(value: number | null | undefined) {
  const safeValue = Number.isFinite(value) ? Number(value) : 0;
  return `${safeValue.toFixed(1)}%`;
}

function formatScore(value: number | null | undefined) {
  const safeValue = Number.isFinite(value) ? Number(value) : 0;
  return safeValue.toFixed(1);
}

function formatMinutes(value: number | null | undefined) {
  const safeValue = Number.isFinite(value) ? Number(value) : 0;
  return `${safeValue.toFixed(1)} min`;
}

function formatStartDelta(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return 'Pending';
  }

  const safeValue = Number(value);
  const rounded = Math.round(Math.abs(safeValue));
  if (rounded === 0) {
    return 'On time';
  }

  return safeValue < 0 ? `+${rounded} min early` : `-${rounded} min late`;
}

function formatHours(value: number | null | undefined) {
  const safeValue = Number.isFinite(value) ? Number(value) : 0;
  const hours = Math.floor(safeValue / 60);
  const minutes = Math.round(safeValue % 60);

  if (hours <= 0) {
    return `${minutes} min`;
  }

  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function formatShortDay(value: Date) {
  return value.toLocaleDateString([], { weekday: 'short' });
}

function shortenLabel(value: string, limit = 10) {
  const text = String(value || '').trim();
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, Math.max(limit - 3, 1))}...`;
}

function formatDelta(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return 'No prior-week baseline';
  }

  const safeValue = Number(value);
  if (safeValue === 0) {
    return 'Flat vs previous week';
  }

  return `${safeValue > 0 ? '+' : ''}${safeValue.toFixed(1)}% vs previous week`;
}

function getDeltaTone(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return styles.deltaNeutral;
  }

  if (Number(value) > 0) {
    return styles.deltaPositive;
  }

  if (Number(value) < 0) {
    return styles.deltaNegative;
  }

  return styles.deltaNeutral;
}

function normalizeObjectiveProgressData(progressByDay: any, weekDates: Date[]) {
  const points = Array.isArray(progressByDay) ? progressByDay : [];
  if (weekDates.length === 0) {
    return points.map((point: any) => ({
      label: String(point?.label || ''),
      value: Number(point?.completion_percent || 0),
      hasSessions: Number(point?.objective_count || 0) > 0,
    }));
  }

  const expectedLabels = weekDates.map((date) => formatShortDay(date));
  const pointByLabel = new Map(
    points
      .filter((point: any) => String(point?.label || '').trim().length > 0)
      .map((point: any) => [String(point.label), point]),
  );
  const hasLabelMatches = expectedLabels.some((label) => pointByLabel.has(label));

  return expectedLabels.map((label, index) => {
    const point = hasLabelMatches ? pointByLabel.get(label) : points[index];
    return {
      label,
      value: Number(point?.completion_percent || 0),
      hasSessions: Number(point?.objective_count || 0) > 0,
    };
  });
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function ChartCard({
  title,
  data,
  accentColor,
  valueFormatter,
  emptyLabel,
}: {
  title: string;
  data: ChartDatum[];
  accentColor: string;
  valueFormatter: (value: number) => string;
  emptyLabel: string;
}) {
  const maxValue = Math.max(...data.map((item) => item.value), 0);

  return (
    <View style={styles.chartCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {maxValue <= 0 ? (
        <Text style={styles.subtle}>{emptyLabel}</Text>
      ) : (
        <View style={styles.chartRow}>
          {data.map((item) => {
            const height = Math.max((item.value / maxValue) * 96, item.value > 0 ? 10 : 0);
            return (
              <View key={item.label} style={styles.chartColumn}>
                <Text style={styles.chartValue}>{valueFormatter(item.value)}</Text>
                <View style={styles.chartTrack}>
                  <View
                    style={[
                      styles.chartBar,
                      { height, backgroundColor: accentColor },
                    ]}
                  />
                </View>
                <Text style={styles.chartLabel}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function MiniTrendStrip({
  data,
  accentColor,
  maxValue,
  emptyLabel,
}: {
  data: ChartDatum[];
  accentColor: string;
  maxValue?: number;
  emptyLabel: string;
}) {
  const computedMax = maxValue ?? Math.max(...data.map((item) => item.value), 0);
  const hasRenderableData = data.some(
    (item) => item.hasSessions === true || item.value > 0,
  );

  if (computedMax <= 0 && !hasRenderableData) {
    return <Text style={styles.subtle}>{emptyLabel}</Text>;
  }

  return (
    <View style={styles.miniChartRow}>
      {data.map((item) => {
        const scaleMax = computedMax > 0 ? computedMax : 1;
        const height = Math.max((item.value / scaleMax) * 46, item.value > 0 ? 6 : 0);
        return (
          <View key={item.label} style={styles.miniChartColumn}>
            <View
              style={[
                styles.miniChartTrack,
                item.hasSessions === false ? styles.miniChartTrackEmpty : null,
              ]}
            >
              {item.value > 0 ? (
                <View
                  style={[
                    styles.miniChartBar,
                    { height, backgroundColor: accentColor },
                  ]}
                />
              ) : null}
              {item.hasSessions === true && item.value <= 0 ? (
                <View style={styles.miniChartZeroMarker} />
              ) : null}
            </View>
            <Text style={styles.miniChartLabel}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function TrendCard({
  title,
  subtitle,
  completionDelta,
  timeDelta,
  performanceDelta,
  daily,
}: {
  title: string;
  subtitle: string;
  completionDelta: number | null | undefined;
  timeDelta: number | null | undefined;
  performanceDelta: number | null | undefined;
  daily: ChartDatum[];
}) {
  return (
    <View style={styles.detailCard}>
      <View style={styles.detailHeader}>
        <View style={styles.detailCopy}>
          <Text style={styles.body}>{title}</Text>
          <Text style={styles.subtle}>{subtitle}</Text>
        </View>
        <View style={[styles.deltaPill, getDeltaTone(performanceDelta)]}>
          <Text style={styles.deltaPillText}>{formatDelta(performanceDelta)}</Text>
        </View>
      </View>
      <View style={styles.detailMetricsRow}>
        <Text style={styles.subtle}>Completion: {formatDelta(completionDelta)}</Text>
        <Text style={styles.subtle}>Time: {formatDelta(timeDelta)}</Text>
      </View>
      <MiniTrendStrip
        data={daily}
        accentColor="#66CFA4"
        maxValue={100}
        emptyLabel="No day-by-day performance trend yet."
      />
    </View>
  );
}

export default function WeeklyReview({
  visible,
  onClose,
  report,
  sessions,
  loading,
  error,
  reviewWindow,
  devOverrideEnabled = false,
}: WeeklyReviewProps) {
  const parsedWindow = useMemo(() => {
    if (!reviewWindow) {
      return null;
    }

    return {
      start: startOfDay(new Date(reviewWindow.start)),
      end: startOfDay(new Date(reviewWindow.end)),
      fullEnd: new Date(reviewWindow.end),
      effectiveEnd: new Date(reviewWindow.effectiveEnd),
    };
  }, [reviewWindow]);

  const weekDates = useMemo(() => {
    if (!parsedWindow) {
      return [];
    }

    return Array.from({ length: 7 }, (_, index) => addDays(parsedWindow.start, index));
  }, [parsedWindow]);

  const weeklySessions = useMemo(() => {
    if (!parsedWindow) {
      return [];
    }

    return sessions.filter((session) => {
      const plannedStart = new Date(session.planned_start);
      if (Number.isNaN(plannedStart.getTime())) {
        return false;
      }

      return (
        plannedStart.getTime() >= parsedWindow.start.getTime() &&
        plannedStart.getTime() <= parsedWindow.effectiveEnd.getTime()
      );
    });
  }, [parsedWindow, sessions]);

  const dailyMetrics = useMemo(() => {
    if (!parsedWindow) {
      return [];
    }

    return weekDates.map((date) => {
      const dayStart = startOfDay(date);
      const dayEnd = addDays(dayStart, 1);
      const daySessions = weeklySessions.filter((session) => {
        const plannedStart = new Date(session.planned_start);
        return (
          !Number.isNaN(plannedStart.getTime()) &&
          plannedStart.getTime() >= dayStart.getTime() &&
          plannedStart.getTime() < dayEnd.getTime()
        );
      });

      const completed = daySessions.filter(
        (session) => session.objective_completed === true,
      ).length;
      const missed = daySessions.filter((session) => session.status === 'missed').length;
      const closed = daySessions.filter(
        (session) => Boolean(session.actual_end) || session.status === 'missed',
      ).length;
      const startedSessions = daySessions.filter((session) => Boolean(session.actual_start));
      const punctualSessions = startedSessions.filter(
        (session) => {
          const delta = getStartDeltaMinutes(session);
          return Number.isFinite(delta) && Number(delta) <= 0;
        },
      ).length;
      const spentMinutes = daySessions.reduce(
        (total, session) =>
          total + minutesBetween(session.actual_start, session.actual_end),
        0,
      );
      const plannedMinutes = daySessions.reduce(
        (total, session) =>
          total + minutesBetween(session.planned_start, session.planned_end),
        0,
      );
      const completionRate =
        daySessions.length > 0 ? (completed / daySessions.length) * 100 : 0;
      const punctualityRate =
        startedSessions.length > 0 ? (punctualSessions / startedSessions.length) * 100 : 0;
      const signalRate =
        plannedMinutes > 0 ? Math.min((spentMinutes / plannedMinutes) * 100, 100) : 0;
      const averageScore =
        closed > 0
          ? daySessions
              .filter((session) => Boolean(session.actual_end) || session.status === 'missed')
              .reduce(
                (total, session) => total + Number(session.quality_score || 0),
                0,
              ) / closed
          : 0;

      return {
        label: formatShortDay(date),
        completed,
        closed,
        missed,
        spentMinutes,
        score: averageScore,
      };
    });
  }, [parsedWindow, weekDates, weeklySessions]);

  const completedCount = weeklySessions.filter(
    (session) => session.objective_completed === true,
  ).length;
  const closedCount = weeklySessions.filter(
    (session) => Boolean(session.actual_end) || session.status === 'missed',
  ).length;
  const missedCount = weeklySessions.filter(
    (session) => session.status === 'missed',
  ).length;
  const totalSessions = weeklySessions.length;
  const totalSpentMinutes = weeklySessions.reduce(
    (total, session) => total + minutesBetween(session.actual_start, session.actual_end),
    0,
  );
  const objectiveCompletionRate =
    totalSessions > 0 ? (completedCount / totalSessions) * 100 : 0;
  const topHabit = Array.isArray(report?.habits) ? report.habits[0] : null;
  const categoryObjectives = Array.isArray(report?.category_objectives)
    ? report.category_objectives
    : [];
  const categoryTrends = Array.isArray(report?.category_trends)
    ? report.category_trends
    : [];
  const repeatedSessionTrends = Array.isArray(report?.repeated_session_trends)
    ? report.repeated_session_trends
    : [];
  const reflectionSummary = report?.reflection_summary ?? null;
  const streaks = report?.streaks ?? null;
  const timeline = Array.isArray(report?.timeline) ? report.timeline : [];
  const weeklyFeedback = report?.advisor?.weekly_feedback ?? null;
  const reflectionSections = weeklyFeedback
    ? [
        { label: 'Wins', text: weeklyFeedback.wins },
        { label: 'Gaps', text: weeklyFeedback.gaps },
        { label: 'Patterns', text: weeklyFeedback.patterns },
        { label: 'Insight', text: weeklyFeedback.insight },
        { label: 'Advice', text: weeklyFeedback.advice },
      ].filter((item) => String(item.text || '').trim().length > 0)
    : [];
  const isWeekInProgress = Boolean(
    parsedWindow && parsedWindow.effectiveEnd.getTime() < parsedWindow.fullEnd.getTime(),
  );
  const objectiveTotal = categoryObjectives.reduce(
    (total: number, item: any) => total + Number(item.objective_count || 0),
    0,
  );
  const objectiveCompleted = categoryObjectives.reduce(
    (total: number, item: any) => total + Number(item.completed_objectives || 0),
    0,
  );
  const overallObjectiveCompletion =
    objectiveTotal > 0 ? (objectiveCompleted / objectiveTotal) * 100 : 0;
  const objectiveProgressLabel = parsedWindow
    ? parsedWindow.effectiveEnd.toLocaleDateString([], { weekday: 'long' })
    : 'today';

  const summaryLine = totalSessions
    ? `Closed ${closedCount} of ${totalSessions} tracked sessions, completed ${completedCount} objectives, and logged ${formatHours(
        totalSpentMinutes,
      )} ${isWeekInProgress ? 'for this week so far.' : 'for this selected week.'}`
    : 'No tracked sessions fall inside this review window yet.';
  const summarySupport = reflectionSummary?.top_distraction_category
    ? `Top distraction this week: ${reflectionSummary.top_distraction_category} (${reflectionSummary.top_distraction_count}).`
    : objectiveTotal
    ? `${objectiveCompleted} of ${objectiveTotal} session objectives were explicitly marked complete by ${objectiveProgressLabel}.`
    : topHabit
      ? `${topHabit.category} accounted for ${topHabit.count} missed sessions.`
      : `Punctuality is ${formatPercent(
          report?.metrics?.punctuality_rate,
        )} with average lateness at ${formatMinutes(
          report?.metrics?.average_lateness_minutes,
        )}.`;

  const completedByDayData = dailyMetrics.map((item) => ({
    label: item.label,
    value: item.completed,
  }));
  const timeSpentByDayData = dailyMetrics.map((item) => ({
    label: item.label,
    value: item.spentMinutes,
  }));
  const completionVsMissedData = [
    { label: 'Completed', value: completedCount },
    { label: 'Missed', value: missedCount },
  ];
  const executionTrendData = dailyMetrics.map((item) => ({
    label: item.label,
    value: item.score,
  }));
  const objectiveCompletionData = categoryObjectives.map((item: any) => ({
    label: shortenLabel(item.category, 8),
    value: Number(item.completion_percent || 0),
  }));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Weekly Feedback</Text>
              {parsedWindow ? (
                <Text style={styles.subtle}>
                  {formatRange(parsedWindow.start, parsedWindow.end)}
                </Text>
              ) : null}
              {devOverrideEnabled ? (
                <View style={styles.devBadge}>
                  <Text style={styles.devBadgeText}>Developer Sunday override</Text>
                </View>
              ) : null}
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {loading ? <Text style={styles.body}>Loading weekly review...</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}

            {!loading && !error && report ? (
              <>
                {reflectionSections.length > 0 ? (
                  <View style={styles.summaryCard}>
                    <Text style={styles.sectionTitle}>Advisor Reflection</Text>
                    {reflectionSections.map((item) => (
                      <View key={item.label} style={styles.reflectionItem}>
                        <Text style={styles.reflectionLabel}>{item.label}</Text>
                        <Text style={styles.body}>{item.text}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.summaryCard}>
                  <Text style={styles.sectionTitle}>Weekly Summary</Text>
                  <Text style={styles.body}>{summaryLine}</Text>
                  <Text style={styles.subtle}>{summarySupport}</Text>
                </View>

                <View style={styles.metricGrid}>
                  <MetricCard
                    label="Sessions closed"
                    value={String(closedCount)}
                  />
                  <MetricCard label="Sessions missed" value={String(missedCount)} />
                  <MetricCard
                    label="Total time spent"
                    value={formatHours(totalSpentMinutes)}
                  />
                  <MetricCard
                    label="Objectives completed"
                    value={`${objectiveCompleted} / ${objectiveTotal}`}
                  />
                  <MetricCard
                    label="Objective completion %"
                    value={formatPercent(overallObjectiveCompletion)}
                  />
                  <MetricCard
                    label="Completion rate"
                    value={formatPercent(objectiveCompletionRate)}
                  />
                  <MetricCard
                    label="Performance score"
                    value={formatPercent(report?.metrics?.performance_percent)}
                  />
                  <MetricCard
                    label="Signal consistency"
                    value={formatPercent(report?.metrics?.signal_percent)}
                  />
                  <MetricCard
                    label="Punctuality rate"
                    value={formatPercent(report?.metrics?.punctuality_rate)}
                  />
                  <MetricCard
                    label="Average lateness"
                    value={formatMinutes(report?.metrics?.average_lateness_minutes)}
                  />
                  <MetricCard
                    label="Average start delta"
                    value={formatStartDelta(report?.metrics?.average_start_delta_minutes)}
                  />
                  <MetricCard
                    label="Discipline score"
                    value={formatScore(report?.metrics?.discipline_score)}
                  />
                  <MetricCard
                    label="Current day streak"
                    value={String(streaks?.completed_days?.current || 0)}
                  />
                  <MetricCard
                    label="Longest day streak"
                    value={String(streaks?.completed_days?.longest || 0)}
                  />
                  <MetricCard
                    label="Current session streak"
                    value={String(streaks?.completed_sessions?.current || 0)}
                  />
                  <MetricCard
                    label="Longest session streak"
                    value={String(streaks?.completed_sessions?.longest || 0)}
                  />
                  <MetricCard
                    label="Top failure"
                    value={reflectionSummary?.top_failure_reason || 'None'}
                  />
                  <MetricCard
                    label="Top distraction"
                    value={reflectionSummary?.top_distraction_category || 'None'}
                  />
                </View>

                <View style={styles.chartGrid}>
                  <ChartCard
                    title="Objectives Completed by Day"
                    data={completedByDayData}
                    accentColor="#D6A436"
                    valueFormatter={(value) => `${Math.round(value)}`}
                    emptyLabel="No completed objectives recorded yet."
                  />
                  <ChartCard
                    title="Time Spent by Day"
                    data={timeSpentByDayData}
                    accentColor="#7EB6FF"
                    valueFormatter={(value) => formatHours(value)}
                    emptyLabel="No tracked time has been logged yet."
                  />
                  <ChartCard
                    title="Completion vs Missed"
                    data={completionVsMissedData}
                    accentColor="#F08C5B"
                    valueFormatter={(value) => `${Math.round(value)}`}
                    emptyLabel="No completion or missed data yet."
                  />
                  <ChartCard
                    title="Execution Trend"
                    data={executionTrendData}
                    accentColor="#66CFA4"
                    valueFormatter={(value) => formatScore(value)}
                    emptyLabel="Daily trend appears after sessions are tracked."
                  />
                  <ChartCard
                    title="Category Objective Completion"
                    data={objectiveCompletionData}
                    accentColor="#BBA66E"
                    valueFormatter={(value) => formatPercent(value)}
                    emptyLabel="No session objectives exist for this week yet."
                  />
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Category Objective Summary</Text>
                  {categoryObjectives.length > 0 ? (
                    categoryObjectives.map((item: any) => (
                      <View key={item.category} style={styles.detailCard}>
                        <View style={styles.detailHeader}>
                          <View style={styles.detailCopy}>
                            <Text style={styles.body}>{item.category}</Text>
                            <Text style={styles.subtle}>
                              {item.completed_objectives} / {item.objective_count} session
                              objectives explicitly marked complete
                            </Text>
                          </View>
                          <Text style={styles.metricValue}>
                            {formatPercent(item.completion_percent)}
                          </Text>
                        </View>
                        <MiniTrendStrip
                          data={normalizeObjectiveProgressData(
                            item.progress_by_day,
                            weekDates,
                          )}
                          accentColor="#D6A436"
                          maxValue={100}
                          emptyLabel="No objective progress is available yet."
                        />
                      </View>
                    ))
                  ) : (
                    <Text style={styles.body}>
                      No session objectives were tracked for this review window.
                    </Text>
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Category Growth Trends</Text>
                  {categoryTrends.length > 0 ? (
                    categoryTrends.map((item: any) => (
                      <TrendCard
                        key={item.label}
                        title={item.label}
                        subtitle={`Completion ${formatPercent(
                          item.current_completion_rate,
                        )}, ${item.current_completed_sessions}/${item.session_count} done, ${formatHours(
                          item.current_time_spent_minutes,
                        )} logged`}
                        completionDelta={item.completion_change_percent}
                        timeDelta={item.time_change_percent}
                        performanceDelta={item.performance_change_percent}
                        daily={(item.daily || []).map((point: any) => ({
                          label: point.label,
                          value: Number(point.performance_percent || 0),
                        }))}
                      />
                    ))
                  ) : (
                    <Text style={styles.body}>
                      No category trend baseline is available for this week yet.
                    </Text>
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Repeated Session Trends</Text>
                  {repeatedSessionTrends.length > 0 ? (
                    repeatedSessionTrends.map((item: any) => (
                      <TrendCard
                        key={item.label}
                        title={item.label}
                        subtitle={`Completion ${formatPercent(
                          item.current_completion_rate,
                        )}, ${item.current_completed_sessions}/${item.session_count} done, ${formatHours(
                          item.current_time_spent_minutes,
                        )} logged`}
                        completionDelta={item.completion_change_percent}
                        timeDelta={item.time_change_percent}
                        performanceDelta={item.performance_change_percent}
                        daily={(item.daily || []).map((point: any) => ({
                          label: point.label,
                          value: Number(point.performance_percent || 0),
                        }))}
                      />
                    ))
                  ) : (
                    <Text style={styles.body}>
                      Repeat the same session title at least twice across weeks to unlock a
                      direct comparison.
                    </Text>
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Habit Patterns</Text>
                  <Text style={styles.subtle}>
                    Missed-session count: {missedCount}
                  </Text>
                  {reflectionSummary?.top_failure_reason ? (
                    <Text style={styles.subtle}>
                      Most common failure reason: {reflectionSummary.top_failure_reason}{' '}
                      ({reflectionSummary.top_failure_reason_count})
                    </Text>
                  ) : null}
                  {reflectionSummary?.top_distraction_category ? (
                    <Text style={styles.subtle}>
                      Top distraction this week: {reflectionSummary.top_distraction_category}{' '}
                      ({reflectionSummary.top_distraction_count})
                    </Text>
                  ) : null}
                  {Array.isArray(report?.habits) && report.habits.length > 0 ? (
                    report.habits.slice(0, 5).map((item: any) => (
                      <View key={`${item.category}-${item.count}`} style={styles.listItem}>
                        <Text style={styles.body}>{item.category}</Text>
                        <Text style={styles.subtle}>
                          {item.count} misses - {item.minutes_lost} minutes lost
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.body}>
                      No missed-session patterns were recorded this week.
                    </Text>
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Session Timeline</Text>
                  {timeline.length > 0 ? (
                    timeline.map((item: any) => (
                      <View key={item.session_id} style={styles.detailCard}>
                        <View style={styles.detailHeader}>
                          <View style={styles.detailCopy}>
                            <Text style={styles.body}>{item.title}</Text>
                            <Text style={styles.subtle}>
                              {new Date(item.planned_start).toLocaleString()} -{' '}
                              {new Date(item.planned_end).toLocaleTimeString()}
                            </Text>
                          </View>
                          <Text style={styles.metricValue}>
                            {Math.round(Number(item.quality_score || 0))}
                          </Text>
                        </View>
                        {item.category ? (
                          <Text style={styles.subtle}>{item.category}</Text>
                        ) : null}
                        <Text style={styles.body}>
                          Planned: {item.objective || 'No objective recorded'}
                        </Text>
                        <Text style={styles.subtle}>
                          Actual: {item.actual_outcome || 'No reflection recorded'}
                        </Text>
                        <Text style={styles.subtle}>
                          {item.quality_label || 'Failed'} | {formatStartDelta(item.start_delta_minutes)}
                          {item.failure_reason ? ` | ${item.failure_reason}` : ''}
                          {item.distraction_category ? ` | ${item.distraction_category}` : ''}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.body}>
                      No session timeline is available for this review window yet.
                    </Text>
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Recommendations for Next Week</Text>
                  {Array.isArray(report?.recommendations) &&
                  report.recommendations.length > 0 ? (
                    report.recommendations.slice(0, 8).map((item: string) => (
                      <View key={item} style={styles.listItem}>
                        <Text style={styles.body}>{item}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.body}>
                      No extra advisory has been generated yet.
                    </Text>
                  )}
                </View>
              </>
            ) : null}

            {!loading && !error && !report ? (
              <Text style={styles.body}>No weekly review data is available yet.</Text>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    width: '100%',
    maxWidth: 980,
    maxHeight: '92%',
    alignSelf: 'center',
    backgroundColor: '#171717',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#2D2D2D',
    padding: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 6,
  },
  title: {
    color: '#D6A436',
    fontSize: 22,
    fontWeight: '700',
  },
  closeButton: {
    borderWidth: 1,
    borderColor: '#4A4A4A',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  closeButtonText: {
    color: '#F0F0F0',
    fontWeight: '600',
  },
  content: {
    gap: 14,
    paddingBottom: 8,
  },
  summaryCard: {
    backgroundColor: '#111111',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2B2B2B',
    padding: 14,
    gap: 8,
  },
  reflectionItem: {
    gap: 4,
    paddingTop: 2,
  },
  reflectionLabel: {
    color: '#C9AF69',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    minWidth: 150,
    flexGrow: 1,
    backgroundColor: '#101010',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2B2B2B',
    padding: 12,
    gap: 4,
  },
  metricLabel: {
    color: '#888C94',
    fontSize: 12,
  },
  metricValue: {
    color: '#F0F0F0',
    fontSize: 18,
    fontWeight: '700',
  },
  chartGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chartCard: {
    minWidth: 280,
    flexGrow: 1,
    backgroundColor: '#101010',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2B2B2B',
    padding: 14,
    gap: 10,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  chartColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  chartTrack: {
    width: '100%',
    height: 104,
    justifyContent: 'flex-end',
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    overflow: 'hidden',
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  chartBar: {
    width: '100%',
    borderRadius: 10,
  },
  chartValue: {
    color: '#F0F0F0',
    fontSize: 11,
    fontWeight: '600',
  },
  chartLabel: {
    color: '#888C94',
    fontSize: 11,
  },
  section: {
    backgroundColor: '#101010',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2B2B2B',
    padding: 14,
    gap: 8,
  },
  sectionTitle: {
    color: '#D6A436',
    fontSize: 18,
    fontWeight: '700',
  },
  detailCard: {
    backgroundColor: '#171717',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262626',
    padding: 12,
    gap: 8,
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  detailCopy: {
    flex: 1,
    gap: 4,
  },
  detailMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  deltaPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  deltaPositive: {
    backgroundColor: '#173425',
  },
  deltaNegative: {
    backgroundColor: '#3F1F1F',
  },
  deltaNeutral: {
    backgroundColor: '#2B2B2B',
  },
  deltaPillText: {
    color: '#F0F0F0',
    fontSize: 11,
    fontWeight: '700',
  },
  miniChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  miniChartColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  miniChartTrack: {
    width: '100%',
    height: 52,
    justifyContent: 'flex-end',
    borderRadius: 8,
    backgroundColor: '#111111',
    overflow: 'hidden',
    paddingHorizontal: 3,
    paddingBottom: 3,
  },
  miniChartTrackEmpty: {
    opacity: 0.45,
  },
  miniChartBar: {
    width: '100%',
    borderRadius: 6,
  },
  miniChartZeroMarker: {
    width: '100%',
    height: 2,
    borderRadius: 6,
    backgroundColor: '#8D7A49',
  },
  miniChartLabel: {
    color: '#888C94',
    fontSize: 10,
  },
  listItem: {
    backgroundColor: '#171717',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#252525',
    padding: 10,
    gap: 4,
  },
  devBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2A2212',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  devBadgeText: {
    color: '#F8D27A',
    fontSize: 11,
    fontWeight: '700',
  },
  body: {
    color: '#F0F0F0',
  },
  subtle: {
    color: '#888C94',
    fontSize: 12,
  },
  error: {
    color: '#F0F0F0',
    backgroundColor: '#4A2121',
    borderRadius: 8,
    padding: 10,
  },
});
