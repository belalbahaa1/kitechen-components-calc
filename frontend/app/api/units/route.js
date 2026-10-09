import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import {
  loadData,
  saveData,
  buildState,
  UNIT_TYPES,
  VALID_LEVELS,
  LEVEL_CONFIG,
  toNumber,
  isPositive,
  cleanText,
  round,
  describeCalculation,
} from '@/lib/db';

export async function GET() {
  const data = await loadData();
  return NextResponse.json(data.units || []);
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { type = 'standard', name, width, height, length, measurementUnit = 'cm', level = 'lower' } = body;

    const typeDef = UNIT_TYPES[type];
    if (!typeDef) {
      return NextResponse.json({ error: 'نوع الوحدة غير صالح' }, { status: 400 });
    }

    const validLevel = VALID_LEVELS.includes(level) ? level : 'lower';

    const rawW = toNumber(width);
    const rawH = toNumber(height);
    const rawL = typeDef.requiresLength ? toNumber(length) : null;

    if (!isPositive(rawW)) {
      return NextResponse.json({ error: 'العرض يجب أن يكون رقماً أكبر من صفر' }, { status: 400 });
    }
    if (!isPositive(rawH)) {
      return NextResponse.json({ error: 'الارتفاع يجب أن يكون رقماً أكبر من صفر' }, { status: 400 });
    }
    if (typeDef.requiresLength && !isPositive(rawL)) {
      return NextResponse.json({ error: 'الطول مطلوب للقطعة حرف L ويجب أن يكون أكبر من صفر' }, { status: 400 });
    }

    const mFactor = measurementUnit === 'cm' ? 0.01 : 1;
    const w = rawW * mFactor;
    const h = rawH * mFactor;
    const l = typeDef.requiresLength ? rawL * mFactor : 0;

    const baseArea = typeDef.requiresLength ? (w + l) * h : w * h;
    const area = baseArea * typeDef.multiplier;
    const unitStr = measurementUnit === 'cm' ? 'سم' : 'م';

    const unit = {
      id: randomUUID(),
      type: typeDef.key,
      typeLabel: typeDef.label,
      level: validLevel,
      levelLabel: LEVEL_CONFIG[validLevel]?.label || 'القطع السفلية',
      name: cleanText(name) || typeDef.label,
      width: rawW,
      height: rawH,
      length: rawL,
      measurementUnit,
      rule: typeDef.rule,
      calculation: describeCalculation(typeDef, rawW, rawH, rawL, unitStr),
      area: round(area, 4),
      createdAt: new Date().toISOString(),
    };

    const data = await loadData();
    data.units = data.units || [];
    data.units.unshift(unit);
    await saveData(data);

    const state = await buildState();
    return NextResponse.json(
      { message: `تمت إضافة الوحدة "${unit.name}" بنجاح`, item: unit, state },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json({ error: err.message || 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

// Clear all units (Delete all)
export async function DELETE() {
  try {
    const data = await loadData();
    data.units = [];
    if (Array.isArray(data.materials)) {
      data.materials.forEach((m) => {
        delete m.units;
      });
    }
    await saveData(data);
    const state = await buildState();
    return NextResponse.json({ message: 'تم حذف جميع الوحدات بنجاح', state });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'حدث خطأ أثناء حذف الوحدات' }, { status: 500 });
  }
}
