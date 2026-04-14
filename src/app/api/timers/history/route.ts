import { NextResponse } from 'next/server';
import { getHistoryDays } from '@/lib/kv';

export const runtime = 'edge';

export async function GET() {
  try {
    const days = await getHistoryDays();
    return NextResponse.json({ days });
  } catch (error) {
    console.error('KV history error:', error);
    return NextResponse.json({ days: [] }, { status: 500 });
  }
}
