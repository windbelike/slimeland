import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

interface Timer {
  id: number;
  number: string;
  initialTime: number;
  startTime: number;
  expiresAt: number;
}

const KV_KEY = 'timers';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dayKey = searchParams.get('day') || 'today';
    const { env } = getRequestContext();
    const data = await env.KV.get(`${KV_KEY}:${dayKey}`);
    const timers: Timer[] = data ? JSON.parse(data) : [];
    return NextResponse.json({ timers, dayKey });
  } catch (error) {
    console.error('KV GET error:', error);
    return NextResponse.json({ timers: [], dayKey: 'today' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { timer: Timer; dayKey: string };
    const { timer, dayKey } = body;
    const { env } = getRequestContext();

    const key = `${KV_KEY}:${dayKey}`;
    const existing = await env.KV.get(key);
    const timers: Timer[] = existing ? JSON.parse(existing) : [];
    timers.push(timer);
    await env.KV.put(key, JSON.stringify(timers));

    return NextResponse.json({ success: true, timers });
  } catch (error) {
    console.error('KV POST error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    const dayKey = searchParams.get('day') || 'today';
    const { env } = getRequestContext();

    const key = `${KV_KEY}:${dayKey}`;
    const existing = await env.KV.get(key);
    let timers: Timer[] = existing ? JSON.parse(existing) : [];
    timers = timers.filter((t: Timer) => t.id !== id);
    await env.KV.put(key, JSON.stringify(timers));

    return NextResponse.json({ success: true, timers });
  } catch (error) {
    console.error('KV DELETE error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    const dayKey = searchParams.get('day') || 'today';
    const { env } = getRequestContext();

    const key = `${KV_KEY}:${dayKey}`;
    const existing = await env.KV.get(key);
    let timers: Timer[] = existing ? JSON.parse(existing) : [];
    const now = Date.now();
    timers = timers.map((t: Timer) =>
      t.id === id ? { ...t, startTime: now, expiresAt: now + t.initialTime * 1000 } : t
    );
    await env.KV.put(key, JSON.stringify(timers));

    return NextResponse.json({ success: true, timers });
  } catch (error) {
    console.error('KV PATCH error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
