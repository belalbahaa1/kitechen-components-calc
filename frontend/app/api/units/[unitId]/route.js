import { NextResponse } from 'next/server';
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

export async function PUT(request, { params }) {
  try {
    const { unitId } = params;
    const body = await request.json().catch(() => ({}));
    const data = await loadData();
    data.units = data.units || [];

    let unit = data.units.find((u) => u.id === unitId);
    if (!unit) {
      // Check legacy materials
      if (Array.isArray(data.materials)) {
        for (const m of data.materials) {
          if (Array.isArray(m.units)) {
            const found = m.units.find((u) => u.id === unitId);
            if (found) {
              unit = found;
              data.units.push(found);
              m.units = m.units.filter((u) => u.id !== unitId);
              break;
            }
          }
        }
      }
    }

    if (!unit) {
      return NextResponse.json({ error: 'الوحدة غير موجودة' }, { status: 404 });
    }

    const { name, width, height, length, measurementUnit = unit.measurementUnit, level, type = unit.type } = body;
    const typeDef = UNIT_TYPES[type] || UNIT_TYPES[unit.type];

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

    if (name !== undefined) {
      unit.name = cleanText(name) || typeDef.label;
    }
    if (level !== undefined && VALID_LEVELS.includes(level)) {
      unit.level = level;
      unit.levelLabel = LEVEL_CONFIG[level]?.label || unit.levelLabel;
    }
    unit.type = typeDef.key;
    unit.typeLabel = typeDef.label;
    unit.rule = typeDef.rule;
    unit.width = rawW;
    unit.height = rawH;
    unit.length = rawL;
    unit.measurementUnit = measurementUnit;
    unit.calculation = describeCalculation(typeDef, rawW, rawH, rawL, unitStr);
    unit.area = round(area, 4);

    await saveData(data);
    const state = await buildState();
    return NextResponse.json({ message: `تم تعديل "${unit.name}" بنجاح`, item: unit, state });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { unitId } = params;
    const data = await loadData();
    data.units = data.units || [];

    // Remove from top-level units
    const initialLen = data.units.length;
    data.units = data.units.filter((u) => u.id !== unitId);

    // Also sweep from any legacy materials
    let foundInLegacy = false;
    if (Array.isArray(data.materials)) {
      data.materials.forEach((m) => {
        if (Array.isArray(m.units)) {
          const prevMLen = m.units.length;
          m.units = m.units.filter((u) => u.id !== unitId);
          if (m.units.length !== prevMLen) foundInLegacy = true;
        }
      });
    }

    await saveData(data);
    const state = await buildState();

    return NextResponse.json({
      message: 'تم حذف الوحدة بنجاح',
      item: { id: unitId },
      state,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
