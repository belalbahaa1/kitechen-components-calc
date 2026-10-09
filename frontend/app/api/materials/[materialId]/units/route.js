import { NextResponse } from 'next/server';
import { loadData, saveData, buildState, cleanText, toNumber, isPositive, UNIT_TYPES, describeCalculation, round, LEVEL_CONFIG, VALID_LEVELS } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function POST(req, { params }) {
  const { materialId } = params;
  const data = await loadData();
  const material = data.materials.find(m => m.id === materialId);
  if (!material) return NextResponse.json({ error: 'الخامة غير موجودة' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { type, name, width, height, length, measurementUnit = 'cm', level = 'lower' } = body;
  const typeDef = UNIT_TYPES[type];
  if (!typeDef) return NextResponse.json({ error: 'نوع الوحدة غير صالح' }, { status: 400 });

  const validLevel = VALID_LEVELS.includes(level) ? level : 'lower';

  const rawW = toNumber(width);
  const rawH = toNumber(height);
  const rawL = typeDef.requiresLength ? toNumber(length) : null;

  if (!isPositive(rawW) || !isPositive(rawH)) return NextResponse.json({ error: 'الأبعاد يجب أن تكون أكبر من صفر' }, { status: 400 });
  if (typeDef.requiresLength && !isPositive(rawL)) return NextResponse.json({ error: 'الطول مطلوب للقطعة حرف L' }, { status: 400 });

  const mFactor = measurementUnit === 'cm' ? 0.01 : 1;
  const w = rawW * mFactor;
  const h = rawH * mFactor;
  const l = typeDef.requiresLength ? (rawL * mFactor) : 0;
  
  const baseArea = typeDef.requiresLength ? (w + l) * h : w * h;
  const area = baseArea * typeDef.multiplier;
  const unitStr = measurementUnit === 'cm' ? 'سم' : 'م';

  const unit = {
    id: randomUUID(),
    type,
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
  };

  material.units.push(unit);
  material.lastUpdated = new Date().toISOString();
  await saveData(data);

  return NextResponse.json({
    message: `تمت إضافة "${unit.name}" إلى ${material.name}`,
    item: unit,
    state: await buildState(),
  }, { status: 201 });
}
