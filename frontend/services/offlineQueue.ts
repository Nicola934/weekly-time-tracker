export type OfflineAction = {
  endpoint: string;
  method: 'POST' | 'PUT';
  payload: Record<string, unknown>;
  createdAt: string;
};

export const offlineQueue: OfflineAction[] = [];

export function queueAction(action: Omit<OfflineAction, 'createdAt'>) {
  offlineQueue.push({
    ...action,
    createdAt: new Date().toISOString(),
  });
}

export async function flushQueue(baseUrl: string) {
  while (offlineQueue.length > 0) {
    const next = offlineQueue[0];

    await fetch(`${baseUrl}${next.endpoint}`, {
      method: next.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next.payload),
    });

    offlineQueue.shift();
  }
}