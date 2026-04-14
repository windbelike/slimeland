import { NextResponse } from 'next/server';
import { getTimers, saveTimers } from '@/lib/kv';

export const runtime = 'edge';

interface Timer {
  id: number;
  number: string;
  initialTime: number;
  startTime: number;
  expiresAt: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dayKey = searchParams.get('day') || 'today';
    const timers = await getTimers(dayKey);
    return NextResponse.json({ timers, dayKey });
  } catch (error) {
    console.error('KV GET error:', error);
    return NextResponse.json({ timers: [], dayKey: 'today' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { timer: Timer; dayKey: string };
    const { timer, dayKey } = body;

    const timers = await getTimers(dayKey);
    timers.push(timer);
    await saveTimers(dayKey, timers);

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

    let timers = await getTimers(dayKey);
    timers = timers.filter((t: Timer) => t.id !== id);
    await saveTimers(dayKey, timers);

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

    let timers = await getTimers(dayKey);
    const now = Date.now();
    timers = timers.map((t: Timer) =>
      t.id === id ? { ...t, startTime: now, expiresAt: now + t.initialTime * 1000 } : t
    );
    await saveTimers(dayKey, timers);

    return NextResponse.json({ success: true, timers });
  } catch (error) {
    console.error('KV PATCH error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
