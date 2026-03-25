<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
export const MISSED_REASON_OPTIONS = [
=======
const MISSED_REASON_OPTIONS = [
>>>>>>> theirs
=======
const MISSED_REASON_OPTIONS = [
>>>>>>> theirs
=======
const MISSED_REASON_OPTIONS = [
>>>>>>> theirs
=======
const MISSED_REASON_OPTIONS = [
>>>>>>> theirs
=======
const MISSED_REASON_OPTIONS = [
>>>>>>> theirs
=======
const MISSED_REASON_OPTIONS = [
>>>>>>> theirs
=======
const MISSED_REASON_OPTIONS = [
>>>>>>> theirs
=======
const MISSED_REASON_OPTIONS = [
>>>>>>> theirs
=======
const MISSED_REASON_OPTIONS = [
>>>>>>> theirs
=======
const MISSED_REASON_OPTIONS = [
>>>>>>> theirs
=======
const MISSED_REASON_OPTIONS = [
>>>>>>> theirs
=======
const MISSED_REASON_OPTIONS = [
>>>>>>> theirs
=======
const MISSED_REASON_OPTIONS = [
>>>>>>> theirs
  'Social media',
  'YouTube',
  'Resting',
  'Other work',
  'Distraction',
  'Unknown',
  'Custom',
];

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
export function getAvailableActions(session) {
  const status = (session.status ?? 'planned').toLowerCase();

  if (status === 'completed') return [];
  if (status === 'active') return ['end'];
  if (status === 'missed') return [];

  return ['start', 'missed'];
}

export function buildSessionCards({ sessions, tasks, now = new Date() }) {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
export { MISSED_REASON_OPTIONS };

export function buildSessionCards({ sessions, tasks, now = new Date() }) {
  const taskMap = new Map(tasks.map((task) => [task.id, task]));
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
  return sessions.map((session) => {
    const plannedStart = new Date(session.planned_start ?? session.plannedStart);
    const plannedEnd = new Date(session.planned_end ?? session.plannedEnd);
    const actualStartRaw = session.actual_start ?? session.actualStart;
    const actualStart = actualStartRaw ? new Date(actualStartRaw) : null;
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours

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
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
    const status = (session.status ?? 'planned').toLowerCase();
    const latenessMinutes = actualStart
      ? Math.max(Math.round((actualStart.getTime() - plannedStart.getTime()) / 60000), 0)
      : Math.max(Math.round((now.getTime() - plannedStart.getTime()) / 60000), 0);
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
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
      status,
      latenessMinutes,
      latenessLabel: actualStart
        ? latenessMinutes > 0
          ? `${latenessMinutes} min late`
          : 'On time'
        : latenessMinutes > 0
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
        ? `${latenessMinutes} min behind`
        : 'On schedule',
      availableActions: getAvailableActions(session),
=======
          ? `${latenessMinutes} min behind schedule`
          : 'On schedule',
>>>>>>> theirs
=======
          ? `${latenessMinutes} min behind schedule`
          : 'On schedule',
>>>>>>> theirs
=======
          ? `${latenessMinutes} min behind schedule`
          : 'On schedule',
>>>>>>> theirs
=======
          ? `${latenessMinutes} min behind schedule`
          : 'On schedule',
>>>>>>> theirs
=======
          ? `${latenessMinutes} min behind schedule`
          : 'On schedule',
>>>>>>> theirs
=======
          ? `${latenessMinutes} min behind schedule`
          : 'On schedule',
>>>>>>> theirs
=======
          ? `${latenessMinutes} min behind schedule`
          : 'On schedule',
>>>>>>> theirs
=======
          ? `${latenessMinutes} min behind schedule`
          : 'On schedule',
>>>>>>> theirs
=======
          ? `${latenessMinutes} min behind schedule`
          : 'On schedule',
>>>>>>> theirs
=======
          ? `${latenessMinutes} min behind schedule`
          : 'On schedule',
>>>>>>> theirs
=======
          ? `${latenessMinutes} min behind schedule`
          : 'On schedule',
>>>>>>> theirs
=======
          ? `${latenessMinutes} min behind schedule`
          : 'On schedule',
>>>>>>> theirs
=======
          ? `${latenessMinutes} min behind schedule`
          : 'On schedule',
>>>>>>> theirs
    };
  });
}

<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
export function getCurrentSession(cards) {
  return cards.find((c) => c.status === 'active') ?? null;
}

export function formatElapsed(actualStart, now = new Date()) {
  if (!actualStart) return '00:00';

  const mins = Math.floor((now - new Date(actualStart)) / 60000);
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');

  return `${h}:${m}`;
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
export function getSessionActions(status) {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'planned') {
    return { canStart: true, canEnd: false, canMiss: true };
  }
  if (normalized === 'active') {
    return { canStart: false, canEnd: true, canMiss: false };
  }
  return { canStart: false, canEnd: false, canMiss: false };
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
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
}

export async function startSessionFlow(api, sessionCard) {
  await api.startSession({
    task_id: sessionCard.taskId,
    session_id: sessionCard.id,
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
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
=======
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
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
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
=======
>>>>>>> theirs
