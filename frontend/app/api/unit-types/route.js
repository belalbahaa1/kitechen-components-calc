import { NextResponse } from 'next/server';
import { UNIT_TYPES } from '@/lib/db';

export async function GET() {
  return NextResponse.json(Object.values(UNIT_TYPES));
}
