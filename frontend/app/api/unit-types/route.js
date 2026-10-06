import { NextResponse } from 'next/server';
import { UNIT_TYPES } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(Object.values(UNIT_TYPES));
}
