export const MISSED_REASON_OPTIONS = [
  'Social media',
  'YouTube',
  'Resting',
  'Other work',
  'Distraction',
  'Unknown',
  'Custom',
];

function getAvailableActions({ status, hasActiveSession = false }) {
  const normalizedStatus = (status || 'planned').toLowerCase();

  if (normalizedStatus === 'active') {
    return ['end'];
  }

  if (normalizedStatus !== 'planned') {
    return [];
  }

  if (hasActiveSession) {
    return [];
  }

  return ['start', 'missed'];
}

export function getSessionActions(sessionOrStatus, options = {}) {
  const status =
    typeof sessionOrStatus === 'string' ? sessionOrStatus : sessionOrStatus?.status;
  const availableActions = getAvailableActions({ status, ...options });

  return {
    availableActions,
    canStart: availableActions.includes('start'),
    canEnd: availableActions.includes('end'),
    canMiss: availableActions.includes('missed'),
  };
}

export function buildSessionCards({ sessions, tasks, now = new Date() }) {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  const hasActiveSession = sessions.some(
    (session) => (session.status ?? 'planned').toLowerCase() === 'active',
  );

  return sessions.map((session) => {
    const plannedStart = new Date(session.planned_start ?? session.plannedStart);
    const plannedEnd = new Date(session.planned_end ?? session.plannedEnd);
    const actualStartRaw = session.actual_start ?? session.actualStart;
    const actualStart = actualStartRaw ? new Date(actualStartRaw) : null;
    const taskId = session.task_id ?? session.taskId;
    const task = taskMap.get(taskId);
    const status = (session.status ?? 'planned').toLowerCase();
    const latenessMinutes = actualStart
      ? Math.max(
          Math.round((actualStart.getTime() - plannedStart.getTime()) / 60_000),
          0,
        )
      : Math.max(Math.round((now.getTime() - plannedStart.getTime()) / 60_000), 0);
    const actionState = getSessionActions(status, { hasActiveSession });

    return {
      id: session.id,
      taskId,
      scheduleBlockId: session.schedule_block_id ?? session.scheduleBlockId ?? null,
      title: task?.title ?? `Task ${taskId}`,
      goal: task?.objective ?? session.output_notes ?? 'Execution block',
      plannedStart: plannedStart.toISOString(),
      plannedEnd: plannedEnd.toISOString(),
      actualStart: actualStart?.toISOString() ?? null,
      actualEnd: session.actual_end ?? session.actualEnd ?? null,
      completionPercent:
        session.completion_percent ?? session.completionPercent ?? 0,
      status,
      latenessMinutes,
      latenessLabel: actualStart
        ? latenessMinutes > 0
          ? `${latenessMinutes} min late`
          : 'On time'
        : latenessMinutes > 0
          ? `${latenessMinutes} min behind schedule`
          : 'On schedule',
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
  await api.startSession({
    task_id: sessionCard.taskId,
    session_id: sessionCard.id,
    schedule_block_id: sessionCard.scheduleBlockId ?? null,
    timezone: 'UTC',
  });

  return api.refresh();
}

export async function endSessionFlow(api, sessionCard, completionPercent = 100) {
  await api.endSession({
    session_id: sessionCard.id,
    completion_percent: completionPercent,
    output_notes: 'Completed from execution panel',
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
