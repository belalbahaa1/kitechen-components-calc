import { NextResponse } from 'next/server';
import { loadData, saveData, buildState, cleanText, toNumber, isPositive, UNIT_TYPES, describeCalculation, round, LEVEL_CONFIG, VALID_LEVELS } from '@/lib/db';

export async function PUT(req, { params }) {
  const { materialId, unitId } = params;
  const data = await loadData();
  const material = data.materials.find(m => m.id === materialId);
  if (!material) return NextResponse.json({ error: 'الخامة غير موجودة' }, { status: 404 });

  const unit = material.units.find((u) => u.id === unitId);
  if (!unit) return NextResponse.json({ error: 'الوحدة غير موجودة' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { name, width, height, length, measurementUnit = unit.measurementUnit, level } = body;
  const typeDef = UNIT_TYPES[unit.type];

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

  if (name !== undefined) unit.name = cleanText(name) || typeDef.label;
  if (level !== undefined && VALID_LEVELS.includes(level)) {
    unit.level = level;
    unit.levelLabel = LEVEL_CONFIG[level]?.label || unit.levelLabel;
  }
  unit.width = rawW;
  unit.height = rawH;
  unit.length = rawL;
  unit.measurementUnit = measurementUnit;
  unit.calculation = describeCalculation(typeDef, rawW, rawH, rawL, unitStr);
  unit.area = round(area, 4);

  material.lastUpdated = new Date().toISOString();
  await saveData(data);

  return NextResponse.json({
    message: `تم تعديل "${unit.name}" بنجاح`,
    item: unit,
    state: await buildState(),
  });
}

export async function DELETE(req, { params }) {
  const { materialId, unitId } = params;
  const data = await loadData();
  const material = data.materials.find(m => m.id === materialId);
  if (!material) return NextResponse.json({ error: 'الخامة غير موجودة' }, { status: 404 });

  const unitIndex = material.units.findIndex((u) => u.id === unitId);
  if (unitIndex === -1) return NextResponse.json({ error: 'الوحدة غير موجودة' }, { status: 404 });

  const [unit] = material.units.splice(unitIndex, 1);
  material.lastUpdated = new Date().toISOString();
  await saveData(data);

  return NextResponse.json({
    message: `تم حذف "${unit.name}"`,
    item: { id: unit.id, materialId: material.id },
    state: await buildState(),
  });
}
