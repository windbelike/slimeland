import { getRequestContext } from '@cloudflare/next-on-pages';

interface Timer {
  id: number;
  number: string;
  initialTime: number;
  startTime: number;
  expiresAt: number;
}

let _kv: KVNamespace | null = null;
const memoryStore = new Map<string, string>();

function getInMemoryKV(): KVNamespace {
  return {
    get: async (key: string) => memoryStore.get(key) || null,
    put: async (key: string, value: string) => {
      memoryStore.set(key, value);
    },
    list: async ({ prefix }: { prefix: string }) => {
      const keys = Array.from(memoryStore.keys())
        .filter(k => k.startsWith(prefix))
        .map(name => ({ name }));
      return { keys, list_complete: true, cursor: '' };
    },
  } as unknown as KVNamespace;
}

function getKV(): KVNamespace {
  if (_kv) return _kv;

  try {
    const { env } = getRequestContext();
    if (env && env.KV) {
      _kv = env.KV as KVNamespace;
      return _kv;
    }
  } catch (e) {
    console.warn('KV binding not available, using in-memory fallback:', e);
  }

  _kv = getInMemoryKV();
  return _kv;
}

export async function getTimers(dayKey: string): Promise<Timer[]> {
  const kv = getKV();
  const data = await kv.get(`timers:${dayKey}`);
  return data ? JSON.parse(data) : [];
}

export async function saveTimers(dayKey: string, timers: Timer[]) {
  const kv = getKV();
  await kv.put(`timers:${dayKey}`, JSON.stringify(timers));
}

export async function getHistoryDays(): Promise<string[]> {
  const kv = getKV();
  const list = await kv.list({ prefix: 'timers:' });
  return (list.keys as { name: string }[])
    .map(k => k.name.replace('timers:', ''))
    .filter(d => d !== 'today')
    .sort((a, b) => b.localeCompare(a));
}
