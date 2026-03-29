export const MISSED_REASON_OPTIONS = [
  'Social media',
  'YouTube',
  'Resting',
  'Other work',
  'Distraction',
  'Unknown',
  'Custom',
];

export const SESSION_FAILURE_REASON_OPTIONS = [
  'Distraction',
  'Underestimated effort',
  'Low energy',
  'External interruption',
  'Other',
];
export const START_WINDOW_LEAD_MINUTES = 60;

function getLocalTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function formatLocalDateTime(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hour = String(value.getHours()).padStart(2, '0');
  const minute = String(value.getMinutes()).padStart(2, '0');
  const second = String(value.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}

function normalizeDateValue(rawValue, parsedValue) {
  if (!rawValue) {
    return null;
  }

  if (typeof rawValue === 'string') {
    return rawValue;
  }

  return parsedValue.toISOString();
}

function normalizeReminderOffsetValue(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return null;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return null;
  }

  return parsedValue;
}

function normalizeTextValue(rawValue) {
  const text = String(rawValue ?? '').trim();
  return text ? text : null;
}

function normalizeNumberValue(rawValue) {
  const parsedValue = Number(rawValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function findCategoryGoals(categoryGoals, category) {
  const normalizedCategory = normalizeTextValue(category);
  if (!normalizedCategory) {
    return [];
  }

  for (const [existingCategory, goals] of Object.entries(categoryGoals || {})) {
    if (String(existingCategory).trim().toLowerCase() === normalizedCategory.toLowerCase()) {
      return Array.isArray(goals)
        ? goals
            .map((goal) => normalizeTextValue(goal))
            .filter(Boolean)
        : [];
    }
  }

  return [];
}

export function getTaskCategoryLabel(task) {
  return (
    normalizeTextValue(task?.category) ??
    normalizeTextValue(task?.long_term_goal) ??
    'Uncategorized'
  );
}

export function getTaskGoalContext(task) {
  const category = normalizeTextValue(task?.category);
  const defaultGoal = normalizeTextValue(task?.long_term_goal);

  if (!category || !defaultGoal) {
    return null;
  }

  if (category.toLowerCase() === defaultGoal.toLowerCase()) {
    return null;
  }

  return defaultGoal;
}

function normalizeObjectiveCompletedValue(rawValue) {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return false;
  }

  if (typeof rawValue === 'boolean') {
    return rawValue;
  }

  if (rawValue === 1 || rawValue === '1' || rawValue === 'true') {
    return true;
  }

  if (rawValue === 0 || rawValue === '0' || rawValue === 'false') {
    return false;
  }

  return null;
}

function formatMinuteUnit(value) {
  return `${value} minute${value === 1 ? '' : 's'}`;
}

export function formatPunctualityLabel(deltaMinutes) {
  if (!Number.isFinite(deltaMinutes)) {
    return 'On schedule';
  }

  const absoluteMinutes = Math.abs(deltaMinutes);
  if (absoluteMinutes === 0) {
    return 'Started on time';
  }

  if (deltaMinutes < 0) {
    return `Started ${formatMinuteUnit(absoluteMinutes)} early`;
  }

  return `Started ${formatMinuteUnit(absoluteMinutes)} late`;
}

export function formatStartDeltaLabel(deltaMinutes) {
  if (!Number.isFinite(deltaMinutes)) {
    return 'Pending';
  }

  const roundedMinutes = Math.round(Math.abs(deltaMinutes));
  if (roundedMinutes === 0) {
    return 'On time';
  }

  if (deltaMinutes < 0) {
    return `+${roundedMinutes} min early`;
  }

  return `-${roundedMinutes} min late`;
}

export function formatTimeSpent(actualStart, actualEnd) {
  if (!actualStart || !actualEnd) {
    return '00:00';
  }

  const elapsedMinutes = Math.max(
    Math.floor(
      (new Date(actualEnd).getTime() - new Date(actualStart).getTime()) / 60_000,
    ),
    0,
  );
  const hours = String(Math.floor(elapsedMinutes / 60)).padStart(2, '0');
  const minutes = String(elapsedMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function minutesBetween(start, end) {
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

function deriveQualityLabel(score, objectiveCompleted) {
  if (objectiveCompleted && score >= 80) {
    return 'Strong';
  }

  if (score >= 55) {
    return 'Partial';
  }

  return 'Failed';
}

function isWithinStartWindow(plannedStart, plannedEnd, now = new Date()) {
  if (!(plannedStart instanceof Date) || Number.isNaN(plannedStart.getTime())) {
    return false;
  }

  if (!(plannedEnd instanceof Date) || Number.isNaN(plannedEnd.getTime())) {
    return false;
  }

  const startWindowOpensAt =
    plannedStart.getTime() - START_WINDOW_LEAD_MINUTES * 60_000;
  return (
    plannedEnd.getTime() > now.getTime() && startWindowOpensAt <= now.getTime()
  );
}

function calculateSessionQuality({
  status,
  objectiveCompleted,
  plannedStart,
  plannedEnd,
  actualStart,
  actualEnd,
}) {
  if (String(status || '').toLowerCase() === 'missed') {
    return { score: 0, label: 'Failed' };
  }

  const objectivePoints = objectiveCompleted ? 60 : 20;
  const startDeltaMinutes =
    actualStart && plannedStart
      ? (new Date(actualStart).getTime() - new Date(plannedStart).getTime()) / 60_000
      : null;

  let punctualityPoints = 0;
  if (Number.isFinite(startDeltaMinutes)) {
    punctualityPoints =
      startDeltaMinutes <= 0
        ? 20
        : Math.max(20 - Math.min(startDeltaMinutes, 20), 0);
  }

  const plannedMinutes = minutesBetween(plannedStart, plannedEnd);
  const actualMinutes = minutesBetween(actualStart, actualEnd);
  let timePoints = 20;
  if (plannedMinutes > 0) {
    const timeRatio = actualMinutes / plannedMinutes;
    const timeAlignment = Math.max(1 - Math.abs(1 - timeRatio), 0);
    timePoints = Math.min(timeAlignment * 20, 20);
  }

  const score = Math.round((objectivePoints + punctualityPoints + timePoints) * 100) / 100;
  return {
    score,
    label: deriveQualityLabel(score, objectiveCompleted),
  };
}

function getControlState(session, now = new Date()) {
  const normalizedStatus = String(session?.status ?? 'planned').toLowerCase();

  if (normalizedStatus === 'active') {
    return 'active';
  }

  if (normalizedStatus !== 'planned') {
    return 'locked';
  }

  const plannedStart = new Date(session?.plannedStart ?? session?.planned_start ?? '');
  const plannedEnd = new Date(session?.plannedEnd ?? session?.planned_end ?? '');
  if (Number.isNaN(plannedStart.getTime()) || Number.isNaN(plannedEnd.getTime())) {
    return 'locked';
  }

  if (plannedEnd.getTime() <= now.getTime()) {
    return 'locked';
  }

  if (plannedStart.getTime() > now.getTime()) {
    return 'future';
  }

  return 'current';
}

function getAvailableActions({ session, hasActiveSession = false, now = new Date() }) {
  const controlState = getControlState(session, now);
  if (controlState === 'active') {
    return ['end'];
  }

  if (controlState !== 'future' && controlState !== 'current') {
    return [];
  }

  const plannedStart = new Date(session?.plannedStart ?? session?.planned_start ?? '');
  const plannedEnd = new Date(session?.plannedEnd ?? session?.planned_end ?? '');
  const isFutureSession = plannedStart.getTime() > now.getTime();
  const canStartFromWindow = isWithinStartWindow(plannedStart, plannedEnd, now);

  if (isFutureSession) {
    const actions = ['edit', 'delete'];
    if (canStartFromWindow && !hasActiveSession) {
      actions.unshift('start');
    }
    return actions;
  }

  if (!hasActiveSession) {
    return ['start', 'missed'];
  }

  return [];
}

export function getSessionActions(sessionOrStatus, options = {}) {
  const session =
    typeof sessionOrStatus === 'string'
      ? { status: sessionOrStatus }
      : sessionOrStatus;
  const availableActions = getAvailableActions({ session, ...options });

  return {
    availableActions,
    canStart: availableActions.includes('start'),
    canEnd: availableActions.includes('end'),
    canMiss: availableActions.includes('missed'),
  };
}

export function buildSessionCards({
  sessions,
  tasks,
  now = new Date(),
  categoryGoals = {},
}) {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const hasActiveSession = sessions.some(
    (session) => (session.status ?? 'planned').toLowerCase() === 'active',
  );

  return sessions.map((session) => {
    const plannedStartRaw = session.planned_start ?? session.plannedStart;
    const plannedEndRaw = session.planned_end ?? session.plannedEnd;
    const plannedStart = new Date(plannedStartRaw);
    const plannedEnd = new Date(plannedEndRaw);
    const actualStartRaw = session.actual_start ?? session.actualStart;
    const actualStart = actualStartRaw ? new Date(actualStartRaw) : null;
    const actualEndRaw = session.actual_end ?? session.actualEnd;
    const taskId = session.task_id ?? session.taskId;
    const reminderOffsetMinutes = normalizeReminderOffsetValue(
      session.reminder_offset_minutes ?? session.reminderOffsetMinutes,
    );
    const objectiveCompleted = normalizeObjectiveCompletedValue(
      session.objective_completed ?? session.objectiveCompleted,
    );
    const task = taskMap.get(taskId);
    const category = getTaskCategoryLabel(task);
    const goalContext =
      normalizeTextValue(session.goal_context ?? session.goalContext) ??
      getTaskGoalContext(task) ??
      findCategoryGoals(categoryGoals, category)[0] ??
      null;
    const status = (session.status ?? 'planned').toLowerCase();
    const objectiveText =
      normalizeTextValue(session.objective ?? session.objectiveText) ??
      normalizeTextValue(status === 'planned' ? session.output_notes : null) ??
      normalizeTextValue(task?.objective);
    const startDeltaMinutes =
      normalizeNumberValue(session.start_delta_minutes ?? session.startDeltaMinutes) ??
      (actualStart
        ? Math.round((actualStart.getTime() - plannedStart.getTime()) / 60_000)
        : null);
    const scheduleDeltaMinutes = Math.max(
      Math.round((now.getTime() - plannedStart.getTime()) / 60_000),
      0,
    );
    const actionState = getSessionActions(
      {
        status,
        plannedStart: plannedStartRaw,
        plannedEnd: plannedEndRaw,
      },
      { hasActiveSession, now },
    );
    const actualEnd = actualEndRaw ? new Date(actualEndRaw) : null;
    const controlState = getControlState(
      {
        status,
        plannedStart: plannedStartRaw,
        plannedEnd: plannedEndRaw,
      },
      now,
    );
    const storedQualityScore =
      normalizeNumberValue(session.quality_score ?? session.qualityScore);
    const quality = Number.isFinite(storedQualityScore)
      ? (() => {
          const storedLabel =
            normalizeTextValue(session.quality_label ?? session.qualityLabel) ??
            'Failed';
          const derivedLabel = deriveQualityLabel(storedQualityScore, objectiveCompleted);

          return {
            score: storedQualityScore,
            label:
              storedLabel === 'Failed' && derivedLabel !== 'Failed'
                ? derivedLabel
                : storedLabel,
          };
        })()
      : calculateSessionQuality({
          status,
          objectiveCompleted,
          plannedStart: plannedStartRaw,
          plannedEnd: plannedEndRaw,
          actualStart: actualStartRaw,
          actualEnd: actualEndRaw,
        });
    const hasLockedOutcome =
      session.objective_locked === true ||
      status === 'completed' ||
      status === 'missed' ||
      Boolean(actualEndRaw);
    const timingStatusLabel = actualStart
      ? formatPunctualityLabel(startDeltaMinutes)
      : status === 'missed'
        ? 'Missed'
        : isWithinStartWindow(plannedStart, plannedEnd, now)
          ? 'Start window open'
        : controlState === 'future'
          ? 'Scheduled'
          : 'Locked for review';

    return {
      id: session.id,
      taskId,
      scheduleBlockId: session.schedule_block_id ?? session.scheduleBlockId ?? null,
      title: task?.title ?? `Task ${taskId}`,
      category,
      goalContext,
      goal: objectiveText ?? 'Execution block',
      objectiveText,
      plannedStart: normalizeDateValue(plannedStartRaw, plannedStart),
      plannedEnd: normalizeDateValue(plannedEndRaw, plannedEnd),
      actualStart: normalizeDateValue(actualStartRaw, actualStart) ?? null,
      actualEnd: normalizeDateValue(
        actualEndRaw,
        actualEnd,
      ),
      completionPercent:
        session.completion_percent ?? session.completionPercent ?? 0,
      objectiveCompleted,
      objectiveStatusLabel: objectiveCompleted ? 'Completed' : 'Not completed',
      objectiveLocked: session.objective_locked === true || status !== 'planned',
      status,
      timezone: session.timezone ?? getLocalTimezone(),
      reminderOffsetMinutes,
      startDeltaMinutes,
      startDeltaLabel: formatStartDeltaLabel(startDeltaMinutes),
      scheduleDeltaMinutes,
      timingStatusLabel,
      spentLabel: actualStart && actualEnd
        ? formatTimeSpent(actualStartRaw, actualEndRaw)
        : null,
      qualityScore: hasLockedOutcome ? quality.score : null,
      qualityLabel: hasLockedOutcome ? quality.label : null,
      reflectionNotes:
        normalizeTextValue(session.reflection_notes ?? session.reflectionNotes) ?? '',
      failureReason:
        normalizeTextValue(session.failure_reason ?? session.failureReason) ?? null,
      failureReasonDetail:
        normalizeTextValue(
          session.failure_reason_detail ?? session.failureReasonDetail,
        ) ?? null,
      distractionCategory:
        normalizeTextValue(
          session.distraction_category ?? session.distractionCategory,
        ) ?? null,
      actualOutcomeLabel:
        normalizeTextValue(session.reflection_notes ?? session.reflectionNotes) ??
        (objectiveCompleted
          ? 'Objective completed.'
          : status === 'missed'
            ? 'Session missed.'
            : 'Objective not completed.'),
      controlState,
      availableActions: actionState.availableActions,
    };
  });
}

export function getCurrentSession(sessionCards) {
  return sessionCards.find((session) => session.status === 'active') ?? null;
}

export function formatElapsed(actualStart, now = new Date()) {
  if (!actualStart) {
    return '00:00';
  }

  const elapsedMinutes = Math.max(
    Math.floor((now.getTime() - new Date(actualStart).getTime()) / 60_000),
    0,
  );
  const hours = String(Math.floor(elapsedMinutes / 60)).padStart(2, '0');
  const minutes = String(elapsedMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export async function startSessionFlow(api, sessionCard) {
  const startedSession = await api.startSession({
    task_id: sessionCard.taskId,
    session_id: sessionCard.id,
    schedule_block_id: sessionCard.scheduleBlockId ?? null,
    actual_start: formatLocalDateTime(new Date()),
    timezone: sessionCard.timezone ?? getLocalTimezone(),
  });

  const refreshed = await api.refresh();
  return {
    session: startedSession,
    refreshed,
  };
}

export async function endSessionFlow(api, sessionCard, completionPercent = 100) {
  const completionSettings =
    typeof completionPercent === 'object'
      ? completionPercent
      : { completionPercent };
  const actualEnd = new Date();
  const actualEndText = formatLocalDateTime(actualEnd);
  const endedSession = await api.endSession({
    session_id: sessionCard.id,
    actual_end: actualEndText,
    objective_completed: completionSettings.objectiveCompleted ?? false,
    completion_percent: completionSettings.completionPercent ?? 100,
    output_notes:
      completionSettings.outputNotes ?? 'Session ended from execution panel',
    reflection_notes: completionSettings.reflectionNotes ?? '',
    failure_reason: completionSettings.failureReason ?? null,
    failure_reason_detail: completionSettings.failureReasonDetail ?? null,
    distraction_category: completionSettings.distractionCategory ?? null,
  });

  const refreshed = completionSettings.refresh === false
    ? null
    : await api.refresh();
  return {
    session: endedSession,
    refreshed,
    spentLabel: formatTimeSpent(sessionCard.actualStart, actualEndText),
  };
}

export async function deleteSessionFlow(api, sessionCard) {
  await api.deleteSession(sessionCard.id);

  return api.refresh();
}

export async function skipSessionFlow(api, sessionCard) {
  await api.markSessionMissed({
    session_id: sessionCard.id,
    reason_category: 'Unknown',
    custom_reason: 'Skipped from notification',
    time_lost_minutes: 30,
  });

  return api.refresh();
}

export async function submitMissedSessionFlow(
  api,
  sessionCard,
  reasonCategory,
  customReason = '',
) {
  await api.markSessionMissed({
    session_id: sessionCard.id,
    reason_category: reasonCategory,
    custom_reason: customReason || null,
    time_lost_minutes: 30,
  });

  return api.refresh();
}
