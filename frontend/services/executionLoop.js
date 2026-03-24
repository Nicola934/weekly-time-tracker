const MISSED_REASON_OPTIONS = [
  'Social media',
  'YouTube',
  'Resting',
  'Other work',
  'Distraction',
  'Unknown',
  'Custom',
];

export { MISSED_REASON_OPTIONS };

export function buildSessionCards({ sessions, tasks, now = new Date() }) {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
  return sessions.map((session) => {
    const plannedStart = new Date(session.planned_start ?? session.plannedStart);
    const plannedEnd = new Date(session.planned_end ?? session.plannedEnd);
    const actualStartRaw = session.actual_start ?? session.actualStart;
    const actualStart = actualStartRaw ? new Date(actualStartRaw) : null;
    const status = (session.status ?? 'planned').toLowerCase();
    const latenessMinutes = actualStart ? Math.max(Math.round((actualStart.getTime() - plannedStart.getTime()) / 60000), 0) : Math.max(Math.round((now.getTime() - plannedStart.getTime()) / 60000), 0);
    return {
      id: session.id,
      taskId: session.task_id ?? session.taskId,
      title: taskMap.get(session.task_id ?? session.taskId)?.title ?? `Task ${session.task_id ?? session.taskId}`,
      goal: taskMap.get(session.task_id ?? session.taskId)?.objective ?? session.output_notes ?? 'Execution block',
      plannedStart: plannedStart.toISOString(),
      plannedEnd: plannedEnd.toISOString(),
      actualStart: actualStart?.toISOString() ?? null,
      actualEnd: session.actual_end ?? session.actualEnd ?? null,
      completionPercent: session.completion_percent ?? session.completionPercent ?? 0,
      status,
      latenessMinutes,
      latenessLabel: actualStart ? (latenessMinutes > 0 ? `${latenessMinutes} min late` : 'On time') : latenessMinutes > 0 ? `${latenessMinutes} min behind schedule` : 'On schedule',
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
  const elapsedMinutes = Math.max(Math.floor((now.getTime() - new Date(actualStart).getTime()) / 60000), 0);
  const hours = String(Math.floor(elapsedMinutes / 60)).padStart(2, '0');
  const minutes = String(elapsedMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export async function startSessionFlow(api, sessionCard) {
  await api.startSession({
    task_id: sessionCard.taskId,
    session_id: sessionCard.id,
    schedule_block_id: null,
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

export async function submitMissedSessionFlow(api, sessionCard, reasonCategory, customReason = '') {
  await api.markSessionMissed({
    session_id: sessionCard.id,
    reason_category: reasonCategory,
    custom_reason: customReason || null,
    time_lost_minutes: 30,
  });
  return api.refresh();
}
