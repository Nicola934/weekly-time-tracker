export const MISSED_REASON_OPTIONS = [
  'Social media',
  'YouTube',
  'Resting',
  'Other work',
  'Distraction',
  'Unknown',
  'Custom',
];

export function getAvailableActions(session) {
  const status = (session.status ?? 'planned').toLowerCase();

  if (status === 'completed') return [];
  if (status === 'active') return ['end'];
  if (status === 'missed') return [];

  return ['start', 'missed'];
}

export function buildSessionCards({ sessions, tasks, now = new Date() }) {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  return sessions.map((session) => {
    const plannedStart = new Date(session.planned_start ?? session.plannedStart);
    const plannedEnd = new Date(session.planned_end ?? session.plannedEnd);
    const actualStartRaw = session.actual_start ?? session.actualStart;
    const actualStart = actualStartRaw ? new Date(actualStartRaw) : null;

    const status = (session.status ?? 'planned').toLowerCase();

    const latenessMinutes = actualStart
      ? Math.max(Math.round((actualStart - plannedStart) / 60000), 0)
      : Math.max(Math.round((now - plannedStart) / 60000), 0);

    return {
      id: session.id,
      taskId: session.task_id ?? session.taskId,
      title:
        taskMap.get(session.task_id ?? session.taskId)?.title ??
        `Task ${session.task_id ?? session.taskId}`,
      goal:
        taskMap.get(session.task_id ?? session.taskId)?.objective ??
        'Execution block',
      plannedStart: plannedStart.toISOString(),
      plannedEnd: plannedEnd.toISOString(),
      actualStart: actualStart?.toISOString() ?? null,
      actualEnd: session.actual_end ?? null,
      completionPercent: session.completion_percent ?? 0,
      status,
      latenessMinutes,
      latenessLabel: actualStart
        ? latenessMinutes > 0
          ? `${latenessMinutes} min late`
          : 'On time'
        : latenessMinutes > 0
        ? `${latenessMinutes} min behind`
        : 'On schedule',
      availableActions: getAvailableActions(session),
    };
  });
}

export function getCurrentSession(cards) {
  return cards.find((c) => c.status === 'active') ?? null;
}

export function formatElapsed(actualStart, now = new Date()) {
  if (!actualStart) return '00:00';

  const mins = Math.floor((now - new Date(actualStart)) / 60000);
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');

  return `${h}:${m}`;
}

export async function startSessionFlow(api, sessionCard) {
  await api.startSession({
    task_id: sessionCard.taskId,
    session_id: sessionCard.id,
    timezone: 'UTC',
  });

  return api.refresh();
}

export async function endSessionFlow(api, sessionCard, completion = 100) {
  await api.endSession({
    session_id: sessionCard.id,
    completion_percent: completion,
    output_notes: 'Completed via UI',
  });

  return api.refresh();
}

export async function submitMissedSessionFlow(
  api,
  sessionCard,
  reason,
  custom = ''
) {
  await api.markSessionMissed({
    session_id: sessionCard.id,
    reason_category: reason,
    custom_reason: custom || null,
    time_lost_minutes: 30,
  });

  return api.refresh();
}