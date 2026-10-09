import { kv } from '@vercel/kv';
import fs from 'fs/promises';
import path from 'path';

const LOCAL_DB_PATH = path.join(process.cwd(), 'data.json');

export const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
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
};

export const LEVEL_CONFIG = {
  lower: { key: 'lower', label: 'القطع السفلية', shortLabel: 'سفلية', subtitle: 'Base Cabinets' },
  upper: { key: 'upper', label: 'القطع العلوية', shortLabel: 'علوية', subtitle: 'Wall Cabinets' },
  third: { key: 'third', label: 'المستوى الثالث', shortLabel: 'مستوى ثالث', subtitle: 'Loft Cabinets' },
};

export const VALID_LEVELS = ['lower', 'upper', 'third'];

export const DEFAULT_MATERIALS = [
  { id: 'mat-hpl', name: 'HPL', pricePerMeter: 5200, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'mat-poly-back', name: 'Poly back', pricePerMeter: 7500, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'mat-poly-lac', name: 'Poly lac', pricePerMeter: 7200, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
];

export const DEFAULT_LEVEL_PRICING = {
  lower: 'mat-hpl',
  upper: 'mat-poly-back',
  third: 'mat-poly-lac',
};

export const describeCalculation = (typeDef, rawW, rawH, rawL, unitStr) => {
  const t = typeDef || UNIT_TYPES.standard;
  const w = round(rawW, 2);
  const h = round(rawH, 2);
  const l = rawL ? round(rawL, 2) : 0;
  if (t.requiresLength) return `(${w}${unitStr} + ${l}${unitStr}) × ${h}${unitStr}`;
  const base = `${w}${unitStr} × ${h}${unitStr}`;
  return t.multiplier === 1 ? base : `(${base}) × ${t.multiplier}`;
};

let inMemoryFallback = {
  materials: [...DEFAULT_MATERIALS],
  levelPricing: { ...DEFAULT_LEVEL_PRICING },
  units: [],
  accessories: [],
};

export async function loadData() {
  let data = null;
  if (process.env.KV_REST_API_URL) {
    try {
      data = await kv.get('kitchen_state');
    } catch {
      data = null;
    }
  }

  if (!data) {
    try {
      const fileData = await fs.readFile(LOCAL_DB_PATH, 'utf8');
      data = JSON.parse(fileData);
    } catch {
      data = inMemoryFallback;
    }
  }

  // MIGRATION & INITIALIZATION
  if (data) {
    data.units = data.units || [];
    let needsSave = false;

    if (!Array.isArray(data.materials) || data.materials.length === 0) {
      data.materials = DEFAULT_MATERIALS.map((m) => ({ ...m }));
      needsSave = true;
    }

    if (Array.isArray(data.materials)) {
      data.materials.forEach((m) => {
        if (Array.isArray(m.units) && m.units.length > 0) {
          m.units.forEach((u) => {
            if (!data.units.some((existing) => existing.id === u.id)) {
              data.units.push({ ...u });
            }
          });
          delete m.units;
          needsSave = true;
        }
      });
    }

    if (needsSave) {
      await saveData(data);
    }
  }

  return data;
}

export async function saveData(data) {
  inMemoryFallback = data;
  if (process.env.KV_REST_API_URL) {
    try {
      await kv.set('kitchen_state', data);
    } catch {
      // silent
    }
  }

  try {
    await fs.writeFile(LOCAL_DB_PATH, JSON.stringify(data, null, 2));
  } catch {
    // Vercel read-only or permission error
  }
}

export async function buildState() {
  const data = await loadData();
  const rawUnits = data.units || [];
  const materials = Array.isArray(data.materials) && data.materials.length > 0
    ? data.materials.map((m) => ({
        id: m.id,
        name: m.name,
        pricePerMeter: m.pricePerMeter,
        isDefault: Boolean(m.isDefault),
        createdAt: m.createdAt || new Date().toISOString(),
      }))
    : DEFAULT_MATERIALS.map((m) => ({ ...m }));
  const rawPricing = data.levelPricing || {};
  const rawAccessories = data.accessories || [];

  const levelPricing = {
    lower: rawPricing.lower || materials[0]?.id,
    upper: rawPricing.upper || materials[1]?.id || materials[0]?.id,
    third: rawPricing.third || materials[2]?.id || materials[0]?.id,
  };

  // Ensure levelPricing keys point to valid materials in materials
  VALID_LEVELS.forEach((lvl, idx) => {
    if (!materials.some((m) => m.id === levelPricing[lvl])) {
      levelPricing[lvl] = materials[idx]?.id || materials[0]?.id;
    }
  });

  const lowerMaterial = materials.find((m) => m.id === levelPricing.lower) || materials[0];
  const upperMaterial = materials.find((m) => m.id === levelPricing.upper) || materials[1] || materials[0];
  const thirdMaterial = materials.find((m) => m.id === levelPricing.third) || materials[2] || materials[0];

  // Enrich units
  const units = rawUnits.map((u) => {
    const lvl = VALID_LEVELS.includes(u.level) ? u.level : 'lower';
    const assignedMat = lvl === 'upper' ? upperMaterial : lvl === 'third' ? thirdMaterial : lowerMaterial;
    return {
      ...u,
      level: lvl,
      levelLabel: LEVEL_CONFIG[lvl]?.label || 'القطع السفلية',
      materialId: assignedMat.id,
      materialName: assignedMat.name,
      materialPrice: assignedMat.pricePerMeter,
      cost: round(u.area * assignedMat.pricePerMeter, 2),
    };
  });

  // Calculate area per level
  const lowerUnits = units.filter((u) => u.level === 'lower');
  const upperUnits = units.filter((u) => u.level === 'upper');
  const thirdUnits = units.filter((u) => u.level === 'third');

  const lowerArea = round(lowerUnits.reduce((sum, u) => sum + (u.area || 0), 0), 4);
  const upperArea = round(upperUnits.reduce((sum, u) => sum + (u.area || 0), 0), 4);
  const thirdArea = round(thirdUnits.reduce((sum, u) => sum + (u.area || 0), 0), 4);
  const grandTotalArea = round(lowerArea + upperArea + thirdArea, 4);

  // Calculate cost per level
  const lowerCost = round(lowerArea * lowerMaterial.pricePerMeter, 2);
  const upperCost = round(upperArea * upperMaterial.pricePerMeter, 2);
  const thirdCost = round(thirdArea * thirdMaterial.pricePerMeter, 2);

  const materialsTotalCost = round(lowerCost + upperCost + thirdCost, 2);
  const accessoriesCost = round(rawAccessories.reduce((sum, a) => sum + (toNumber(a.price) || 0), 0), 2);
  const grandTotalCost = round(materialsTotalCost + accessoriesCost, 2);

  const levelsSummary = {
    lower: {
      key: 'lower',
      label: LEVEL_CONFIG.lower.label,
      shortLabel: LEVEL_CONFIG.lower.shortLabel,
      subtitle: LEVEL_CONFIG.lower.subtitle,
      area: lowerArea,
      unitCount: lowerUnits.length,
      materialId: lowerMaterial.id,
      materialName: lowerMaterial.name,
      materialPrice: lowerMaterial.pricePerMeter,
      cost: lowerCost,
      subtotal: lowerCost,
    },
    upper: {
      key: 'upper',
      label: LEVEL_CONFIG.upper.label,
      shortLabel: LEVEL_CONFIG.upper.shortLabel,
      subtitle: LEVEL_CONFIG.upper.subtitle,
      area: upperArea,
      unitCount: upperUnits.length,
      materialId: upperMaterial.id,
      materialName: upperMaterial.name,
      materialPrice: upperMaterial.pricePerMeter,
      cost: upperCost,
      subtotal: upperCost,
    },
    third: {
      key: 'third',
      label: LEVEL_CONFIG.third.label,
      shortLabel: LEVEL_CONFIG.third.shortLabel,
      subtitle: LEVEL_CONFIG.third.subtitle,
      area: thirdArea,
      unitCount: thirdUnits.length,
      materialId: thirdMaterial.id,
      materialName: thirdMaterial.name,
      materialPrice: thirdMaterial.pricePerMeter,
      cost: thirdCost,
      subtotal: thirdCost,
    },
  };

  return {
    units,
    materials,
    levelPricing,
    accessories: rawAccessories,
    unitTypes: Object.values(UNIT_TYPES),
    levels: levelsSummary,
    lowerArea,
    upperArea,
    thirdArea,
    grandTotalArea,
    lowerCost,
    upperCost,
    thirdCost,
    materialsTotalCost,
    accessoriesCost,
    grandTotalCost,
    totalUnits: units.length,
    totalMaterials: materials.length,
  };
}
