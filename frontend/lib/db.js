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
  base: { key: 'base', label: 'وحدة سفلية', multiplier: 1.0, requiresLength: false, rule: 'العرض × الارتفاع' },
  wall: { key: 'wall', label: 'وحدة علوية', multiplier: 1.0, requiresLength: false, rule: 'العرض × الارتفاع' },
  tall: { key: 'tall', label: 'دولاب طويل', multiplier: 1.0, requiresLength: false, rule: 'العرض × الارتفاع' },
  lshape: { key: 'lshape', label: 'قطعة حرف L', multiplier: 1.0, requiresLength: true, rule: '(العرض + الطول) × الارتفاع' },
  island: { key: 'island', label: 'جزيرة', multiplier: 1.5, requiresLength: false, rule: '(العرض × الارتفاع) × 1.5' },
  custom: { key: 'custom', label: 'وحدة خاصة', multiplier: 1.2, requiresLength: false, rule: '(العرض × الارتفاع) × 1.2' },
};

export const describeCalculation = (typeDef, rawW, rawH, rawL, unitStr) => {
  const w = round(rawW, 2);
  const h = round(rawH, 2);
  const l = rawL ? round(rawL, 2) : 0;
  if (typeDef.requiresLength) return `(${w}${unitStr} + ${l}${unitStr}) × ${h}${unitStr}`;
  const base = `${w}${unitStr} × ${h}${unitStr}`;
  return typeDef.multiplier === 1 ? base : `(${base}) × ${typeDef.multiplier}`;
};

let inMemoryFallback = { materials: [], accessories: [] };

export async function loadData() {
  if (process.env.KV_REST_API_URL) {
    return (await kv.get('kitchen_state')) || { materials: [], accessories: [] };
  } else {
    try {
      const fileData = await fs.readFile(LOCAL_DB_PATH, 'utf8');
      return JSON.parse(fileData);
    } catch (e) {
      return inMemoryFallback;
    }
  }
}

export async function saveData(data) {
  if (process.env.KV_REST_API_URL) {
    await kv.set('kitchen_state', data);
  } else {
    try {
      await fs.writeFile(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
    } catch (e) {
      // Vercel is Read-Only, fallback to in-memory (ephemeral) if KV is missing
      inMemoryFallback = data;
    }
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
