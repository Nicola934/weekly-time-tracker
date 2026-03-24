export const DEFAULT_LATE_GRACE_MINUTES = 10;

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
    },
    voiceText,
  };
}

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
    });
  }

  return reminders;
}

export function getLateSessions(sessions, now = new Date()) {
  return sessions.filter((s) => {
    const status = s.status?.toLowerCase();
    if (['completed', 'missed', 'active'].includes(status)) return false;

    const planned = new Date(s.plannedStart);
    return planned.getTime() + 10 * 60000 <= now.getTime();
  });
}