import { getRequestContext } from '@cloudflare/next-on-pages';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET() {
  try {
    const { env } = getRequestContext();
    const list = await env.KV.list({ prefix: 'timers:' });
    const days = list.keys
      .map(k => k.name.replace('timers:', ''))
      .filter(d => d !== 'today')
      .sort((a, b) => b.localeCompare(a));
    return NextResponse.json({ days });
  } catch (error) {
    console.error('KV history error:', error);
    return NextResponse.json({ days: [] }, { status: 500 });
  }
}
