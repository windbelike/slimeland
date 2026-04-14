interface Timer {
  id: number;
  number: string;
  initialTime: number;
  startTime: number;
  expiresAt: number;
}

let _kv: KVNamespace | null = null;
const memoryStore = new Map<string, string>();
let seeded = false;

function seedMockData() {
  if (seeded) return;
  seeded = true;
  const now = Date.now();
  for (let i = 1; i <= 9; i++) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const timers: Timer[] = Array.from({ length: 3 }, (_, idx) => ({
      id: now - i * 86400000 + idx * 1000,
      number: String((i + idx) % 20).padStart(2, '0'),
      initialTime: 7200,
      startTime: now - i * 86400000 + idx * 1000,
      expiresAt: now - i * 86400000 + idx * 1000 + 7200 * 1000,
    }));
    memoryStore.set(`timers:${dayKey}`, JSON.stringify(timers));
  }
}

function getInMemoryKV(): KVNamespace {
  seedMockData();
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

async function getKV(): Promise<KVNamespace> {
  if (_kv) return _kv;

  try {
    const { getRequestContext } = await import('@cloudflare/next-on-pages');
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
  const kv = await getKV();
  const data = await kv.get(`timers:${dayKey}`);
  return data ? JSON.parse(data) : [];
}

export async function saveTimers(dayKey: string, timers: Timer[]) {
  const kv = await getKV();
  await kv.put(`timers:${dayKey}`, JSON.stringify(timers));
}

function getDayKey(timestamp: number = Date.now()): string {
  const date = new Date(timestamp);
  const hours = date.getHours();
  if (hours < 6) {
    const prev = new Date(timestamp - 24 * 60 * 60 * 1000);
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export async function getHistoryDays(): Promise<string[]> {
  const kv = await getKV();
  const list = await kv.list({ prefix: 'timers:' });
  const today = getDayKey();
  return (list.keys as { name: string }[])
    .map(k => k.name.replace('timers:', ''))
    .filter(d => d !== 'today' && d !== today)
    .sort((a, b) => b.localeCompare(a));
}
