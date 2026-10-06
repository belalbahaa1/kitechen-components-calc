const fs = require('fs');
const path = require('path');

const FRONTEND_DIR = path.join(__dirname, 'frontend');
const API_DIR = path.join(FRONTEND_DIR, 'app/api');
const LIB_DIR = path.join(FRONTEND_DIR, 'lib');

const mkdir = (p) => fs.mkdirSync(p, { recursive: true });
const write = (p, content) => fs.writeFileSync(p, content.trim() + '\n');

mkdir(API_DIR);
mkdir(LIB_DIR);

const DB_JS = `
import { kv } from '@vercel/kv';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const LOCAL_DB_PATH = path.join(process.cwd(), 'data.json');

export const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export const toNumber = (val) => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0 : parsed;
};

export const isPositive = (val) => typeof val === 'number' && val > 0;
export const cleanText = (val) => (typeof val === 'string' ? val.trim() : '');

export const UNIT_TYPES = {
  standard: { key: 'standard', label: 'القطع العادية', multiplier: 1.0, requiresLength: false, rule: 'العرض × الارتفاع' },
  drawer: { key: 'drawer', label: 'الأدراج', multiplier: 2.0, requiresLength: false, rule: '(العرض × الارتفاع) × 2' },
  glass: { key: 'glass', label: 'القطع الزجاجية', multiplier: 1.5, requiresLength: false, rule: '(العرض × الارتفاع) × 1.5' },
  tall: { key: 'tall', label: 'الدواليب', multiplier: 1.0, requiresLength: false, rule: 'العرض × الارتفاع' },
  lshape: { key: 'lshape', label: 'القطعة حرف L', multiplier: 1.0, requiresLength: true, rule: '(العرض + الطول) × الارتفاع' },
  side: { key: 'side', label: 'الجوانب', multiplier: 0.7, requiresLength: false, rule: '(العرض × الارتفاع) × 0.70' },
  base: { key: 'base', label: 'وحدة سفلية', multiplier: 1.0, requiresLength: false, rule: 'العرض × الارتفاع' },
  wall: { key: 'wall', label: 'وحدة علوية', multiplier: 1.0, requiresLength: false, rule: 'العرض × الارتفاع' },
  island: { key: 'island', label: 'جزيرة', multiplier: 1.5, requiresLength: false, rule: '(العرض × الارتفاع) × 1.5' },
  custom: { key: 'custom', label: 'وحدة خاصة', multiplier: 1.2, requiresLength: false, rule: '(العرض × الارتفاع) × 1.2' },
};

export const describeCalculation = (typeDef, rawW, rawH, rawL, unitStr) => {
  const w = round(rawW, 2);
  const h = round(rawH, 2);
  const l = rawL ? round(rawL, 2) : 0;
  if (typeDef.requiresLength) return \`(\${w}\${unitStr} + \${l}\${unitStr}) × \${h}\${unitStr}\`;
  const base = \`\${w}\${unitStr} × \${h}\${unitStr}\`;
  return typeDef.multiplier === 1 ? base : \`(\${base}) × \${typeDef.multiplier}\`;
};

export async function loadData() {
  let data = { materials: [], accessories: [] };
  if (process.env.KV_REST_API_URL) {
    data = (await kv.get('kitchen_state')) || data;
  } else {
    try {
      const fileData = await fs.readFile(LOCAL_DB_PATH, 'utf8');
      data = JSON.parse(fileData);
    } catch (e) {}
  }
  return data;
}

export async function saveData(data) {
  if (process.env.KV_REST_API_URL) {
    await kv.set('kitchen_state', data);
  } else {
    await fs.writeFile(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
  }
}

export async function buildState() {
  const data = await loadData();
  const { materials, accessories } = data;

  const sortedMaterials = [...materials].sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));

  const materialsOut = sortedMaterials.map((material) => {
    const units = material.units;
    const totalArea = units.reduce((sum, u) => sum + u.area, 0);
    const totalCost = totalArea * material.pricePerMeter;

    return {
      id: material.id,
      name: material.name,
      pricePerMeter: material.pricePerMeter,
      createdAt: material.createdAt,
      lastUpdated: material.lastUpdated,
      units,
      unitsCount: units.length,
      totalArea: round(totalArea, 4),
      totalCost: round(totalCost, 2),
    };
  });

  const materialsTotalArea = materialsOut.reduce((sum, m) => sum + m.totalArea, 0);
  const materialsTotalCost = materialsOut.reduce((sum, m) => sum + m.totalCost, 0);
  const accessoriesCost = accessories.reduce((sum, a) => sum + a.price, 0);
  const grandTotalCost = materialsTotalCost + accessoriesCost;

  return {
    materials: materialsOut,
    accessories,
    unitTypes: Object.values(UNIT_TYPES),
    totalMaterials: materialsOut.length,
    totalUnits: materialsOut.reduce((sum, m) => sum + m.unitsCount, 0),
    grandTotalArea: round(materialsTotalArea, 4),
    materialsTotalCost: round(materialsTotalCost, 2),
    accessoriesCost: round(accessoriesCost, 2),
    grandTotalCost: round(grandTotalCost, 2),
  };
}
`;

write(path.join(LIB_DIR, 'db.js'), DB_JS);

// Route: /api/state (GET)
mkdir(path.join(API_DIR, 'state'));
write(path.join(API_DIR, 'state', 'route.js'), `
import { NextResponse } from 'next/server';
import { buildState } from '@/lib/db';

export async function GET() {
  return NextResponse.json(await buildState());
}
`);

// Route: /api/unit-types (GET)
mkdir(path.join(API_DIR, 'unit-types'));
write(path.join(API_DIR, 'unit-types', 'route.js'), `
import { NextResponse } from 'next/server';
import { UNIT_TYPES } from '@/lib/db';

export async function GET() {
  return NextResponse.json(Object.values(UNIT_TYPES));
}
`);

// Route: /api/materials (POST)
mkdir(path.join(API_DIR, 'materials'));
write(path.join(API_DIR, 'materials', 'route.js'), `
import { NextResponse } from 'next/server';
import { loadData, saveData, buildState, cleanText, toNumber, isPositive } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const name = cleanText(body?.name);
  const price = toNumber(body?.pricePerMeter);

  if (!name) return NextResponse.json({ error: 'اسم الخامة مطلوب' }, { status: 400 });
  if (!isPositive(price)) return NextResponse.json({ error: 'سعر المتر يجب أن يكون رقماً أكبر من صفر' }, { status: 400 });

  const data = await loadData();
  if (data.materials.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: \`الخامة "\${name}" موجودة بالفعل\` }, { status: 409 });
  }

  const now = new Date().toISOString();
  const material = {
    id: randomUUID(),
    name,
    pricePerMeter: price,
    createdAt: now,
    lastUpdated: now,
    units: [],
  };
  
  data.materials.push(material);
  await saveData(data);

  return NextResponse.json({
    message: \`تمت إضافة الخامة "\${name}" بنجاح\`,
    item: { id: material.id, name, pricePerMeter: price },
    state: await buildState(),
  }, { status: 201 });
}
`);

// Route: /api/materials/[materialId] (DELETE)
mkdir(path.join(API_DIR, 'materials/[materialId]'));
write(path.join(API_DIR, 'materials/[materialId]', 'route.js'), `
import { NextResponse } from 'next/server';
import { loadData, saveData, buildState } from '@/lib/db';

export async function DELETE(req, { params }) {
  const { materialId } = params;
  const data = await loadData();
  
  const material = data.materials.find(m => m.id === materialId);
  if (!material) return NextResponse.json({ error: 'الخامة غير موجودة' }, { status: 404 });

  data.materials = data.materials.filter((m) => m.id !== materialId);
  await saveData(data);

  return NextResponse.json({
    message: \`تم حذف الخامة "\${material.name}"\`,
    item: { id: material.id },
    state: await buildState(),
  });
}
`);

// Route: /api/materials/[materialId]/units (POST)
mkdir(path.join(API_DIR, 'materials/[materialId]/units'));
write(path.join(API_DIR, 'materials/[materialId]/units', 'route.js'), `
import { NextResponse } from 'next/server';
import { loadData, saveData, buildState, cleanText, toNumber, isPositive, UNIT_TYPES, describeCalculation, round } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function POST(req, { params }) {
  const { materialId } = params;
  const data = await loadData();
  const material = data.materials.find(m => m.id === materialId);
  if (!material) return NextResponse.json({ error: 'الخامة غير موجودة' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { type, name, width, height, length, measurementUnit = 'cm' } = body;
  const typeDef = UNIT_TYPES[type];
  if (!typeDef) return NextResponse.json({ error: 'نوع الوحدة غير صالح' }, { status: 400 });

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
    message: \`تمت إضافة "\${unit.name}" إلى \${material.name}\`,
    item: unit,
    state: await buildState(),
  }, { status: 201 });
}
`);

// Route: /api/materials/[materialId]/units/[unitId] (PUT, DELETE)
mkdir(path.join(API_DIR, 'materials/[materialId]/units/[unitId]'));
write(path.join(API_DIR, 'materials/[materialId]/units/[unitId]', 'route.js'), `
import { NextResponse } from 'next/server';
import { loadData, saveData, buildState, cleanText, toNumber, isPositive, UNIT_TYPES, describeCalculation, round } from '@/lib/db';

export async function PUT(req, { params }) {
  const { materialId, unitId } = params;
  const data = await loadData();
  const material = data.materials.find(m => m.id === materialId);
  if (!material) return NextResponse.json({ error: 'الخامة غير موجودة' }, { status: 404 });

  const unit = material.units.find((u) => u.id === unitId);
  if (!unit) return NextResponse.json({ error: 'الوحدة غير موجودة' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const { name, width, height, length, measurementUnit = unit.measurementUnit } = body;
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
  unit.width = rawW;
  unit.height = rawH;
  unit.length = rawL;
  unit.measurementUnit = measurementUnit;
  unit.calculation = describeCalculation(typeDef, rawW, rawH, rawL, unitStr);
  unit.area = round(area, 4);

  material.lastUpdated = new Date().toISOString();
  await saveData(data);

  return NextResponse.json({
    message: \`تم تعديل "\${unit.name}" بنجاح\`,
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
    message: \`تم حذف "\${unit.name}"\`,
    item: { id: unit.id, materialId: material.id },
    state: await buildState(),
  });
}
`);

// Route: /api/accessories (POST)
mkdir(path.join(API_DIR, 'accessories'));
write(path.join(API_DIR, 'accessories', 'route.js'), `
import { NextResponse } from 'next/server';
import { loadData, saveData, buildState, cleanText, toNumber, isPositive } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const { name, price } = body;
  const cost = toNumber(price);

  if (!name || !isPositive(cost)) {
    return NextResponse.json({ error: 'يرجى إدخال اسم وسعر صحيح للإكسسوار' }, { status: 400 });
  }

  const data = await loadData();
  const accessory = {
    id: randomUUID(),
    name: cleanText(name),
    price: cost,
    createdAt: new Date().toISOString(),
  };

  data.accessories.push(accessory);
  await saveData(data);

  return NextResponse.json({
    message: \`تم إضافة الإكسسوار "\${accessory.name}"\`,
    state: await buildState(),
  }, { status: 201 });
}
`);

// Route: /api/accessories/[id] (DELETE)
mkdir(path.join(API_DIR, 'accessories/[id]'));
write(path.join(API_DIR, 'accessories/[id]', 'route.js'), `
import { NextResponse } from 'next/server';
import { loadData, saveData, buildState } from '@/lib/db';

export async function DELETE(req, { params }) {
  const { id } = params;
  const data = await loadData();
  
  const index = data.accessories.findIndex(a => a.id === id);
  if (index === -1) return NextResponse.json({ error: 'الإكسسوار غير موجود' }, { status: 404 });

  const [deleted] = data.accessories.splice(index, 1);
  await saveData(data);

  return NextResponse.json({
    message: \`تم حذف "\${deleted.name}"\`,
    state: await buildState(),
  });
}
`);
