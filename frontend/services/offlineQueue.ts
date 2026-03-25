export type OfflineAction = {
  endpoint: string;
  method: 'POST' | 'PUT';
  payload: Record<string, unknown>;
  createdAt: string;
};

export const offlineQueue: OfflineAction[] = [];

export function queueAction(action: Omit<OfflineAction, 'createdAt'>) {
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
  offlineQueue.push({
    ...action,
    createdAt: new Date().toISOString(),
  });
=======
  offlineQueue.push({ ...action, createdAt: new Date().toISOString() });
>>>>>>> theirs
=======
  offlineQueue.push({ ...action, createdAt: new Date().toISOString() });
>>>>>>> theirs
=======
  offlineQueue.push({ ...action, createdAt: new Date().toISOString() });
>>>>>>> theirs
=======
  offlineQueue.push({ ...action, createdAt: new Date().toISOString() });
>>>>>>> theirs
=======
  offlineQueue.push({ ...action, createdAt: new Date().toISOString() });
>>>>>>> theirs
=======
  offlineQueue.push({ ...action, createdAt: new Date().toISOString() });
>>>>>>> theirs
=======
  offlineQueue.push({ ...action, createdAt: new Date().toISOString() });
>>>>>>> theirs
=======
  offlineQueue.push({ ...action, createdAt: new Date().toISOString() });
>>>>>>> theirs
=======
  offlineQueue.push({ ...action, createdAt: new Date().toISOString() });
>>>>>>> theirs
=======
  offlineQueue.push({ ...action, createdAt: new Date().toISOString() });
>>>>>>> theirs
=======
  offlineQueue.push({ ...action, createdAt: new Date().toISOString() });
>>>>>>> theirs
=======
  offlineQueue.push({ ...action, createdAt: new Date().toISOString() });
>>>>>>> theirs
=======
  offlineQueue.push({ ...action, createdAt: new Date().toISOString() });
>>>>>>> theirs
}

export async function flushQueue(baseUrl: string) {
  while (offlineQueue.length > 0) {
    const next = offlineQueue[0];
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
=======
>>>>>>> theirs
    await fetch(`${baseUrl}${next.endpoint}`, {
      method: next.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next.payload),
    });
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

    offlineQueue.shift();
  }
}
=======
    offlineQueue.shift();
  }
}
>>>>>>> theirs
=======
    offlineQueue.shift();
  }
}
>>>>>>> theirs
=======
    offlineQueue.shift();
  }
}
>>>>>>> theirs
=======
    offlineQueue.shift();
  }
}
>>>>>>> theirs
=======
    offlineQueue.shift();
  }
}
>>>>>>> theirs
=======
    offlineQueue.shift();
  }
}
>>>>>>> theirs
=======
    offlineQueue.shift();
  }
}
>>>>>>> theirs
=======
    offlineQueue.shift();
  }
}
>>>>>>> theirs
=======
    offlineQueue.shift();
  }
}
>>>>>>> theirs
=======
    offlineQueue.shift();
  }
}
>>>>>>> theirs
=======
    offlineQueue.shift();
  }
}
>>>>>>> theirs
=======
    offlineQueue.shift();
  }
}
>>>>>>> theirs
=======
    offlineQueue.shift();
  }
}
>>>>>>> theirs
