import { NextResponse } from 'next/server';
import { getHistoryDays } from '@/lib/kv';

export const runtime = 'edge';

export async function GET() {
  try {
    const days = await getHistoryDays();
    return NextResponse.json({ days });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('KV history error:', msg);
    return NextResponse.json({ days: [], error: msg }, { status: 500 });
  }
}
