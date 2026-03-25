export const DEFAULT_LATE_GRACE_MINUTES = 10;

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
export function buildVoiceText(config, type, name, late = 0) {
  const display = name || config.display_name || 'Operator';

  const prefix =
    config.tone === 'motivational' ? 'Momentum mode:' : 'Discipline mode:';

  const templates = {
    pre: config.pre_script.replace('{minutes}', config.pre_session_minutes),
    start: config.start_script,
    late: config.late_script.replace('{minutes}', late),
  };

  return `${prefix} ${display}, ${templates[type]}`;
}

export function buildNotificationPayload(
  session,
  config,
  type,
  name,
  late = 0
) {
  const voiceText = buildVoiceText(config, type, name, late);

  return {
    title:
      type === 'late'
        ? `${session.title} overdue`
        : `${session.title} ${type}`,
    body: voiceText,
    data: {
      sessionId: session.id,
      type,
      late,
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
export function buildVoiceText(config, eventType, displayName, latenessMinutes = 0) {
  const resolvedName = displayName || config.display_name || 'Operator';
  const prefix = config.tone === 'motivational' ? 'Momentum mode:' : 'Discipline mode:';
  const templateMap = {
    pre: config.pre_script.replace('{minutes}', String(config.pre_session_minutes)),
    start: config.start_script,
    late: config.late_script.replace('{minutes}', String(latenessMinutes)),
  };

  return `${prefix} ${resolvedName}, ${templateMap[eventType]}`;
}

export function buildNotificationPayload(session, config, eventType, displayName, latenessMinutes = 0) {
  const voiceText = buildVoiceText(config, eventType, displayName, latenessMinutes);
  const titleMap = {
    pre: `${session.title} starts soon`,
    start: `${session.title} starts now`,
    late: `${session.title} is overdue`,
  };

  return {
    title: titleMap[eventType],
    body: voiceText,
    data: {
      sessionId: session.id,
      taskId: session.taskId,
      eventType,
      latenessMinutes,
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
    },
    voiceText,
  };
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
export function buildSessionReminderPlan(session, config, now = new Date()) {
  const planned = new Date(session.plannedStart);
  const reminders = [];

  const pre = new Date(planned - config.pre_session_minutes * 60000);

  if (pre > now) {
    reminders.push({
      sessionId: session.id,
      eventType: 'pre',
      triggerAt: pre.toISOString(),
      payload: buildNotificationPayload(session, config, 'pre'),
    });
  }

  if (planned > now) {
    reminders.push({
      sessionId: session.id,
      eventType: 'start',
      triggerAt: planned.toISOString(),
      payload: buildNotificationPayload(session, config, 'start'),
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
export function buildSessionReminderPlan(session, config, now = new Date(), displayName) {
  const plannedStart = new Date(session.plannedStart);
  const reminders = [];
  const preTrigger = new Date(plannedStart.getTime() - config.pre_session_minutes * 60_000);

  if (preTrigger > now) {
    reminders.push({
      sessionId: session.id,
      eventType: 'pre',
      triggerAt: preTrigger.toISOString(),
      payload: buildNotificationPayload(session, config, 'pre', displayName),
    });
  }

  if (plannedStart > now) {
    reminders.push({
      sessionId: session.id,
      eventType: 'start',
      triggerAt: plannedStart.toISOString(),
      payload: buildNotificationPayload(session, config, 'start', displayName),
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
    });
  }

  return reminders;
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
export function getLateSessions(sessions, now = new Date()) {
  return sessions.filter((s) => {
    const status = s.status?.toLowerCase();
    if (['completed', 'missed', 'active'].includes(status)) return false;

    const planned = new Date(s.plannedStart);
    return planned.getTime() + 10 * 60000 <= now.getTime();
  });
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
export function getLateSessions(sessions, now = new Date(), graceMinutes = DEFAULT_LATE_GRACE_MINUTES) {
  return sessions.filter((session) => {
    const status = session.status?.toLowerCase();
    if (status === 'completed' || status === 'missed' || status === 'active') {
      return false;
    }

    const plannedStart = new Date(session.plannedStart);
    const lateAt = plannedStart.getTime() + graceMinutes * 60_000;
    return lateAt <= now.getTime();
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
