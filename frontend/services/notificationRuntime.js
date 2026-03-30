import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import * as Notifications from 'expo-notifications';

import {
  DEFAULT_LATE_GRACE_MINUTES,
  buildNotificationPayload,
  buildSessionReminderPlan,
  getLateSessions,
  LATE_NUDGE_INTERVAL_MINUTES,
  SESSION_NOTIFICATION_CATEGORY_ID,
  SESSION_NOTIFICATION_SKIP_ACTION_ID,
  SESSION_NOTIFICATION_START_ACTION_ID,
} from './notificationPlan.js';
import {
  extractSpeechTextFromNotification,
  shouldAutoSpeakNotification,
} from './notificationDelivery.js';
import {
  buildReminderKey,
  clearScheduledReminder,
  clearSessionNotificationState,
  createNotificationStorage,
  hasDeliveredLateReminder,
  loadDisplayName,
  loadNotificationState,
  markLateReminderDelivered,
  pruneInactiveLateReminders,
  reconcileStoredReminders,
  saveNotificationState,
} from './notificationState.js';

const NOTIFICATION_LOG_PREFIX = '[notifications]';
const ENABLE_VOICE_DELIVERY =
  process.env.EXPO_PUBLIC_ENABLE_VOICE_FEATURES !== 'false';
const ANDROID_NOTIFICATION_CHANNEL_ID = 'weekly-execution-reminders';
let notificationHandlerConfigured = false;
let androidNotificationChannelPromise = null;

function getWebNotificationApi() {
  try {
    if (
      typeof window !== 'undefined' &&
      typeof window.Notification === 'function'
    ) {
      return window.Notification;
    }
  } catch (nextError) {
    logNotificationError('web notification API unavailable', nextError);
  }

  return null;
}

function getWebSpeechApi() {
  try {
    if (
      typeof window !== 'undefined' &&
      window.speechSynthesis &&
      typeof window.SpeechSynthesisUtterance === 'function'
    ) {
      return {
        speechSynthesis: window.speechSynthesis,
        SpeechSynthesisUtterance: window.SpeechSynthesisUtterance,
      };
    }
  } catch (nextError) {
    logNotificationError('web speech API unavailable', nextError);
  }

  return null;
}

function logNotificationInfo(message, details) {
  if (details) {
    console.info(`${NOTIFICATION_LOG_PREFIX} ${message}`, details);
    return;
  }

  console.info(`${NOTIFICATION_LOG_PREFIX} ${message}`);
}

function logNotificationError(message, error, details) {
  if (details) {
    console.error(`${NOTIFICATION_LOG_PREFIX} ${message}`, details, error);
    return;
  }

  console.error(`${NOTIFICATION_LOG_PREFIX} ${message}`, error);
}

function ensureNotificationHandlerConfigured() {
  if (notificationHandlerConfigured || Platform.OS === 'web') {
    return notificationHandlerConfigured;
  }

  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    notificationHandlerConfigured = true;
    logNotificationInfo('runtime init');
  } catch (nextError) {
    logNotificationError('failed to configure notification handler', nextError);
  }

  return notificationHandlerConfigured;
}

async function ensureAndroidNotificationChannelAsync() {
  if (Platform.OS !== 'android') {
    return false;
  }

  if (androidNotificationChannelPromise) {
    return androidNotificationChannelPromise;
  }

  androidNotificationChannelPromise = Notifications.setNotificationChannelAsync(
    ANDROID_NOTIFICATION_CHANNEL_ID,
    {
      name: 'Session reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      enableVibrate: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      sound: 'default',
    },
  )
    .then(() => {
      logNotificationInfo('android notification channel ready', {
        channelId: ANDROID_NOTIFICATION_CHANNEL_ID,
      });
      return true;
    })
    .catch((nextError) => {
      androidNotificationChannelPromise = null;
      logNotificationError(
        'failed to configure android notification channel',
        nextError,
      );
      return false;
    });

  return androidNotificationChannelPromise;
}

function createNativeNotifier() {
  ensureNotificationHandlerConfigured();
  return {
    async schedule(reminder) {
      await ensureAndroidNotificationChannelAsync();
      return Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.payload.title,
          body: reminder.payload.body,
          data: reminder.payload.data,
          categoryIdentifier: SESSION_NOTIFICATION_CATEGORY_ID,
          ...(Platform.OS === 'android'
            ? { channelId: ANDROID_NOTIFICATION_CHANNEL_ID }
            : {}),
          sound: true,
        },
        trigger: new Date(reminder.triggerAt),
      });
    },
    async cancel(identifier) {
      if (identifier) {
        await Notifications.cancelScheduledNotificationAsync(identifier);
      }
    },
    async present(payload) {
      await ensureAndroidNotificationChannelAsync();
      await Notifications.presentNotificationAsync({
        title: payload.title,
        body: payload.body,
        data: payload.data,
        categoryIdentifier: SESSION_NOTIFICATION_CATEGORY_ID,
        ...(Platform.OS === 'android'
          ? { channelId: ANDROID_NOTIFICATION_CHANNEL_ID }
          : {}),
        sound: true,
      });

      return 'native-presented';
    },
  };
}

function createWebNotifier() {
  return {
    async schedule(reminder) {
      return `${buildReminderKey(reminder.sessionId, reminder.eventType)}:${reminder.triggerAt}`;
    },
    async cancel() {
      return undefined;
    },
    async present(payload) {
      try {
        const WebNotification = getWebNotificationApi();
        if (WebNotification && WebNotification.permission === 'granted') {
          new WebNotification(payload.title, { body: payload.body });
          return 'web-notification';
        }
      } catch (nextError) {
        logNotificationError('web notification presentation failed', nextError);
      }

      return 'notification-unavailable';
    },
  };
}

function normalizePermissionState(status) {
  if (status === 'granted' || status === 'denied' || status === 'default') {
    return status;
  }

  return 'unavailable';
}

function normalizeNotificationAction(response) {
  const actionIdentifier = String(response?.actionIdentifier || '');
  if (
    actionIdentifier !== SESSION_NOTIFICATION_START_ACTION_ID &&
    actionIdentifier !== SESSION_NOTIFICATION_SKIP_ACTION_ID
  ) {
    return null;
  }

  const data = response?.notification?.request?.content?.data ?? {};
  const sessionId = Number(data.sessionId);
  if (!Number.isFinite(sessionId) || sessionId <= 0) {
    return null;
  }

  return {
    actionIdentifier,
    sessionId,
    taskId: Number.isFinite(Number(data.taskId)) ? Number(data.taskId) : null,
    eventType: typeof data.eventType === 'string' ? data.eventType : null,
    notificationId: response?.notification?.request?.identifier ?? null,
  };
}

function normalizeNotificationIdentifier(notification) {
  const identifier = notification?.request?.identifier;
  return typeof identifier === 'string' && identifier.trim()
    ? identifier.trim()
    : '';
}

export async function configureNotificationActions() {
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    ensureNotificationHandlerConfigured();
    await ensureAndroidNotificationChannelAsync();
    await Notifications.setNotificationCategoryAsync(
      SESSION_NOTIFICATION_CATEGORY_ID,
      [
        {
          identifier: SESSION_NOTIFICATION_START_ACTION_ID,
          buttonTitle: 'Start',
          options: {
            opensAppToForeground: false,
          },
        },
        {
          identifier: SESSION_NOTIFICATION_SKIP_ACTION_ID,
          buttonTitle: 'Skip',
          options: {
            isDestructive: true,
            opensAppToForeground: false,
          },
        },
      ],
    );
    logNotificationInfo('notification actions configured');
    return true;
  } catch (nextError) {
    logNotificationError('failed to configure notification actions', nextError);
    return false;
  }
}

export function subscribeToNotificationActions({
  onStart,
  onSkip,
  onError,
}) {
  if (Platform.OS === 'web') {
    return () => undefined;
  }

  ensureNotificationHandlerConfigured();
  logNotificationInfo('notification action subscription init');
  let isClosed = false;
  const handledResponses = new Set();

  const dispatch = async (response) => {
    const action = normalizeNotificationAction(response);
    if (!action) {
      await Notifications.clearLastNotificationResponseAsync().catch(
        () => undefined,
      );
      return;
    }

    const responseKey = `${action.notificationId || 'unknown'}:${action.actionIdentifier}`;
    if (handledResponses.has(responseKey)) {
      return;
    }
    handledResponses.add(responseKey);

    try {
      if (action.actionIdentifier === SESSION_NOTIFICATION_START_ACTION_ID) {
        await onStart?.(action);
      } else if (action.actionIdentifier === SESSION_NOTIFICATION_SKIP_ACTION_ID) {
        await onSkip?.(action);
      }

      if (action.notificationId) {
        await Notifications.dismissNotificationAsync(action.notificationId).catch(
          () => undefined,
        );
      }
    } catch (error) {
      onError?.(error);
    } finally {
      await Notifications.clearLastNotificationResponseAsync().catch(
        () => undefined,
      );
    }
  };

  void configureNotificationActions();
  void Notifications.getLastNotificationResponseAsync()
    .then((response) => {
      if (!isClosed && response) {
        void dispatch(response);
      }
    })
    .catch((error) => {
      onError?.(error);
    });

  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      void dispatch(response);
    },
  );

  return () => {
    isClosed = true;
    subscription.remove();
  };
}

export function subscribeToNotificationDeliveries({
  onDebug,
  onError,
} = {}) {
  if (Platform.OS === 'web') {
    return () => undefined;
  }

  ensureNotificationHandlerConfigured();
  logNotificationInfo('notification delivery listener init');
  let isClosed = false;
  const spokenNotificationIds = new Set();

  const subscription = Notifications.addNotificationReceivedListener(
    (notification) => {
      if (isClosed || !shouldAutoSpeakNotification(notification)) {
        return;
      }

      const notificationId = normalizeNotificationIdentifier(notification);
      if (notificationId) {
        if (spokenNotificationIds.has(notificationId)) {
          return;
        }

        spokenNotificationIds.add(notificationId);
      }

      const speechText = extractSpeechTextFromNotification(notification);
      if (!speechText) {
        onDebug?.({
          lastSpeechResult: 'speech-skipped',
          lastNotificationResult: 'native-received',
        });
        return;
      }

      void deliverSpeech(speechText)
        .then((speechResult) => {
          onDebug?.({
            lastSpeechResult: speechResult,
            lastNotificationResult: 'native-received',
          });
        })
        .catch((nextError) => {
          onError?.(nextError);
        });
    },
  );

  return () => {
    isClosed = true;
    subscription.remove();
  };
}

async function clearDeliveredWebReminder(storage, reminder, onDebug) {
  if (!storage) {
    return;
  }

  const state = await loadNotificationState(storage);
  const reminderKey = buildReminderKey(reminder.sessionId, reminder.eventType);
  const storedReminder = state.scheduledReminders?.[reminderKey];
  if (!storedReminder || storedReminder.triggerAt !== reminder.triggerAt) {
    return;
  }

  const nextState = clearScheduledReminder(
    state,
    reminder.sessionId,
    reminder.eventType,
  );
  await saveNotificationState(storage, nextState);
  onDebug?.({
    scheduledReminderCount: Object.keys(nextState.scheduledReminders).length,
  });
}

export async function getReminderPermissionStatus() {
  try {
    if (Platform.OS === 'web') {
      const WebNotification = getWebNotificationApi();
      if (!WebNotification) {
        return 'unavailable';
      }

      return normalizePermissionState(WebNotification.permission);
    }

    const settings = await Notifications.getPermissionsAsync();
    if (
      settings.granted ||
      settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    ) {
      return 'granted';
    }

    return settings.canAskAgain === false ? 'denied' : 'default';
  } catch (nextError) {
    logNotificationError('failed to read notification permissions', nextError);
    return 'unavailable';
  }
}

export async function requestReminderPermissions() {
  try {
    const currentStatus = await getReminderPermissionStatus();
    if (currentStatus === 'granted' || currentStatus === 'denied') {
      return currentStatus;
    }

    if (Platform.OS === 'web') {
      const WebNotification = getWebNotificationApi();
      if (WebNotification) {
        return normalizePermissionState(
          await WebNotification.requestPermission(),
        );
      }

      return 'unavailable';
    }

    await ensureAndroidNotificationChannelAsync();
    const requested = await Notifications.requestPermissionsAsync();
    if (
      requested.granted ||
      requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
    ) {
      return 'granted';
    }

    return requested.canAskAgain === false ? 'denied' : 'default';
  } catch (nextError) {
    logNotificationError('failed to request notification permissions', nextError);
    return 'unavailable';
  }
}

export async function scheduleDeviceReminders(sessions, config, options = {}) {
  logNotificationInfo('schedule device reminders', {
    sessionCount: Array.isArray(sessions) ? sessions.length : 0,
  });
  const now = options.now ?? new Date();
  const storage = options.storage ?? (await createNotificationStorage());
  const notifier =
    options.notifier ??
    (Platform.OS === 'web' ? createWebNotifier() : createNativeNotifier());
  ensureNotificationHandlerConfigured();
  await ensureAndroidNotificationChannelAsync();
  await configureNotificationActions();
  const displayName =
    options.displayName ??
    (await loadDisplayName(storage, config.display_name || 'Operator'));
  const existingState = await loadNotificationState(storage);
  const plannedSessions = sessions.filter(
    (session) => String(session?.status ?? 'planned').toLowerCase() === 'planned',
  );
  const desiredReminders = plannedSessions.flatMap((session) =>
    buildSessionReminderPlan(session, config, now, displayName),
  );
  const reconciliation = reconcileStoredReminders(
    existingState,
    desiredReminders,
  );

  for (const staleReminder of reconciliation.toCancel) {
    await notifier.cancel(staleReminder.identifier);
  }

  const scheduled = [];
  const nextState = { ...reconciliation.nextState };
  for (const reminder of reconciliation.toSchedule) {
    if (new Date(reminder.triggerAt).getTime() <= now.getTime()) {
      const delivery = await deliverReminder(reminder.payload, {
        notifier,
      });
      options.onDebug?.({
        lastSpeechResult: delivery.speechResult,
        lastNotificationResult: delivery.notificationResult,
      });
      continue;
    }

    const identifier = await notifier.schedule(reminder);
    const key = buildReminderKey(reminder.sessionId, reminder.eventType);
    nextState.scheduledReminders[key] = { ...reminder, identifier };
  }

  await saveNotificationState(storage, nextState);
  scheduled.push(...Object.values(nextState.scheduledReminders));
  options.onDebug?.({
    scheduledReminderCount: scheduled.length,
    deliveredLateReminderCount: Object.keys(nextState.deliveredLateReminders)
      .length,
  });

  return scheduled;
}

export function startWebReminderTimers(reminders, options = {}) {
  if (Platform.OS !== 'web') {
    return () => undefined;
  }

  logNotificationInfo('start web reminder timers', {
    reminderCount: Array.isArray(reminders) ? reminders.length : 0,
  });
  const timerIds = reminders.map((reminder) => {
    const delay = Math.max(
      new Date(reminder.triggerAt).getTime() - Date.now(),
      0,
    );

    return setTimeout(async () => {
      try {
        const speechResult = await deliverSpeech(reminder.payload.voiceText);
        const notificationResult = await deliverWebNotification(
          reminder.payload.title,
          reminder.payload.body,
        );
        options.onDebug?.({
          lastSpeechResult: speechResult,
          lastNotificationResult: notificationResult,
        });
        await clearDeliveredWebReminder(
          options.storage,
          reminder,
          options.onDebug,
        );
      } catch (nextError) {
        logNotificationError('web reminder timer failed', nextError, {
          reminder,
        });
      }
    }, delay);
  });

  return () => timerIds.forEach(clearTimeout);
}

export function startLateCheckLoop({
  sessions,
  config,
  onLateDetected,
  pollIntervalMs = 60_000,
  graceMinutes = DEFAULT_LATE_GRACE_MINUTES,
  repeatMinutes = LATE_NUDGE_INTERVAL_MINUTES,
  storage,
  notifier,
  onDebug,
}) {
  const runTick = async () => {
    try {
      const resolvedStorage = storage ?? (await createNotificationStorage());
      const resolvedNotifier =
        notifier ??
        (Platform.OS === 'web' ? createWebNotifier() : createNativeNotifier());
      const now = new Date();
      const sessionSnapshot = sessions();
      const state = await loadNotificationState(resolvedStorage);
      const displayName = await loadDisplayName(
        resolvedStorage,
        config().display_name || 'Operator',
      );
      const lateSessions = getLateSessions(sessionSnapshot, now, graceMinutes);
      let nextState = pruneInactiveLateReminders(state, sessionSnapshot, now);

      for (const session of lateSessions) {
        const elapsedLateMinutes = Math.max(
          Math.floor(
            (now.getTime() - new Date(session.plannedStart).getTime()) / 60_000,
          ),
          0,
        );
        const latenessMinutes = Math.max(
          Math.floor(elapsedLateMinutes / repeatMinutes) * repeatMinutes,
          graceMinutes,
        );

        if (
          !Number.isFinite(latenessMinutes) ||
          latenessMinutes < graceMinutes ||
          hasDeliveredLateReminder(nextState, session.id, latenessMinutes)
        ) {
          continue;
        }

        const payload = buildNotificationPayload(
          session,
          config(),
          'late',
          displayName,
          { latenessMinutes },
        );
        const delivery = await deliverReminder(payload, {
          notifier: resolvedNotifier,
        });
        nextState = markLateReminderDelivered(
          nextState,
          session.id,
          now.toISOString(),
          latenessMinutes,
        );
        onLateDetected?.(session, payload);
        onDebug?.({
          deliveredLateReminderCount: Object.keys(
            nextState.deliveredLateReminders,
          ).length,
          lastSpeechResult: delivery.speechResult,
          lastNotificationResult: delivery.notificationResult,
        });
      }

      await saveNotificationState(resolvedStorage, nextState);
      onDebug?.({
        deliveredLateReminderCount: Object.keys(nextState.deliveredLateReminders)
          .length,
      });
    } catch (nextError) {
      logNotificationError('late-check loop failed', nextError);
    }
  };

  void runTick();
  const intervalId = setInterval(() => {
    void runTick();
  }, pollIntervalMs);
  return () => clearInterval(intervalId);
}

export async function reconcileNotificationLifecycle({
  sessions,
  config,
  storage,
  notifier,
  onDebug,
}) {
  logNotificationInfo('reconcile notification lifecycle', {
    sessionCount: Array.isArray(sessions) ? sessions.length : 0,
  });
  const resolvedStorage = storage ?? (await createNotificationStorage());
  const resolvedNotifier =
    notifier ??
    (Platform.OS === 'web' ? createWebNotifier() : createNativeNotifier());
  const state = await loadNotificationState(resolvedStorage);
  let nextState = state;
  const plannedSessions = sessions.filter(
    (session) => String(session?.status ?? 'planned').toLowerCase() === 'planned',
  );
  const plannedSessionIds = new Set(
    plannedSessions.map((session) => String(session.id)),
  );

  for (const reminder of Object.values(state.scheduledReminders)) {
    if (!plannedSessionIds.has(String(reminder.sessionId))) {
      await resolvedNotifier.cancel(reminder.identifier);
      nextState = clearSessionNotificationState(nextState, reminder.sessionId);
    }
  }

  await saveNotificationState(resolvedStorage, nextState);
  return scheduleDeviceReminders(plannedSessions, config, {
    storage: resolvedStorage,
    notifier: resolvedNotifier,
    onDebug,
  });
}

export async function clearSessionReminderState(sessionId, options = {}) {
  const storage = options.storage ?? (await createNotificationStorage());
  const notifier =
    options.notifier ??
    (Platform.OS === 'web' ? createWebNotifier() : createNativeNotifier());
  const state = await loadNotificationState(storage);
  const pre = state.scheduledReminders[buildReminderKey(sessionId, 'pre')];
  const start = state.scheduledReminders[buildReminderKey(sessionId, 'start')];
  await notifier.cancel(pre?.identifier);
  await notifier.cancel(start?.identifier);
  const nextState = clearSessionNotificationState(state, sessionId);
  await saveNotificationState(storage, nextState);
  options.onDebug?.({
    scheduledReminderCount: Object.keys(nextState.scheduledReminders).length,
    deliveredLateReminderCount: Object.keys(nextState.deliveredLateReminders)
      .length,
  });
  return nextState;
}

export async function deliverReminder(payload, options = {}) {
  const notifier =
    options.notifier ??
    (Platform.OS === 'web' ? createWebNotifier() : createNativeNotifier());
  let notificationResult = 'notification-unavailable';
  try {
    notificationResult = await notifier.present({
      ...payload,
      data: {
        ...(payload?.data ?? {}),
        skipAutoSpeech: true,
      },
    });
  } catch (nextError) {
    logNotificationError('reminder presentation failed', nextError, {
      payload,
    });
    notificationResult = 'notification-failed';
  }
  const speechResult = await deliverSpeech(payload.voiceText);
  return { notificationResult, speechResult };
}

export async function deliverWebNotification(title, body) {
  try {
    const WebNotification = getWebNotificationApi();
    if (WebNotification && WebNotification.permission === 'granted') {
      new WebNotification(title, { body });
      return 'web-notification';
    }
  } catch (nextError) {
    logNotificationError('web notification delivery failed', nextError, {
      title,
    });
    return 'notification-failed';
  }

  return 'notification-unavailable';
}

export async function deliverSpeech(text) {
  if (!ENABLE_VOICE_DELIVERY) {
    return 'speech-disabled';
  }

  try {
    if (Platform.OS === 'web') {
      const webSpeechApi = getWebSpeechApi();
      if (webSpeechApi) {
        const utterance = new webSpeechApi.SpeechSynthesisUtterance(text);
        webSpeechApi.speechSynthesis.speak(utterance);
        return 'web-speech';
      }

      return 'speech-unavailable';
    }

    Speech.speak(text, { language: 'en-US', pitch: 1.0, rate: 0.95 });
    return 'expo-speech';
  } catch (nextError) {
    logNotificationError('speech delivery failed', nextError, { text });
    return 'speech-failed';
  }
}
