export const DEFAULT_LATE_GRACE_MINUTES = 5;
export const LATE_NUDGE_INTERVAL_MINUTES = 5;
export const REMINDER_DELIVERY_GRACE_MS = 60_000;
export const SESSION_NOTIFICATION_CATEGORY_ID = 'weekly-execution-session-actions';
export const SESSION_NOTIFICATION_START_ACTION_ID =
  'weekly-execution-session-start';
export const SESSION_NOTIFICATION_SKIP_ACTION_ID =
  'weekly-execution-session-skip';

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || '';
}

function formatMinuteUnit(value) {
  return `${value} minute${value === 1 ? '' : 's'}`;
}

function pickVariant(session, latenessMinutes, variants) {
  const safeVariants = Array.isArray(variants) ? variants.filter(Boolean) : [];
  if (safeVariants.length === 0) {
    return '';
  }

  const seed =
    Math.abs(Number(session?.id) || 0) + Math.max(Math.floor(latenessMinutes / 5), 1);
  return safeVariants[seed % safeVariants.length];
}

function resolveObjectiveText(session) {
  return (
    normalizeText(session?.objectiveText) ||
    normalizeText(session?.objective) ||
    normalizeText(session?.goal)
  );
}

function resolveGoalContext(session) {
  return (
    normalizeText(session?.goalContext) ||
    normalizeText(session?.goal_context)
  );
}

function resolveCategoryText(session) {
  const category = normalizeText(session?.category);
  if (!category || category.toLowerCase() === 'uncategorized') {
    return '';
  }

  return category;
}

function buildLeadSentence(session, latenessMinutes) {
  const sessionTitle = normalizeText(session?.title) || 'This session';
  return pickVariant(session, latenessMinutes, [
    `You're ${formatMinuteUnit(latenessMinutes)} late for ${sessionTitle}.`,
    `${sessionTitle} should have started ${formatMinuteUnit(latenessMinutes)} ago.`,
    `${sessionTitle} is now ${formatMinuteUnit(latenessMinutes)} behind schedule.`,
  ]);
}

function buildObjectiveSentence(session) {
  const objective = resolveObjectiveText(session);
  return objective ? `Objective: ${objective}.` : '';
}

function buildContextSentence(session) {
  const goalContext = resolveGoalContext(session);
  const category = resolveCategoryText(session);

  if (goalContext && category) {
    return pickVariant(session, 5, [
      `This block supports ${goalContext} inside ${category}.`,
      `This session is part of ${category} and pushes ${goalContext} forward.`,
      `This work belongs to ${category} and supports ${goalContext}.`,
    ]);
  }

  if (goalContext) {
    return pickVariant(session, 5, [
      `This session supports ${goalContext}.`,
      `This block helps move ${goalContext}.`,
      `This work is tied directly to ${goalContext}.`,
    ]);
  }

  if (category) {
    return pickVariant(session, 5, [
      `This block belongs to ${category}.`,
      `This work sits inside ${category}.`,
      `This session protects momentum in ${category}.`,
    ]);
  }

  return '';
}

function buildConsequenceSentence(session, latenessMinutes) {
  const goalContext = resolveGoalContext(session);
  const category = resolveCategoryText(session);
  const contextLabel = goalContext || category;

  if (latenessMinutes >= 15) {
    if (contextLabel) {
      return pickVariant(session, latenessMinutes, [
        `If this keeps drifting, ${contextLabel} drifts with it.`,
        `The cost of delay is already hitting ${contextLabel}.`,
        'Missing this session costs more than the comfort of delaying it.',
      ]);
    }

    return pickVariant(session, latenessMinutes, [
      'Missing this session costs more than the comfort of delaying it.',
      'You are trading momentum away every extra minute here.',
      'A late start now is easier than recovering a lost block later.',
    ]);
  }

  if (latenessMinutes >= 10) {
    if (goalContext) {
      return pickVariant(session, latenessMinutes, [
        `Missing this block slows progress toward ${goalContext}.`,
        `Letting this slide pushes ${goalContext} further out.`,
        `The longer you wait, the harder it gets to protect ${goalContext}.`,
      ]);
    }

    if (category) {
      return pickVariant(session, latenessMinutes, [
        `This delay weakens momentum inside ${category}.`,
        `Another miss here makes ${category} harder to recover later.`,
        `If this block slips, ${category} loses protected time.`,
      ]);
    }

    return pickVariant(session, latenessMinutes, [
      'The longer this waits, the harder the block is to recover cleanly.',
      'A delay here usually becomes a weaker finish later.',
      'This keeps getting more expensive the longer you postpone it.',
    ]);
  }

  if (goalContext) {
    return pickVariant(session, latenessMinutes, [
      `A miss here slows progress toward ${goalContext}.`,
      `This delay makes ${goalContext} harder to compound.`,
      `A short delay here pushes ${goalContext} back.`,
    ]);
  }

  if (category) {
    return pickVariant(session, latenessMinutes, [
      `A miss here slows momentum in ${category}.`,
      `This block is how ${category} stays on track.`,
      `A short delay here makes ${category} harder to keep moving.`,
    ]);
  }

  return pickVariant(session, latenessMinutes, [
    'A short delay here turns into a weaker finish later.',
    'The cost of waiting is higher than it feels right now.',
    'Start now before the block loses its shape.',
  ]);
}

export function resolveReminderLeadMinutes(session, config) {
  const sessionOffset =
    session?.reminderOffsetMinutes ?? session?.reminder_offset_minutes;
  const parsedOffset = Number(sessionOffset);

  if (Number.isFinite(parsedOffset) && parsedOffset >= 0) {
    return parsedOffset;
  }

  return config.pre_session_minutes;
}

export function buildVoiceText(
  session,
  config,
  eventType,
  _displayName,
  options = {},
) {
  const { latenessMinutes = 0, reminderLeadMinutes = config.pre_session_minutes } =
    options;
  const sessionTitle = normalizeText(session?.title) || 'This session';

  if (eventType === 'pre') {
    return `${sessionTitle} starts in ${formatMinuteUnit(reminderLeadMinutes)}.`;
  }

  if (eventType === 'start') {
    return `${sessionTitle} starts now.`;
  }

  return [
    buildLeadSentence(session, latenessMinutes),
    buildObjectiveSentence(session),
    buildContextSentence(session),
    buildConsequenceSentence(session, latenessMinutes),
  ]
    .filter(Boolean)
    .join(' ');
}

export function buildNotificationPayload(
  session,
  config,
  eventType,
  displayName,
  options = {},
) {
  const reminderLeadMinutes = resolveReminderLeadMinutes(session, config);
  const { latenessMinutes = 0 } = options;
  const voiceText = buildVoiceText(
    session,
    config,
    eventType,
    displayName,
    { latenessMinutes, reminderLeadMinutes },
  );
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
      reminderLeadMinutes,
      category: normalizeText(session?.category) || null,
      goalContext: resolveGoalContext(session) || null,
      objective: resolveObjectiveText(session) || null,
    },
    voiceText,
  };
}

export function buildSessionReminderPlan(
  session,
  config,
  now = new Date(),
  displayName,
  options = {},
) {
  const status = String(session?.status ?? 'planned').toLowerCase();
  if (status !== 'planned') {
    return [];
  }

  const plannedStart = new Date(session.plannedStart);
  const reminders = [];
  const reminderLeadMinutes = resolveReminderLeadMinutes(session, config);
  const immediateGraceMs =
    options.immediateGraceMs ?? REMINDER_DELIVERY_GRACE_MS;
  const preTrigger = new Date(
    plannedStart.getTime() - reminderLeadMinutes * 60_000,
  );

  if (
    reminderLeadMinutes > 0 &&
    preTrigger.getTime() + immediateGraceMs >= now.getTime()
  ) {
    reminders.push({
      sessionId: session.id,
      eventType: 'pre',
      triggerAt: preTrigger.toISOString(),
      payload: buildNotificationPayload(session, config, 'pre', displayName),
    });
  }

  if (plannedStart.getTime() + immediateGraceMs >= now.getTime()) {
    reminders.push({
      sessionId: session.id,
      eventType: 'start',
      triggerAt: plannedStart.toISOString(),
      payload: buildNotificationPayload(session, config, 'start', displayName),
    });
  }

  return reminders;
}

export function getLateSessions(
  sessions,
  now = new Date(),
  graceMinutes = DEFAULT_LATE_GRACE_MINUTES,
) {
  return sessions.filter((session) => {
    const status = String(session?.status ?? 'planned').toLowerCase();
    if (status === 'completed' || status === 'missed' || status === 'active') {
      return false;
    }

    const plannedStart = new Date(session.plannedStart);
    const plannedEnd = new Date(session.plannedEnd);
    const lateAt = plannedStart.getTime() + graceMinutes * 60_000;
    return (
      lateAt <= now.getTime() &&
      plannedEnd.getTime() > now.getTime()
    );
  });
}
