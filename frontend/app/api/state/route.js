import { NextResponse } from 'next/server';
import { buildState } from '@/lib/db';

export async function GET() {
  return NextResponse.json(await buildState());
}
