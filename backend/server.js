const express = require('express');
const cors = require('cors');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ---------------------------------------------------------------------------
// Unit Types Configuration
// ---------------------------------------------------------------------------
const UNIT_TYPES = {
  standard: {
    key: 'standard',
    label: 'القطع العادية',
    multiplier: 1,
    requiresLength: false,
    rule: 'العرض × الارتفاع',
  },
  drawer: {
    key: 'drawer',
    label: 'الأدراج',
    multiplier: 2,
    requiresLength: false,
    rule: '(العرض × الارتفاع) × 2',
  },
  glass: {
    key: 'glass',
    label: 'القطع الزجاجية',
    multiplier: 1.5,
    requiresLength: false,
    rule: '(العرض × الارتفاع) × 1.5',
  },
  tall: {
    key: 'tall',
    label: 'الدواليب',
    multiplier: 1,
    requiresLength: false,
    rule: 'العرض × الارتفاع',
  },
  lshape: {
    key: 'lshape',
    label: 'القطعة حرف L',
    multiplier: 1,
    requiresLength: true,
    rule: '(العرض + الطول) × الارتفاع',
  },
  side: {
    key: 'side',
    label: 'الجوانب',
    multiplier: 0.7,
    requiresLength: false,
    rule: '(العرض × الارتفاع) × 0.70',
  },
};

// ---------------------------------------------------------------------------
// Vertical Levels Configuration
// ---------------------------------------------------------------------------
const LEVEL_CONFIG = {
  lower: {
    key: 'lower',
    label: 'القطع السفلية',
    shortLabel: 'سفلية',
    subtitle: 'Base Cabinets',
    defaultHeight: { cm: 90, m: 0.9 },
  },
  upper: {
    key: 'upper',
    label: 'القطع العلوية',
    shortLabel: 'علوية',
    subtitle: 'Wall Cabinets',
    defaultHeight: { cm: 80, m: 0.8 },
  },
  third: {
    key: 'third',
    label: 'المستوى الثالث',
    shortLabel: 'مستوى ثالث',
    subtitle: 'Loft Cabinets',
    defaultHeight: { cm: 40, m: 0.4 },
  },
};

const VALID_LEVELS = ['lower', 'upper', 'third'];

// ---------------------------------------------------------------------------
// Predefined Materials Catalog
// ---------------------------------------------------------------------------
const DEFAULT_MATERIALS = [
  { id: 'mat-hpl', name: 'HPL', pricePerMeter: 5200, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'mat-poly-back', name: 'Poly back', pricePerMeter: 7500, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'mat-poly-lac', name: 'Poly lac', pricePerMeter: 7200, isDefault: true, createdAt: '2026-01-01T00:00:00.000Z' },
];

const DEFAULT_LEVEL_PRICING = {
  lower: 'mat-hpl',
  upper: 'mat-poly-back',
  third: 'mat-poly-lac',
};

// ---------------------------------------------------------------------------
// In-Memory Data Store
// ---------------------------------------------------------------------------
let materials = [...DEFAULT_MATERIALS];
let levelPricing = { ...DEFAULT_LEVEL_PRICING };
let units = [];
let accessories = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
};

const cleanText = (value, maxLength = 60) =>
  typeof value === 'string' ? value.trim().slice(0, maxLength) : '';

const isPositive = (n) => Number.isFinite(n) && n > 0;

const describeCalculation = (typeDef, w, h, l, unitStr) => {
  if (typeDef.requiresLength) return `(${w}${unitStr} + ${l}${unitStr}) × ${h}${unitStr}`;
  const base = `${w}${unitStr} × ${h}${unitStr}`;
  return typeDef.multiplier === 1 ? base : `(${base}) × ${typeDef.multiplier}`;
};

// ---------------------------------------------------------------------------
// State Aggregator
// ---------------------------------------------------------------------------
const buildState = () => {
  // Ensure default materials exist
  DEFAULT_MATERIALS.forEach((defMat) => {
    if (!materials.some((m) => m.id === defMat.id || m.name.toLowerCase() === defMat.name.toLowerCase())) {
      materials.push({ ...defMat });
    }
  });

  // Ensure levelPricing maps to existing materials
  VALID_LEVELS.forEach((lvl, idx) => {
    if (!materials.some((m) => m.id === levelPricing[lvl])) {
      levelPricing[lvl] = DEFAULT_MATERIALS[idx]?.id || materials[0]?.id;
    }
  });

  const lowerMaterial = materials.find((m) => m.id === levelPricing.lower) || DEFAULT_MATERIALS[0];
  const upperMaterial = materials.find((m) => m.id === levelPricing.upper) || DEFAULT_MATERIALS[1];
  const thirdMaterial = materials.find((m) => m.id === levelPricing.third) || DEFAULT_MATERIALS[2];

  // Enrich units with level info and estimated unit cost based on assigned material
  const enrichedUnits = units.map((u) => {
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
  const lowerUnits = enrichedUnits.filter((u) => u.level === 'lower');
  const upperUnits = enrichedUnits.filter((u) => u.level === 'upper');
  const thirdUnits = enrichedUnits.filter((u) => u.level === 'third');

  const lowerArea = round(lowerUnits.reduce((sum, u) => sum + u.area, 0), 4);
  const upperArea = round(upperUnits.reduce((sum, u) => sum + u.area, 0), 4);
  const thirdArea = round(thirdUnits.reduce((sum, u) => sum + u.area, 0), 4);
  const grandTotalArea = round(lowerArea + upperArea + thirdArea, 4);

  // Calculate cost per level
  const lowerCost = round(lowerArea * lowerMaterial.pricePerMeter, 2);
  const upperCost = round(upperArea * upperMaterial.pricePerMeter, 2);
  const thirdCost = round(thirdArea * thirdMaterial.pricePerMeter, 2);

  const materialsTotalCost = round(lowerCost + upperCost + thirdCost, 2);
  const accessoriesCost = round(accessories.reduce((sum, a) => sum + (toNumber(a.price) || 0), 0), 2);
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
    units: enrichedUnits,
    materials,
    levelPricing,
    accessories,
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
    totalUnits: enrichedUnits.length,
    totalMaterials: materials.length,
  };
};

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

// 1. Full State
app.get('/api/state', (req, res) => {
  res.json(buildState());
});

// 2. Unit Types & Levels metadata
app.get('/api/unit-types', (req, res) => {
  res.json(Object.values(UNIT_TYPES));
});

app.get('/api/levels', (req, res) => {
  res.json(Object.values(LEVEL_CONFIG));
});

// 3. Units Endpoints (Decoupled from materials)
app.get('/api/units', (req, res) => {
  res.json(units);
});

app.post('/api/units', (req, res) => {
  const { type = 'standard', name, width, height, length, measurementUnit = 'cm', level = 'lower' } = req.body || {};
  const typeDef = UNIT_TYPES[type];
  if (!typeDef) {
    return res.status(400).json({ error: 'نوع الوحدة غير صالح' });
  }

  const validLevel = VALID_LEVELS.includes(level) ? level : 'lower';

  const rawW = toNumber(width);
  const rawH = toNumber(height);
  const rawL = typeDef.requiresLength ? toNumber(length) : null;

  if (!isPositive(rawW)) {
    return res.status(400).json({ error: 'العرض يجب أن يكون رقماً أكبر من صفر' });
  }
  if (!isPositive(rawH)) {
    return res.status(400).json({ error: 'الارتفاع يجب أن يكون رقماً أكبر من صفر' });
  }
  if (typeDef.requiresLength && !isPositive(rawL)) {
    return res.status(400).json({ error: 'الطول مطلوب للقطعة حرف L ويجب أن يكون أكبر من صفر' });
  }

  const mFactor = measurementUnit === 'cm' ? 0.01 : 1;
  const w = rawW * mFactor;
  const h = rawH * mFactor;
  const l = typeDef.requiresLength ? (rawL * mFactor) : 0;

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

  units.unshift(unit);

  res.status(201).json({
    message: `تمت إضافة الوحدة "${unit.name}" بنجاح`,
    item: unit,
    state: buildState(),
  });
});

app.put('/api/units/:unitId', (req, res) => {
  const unit = units.find((u) => u.id === req.params.unitId);
  if (!unit) {
    return res.status(404).json({ error: 'الوحدة غير موجودة' });
  }

  const { name, width, height, length, measurementUnit = unit.measurementUnit, level, type = unit.type } = req.body || {};
  const typeDef = UNIT_TYPES[type] || UNIT_TYPES[unit.type];

  const rawW = toNumber(width);
  const rawH = toNumber(height);
  const rawL = typeDef.requiresLength ? toNumber(length) : null;

  if (!isPositive(rawW)) {
    return res.status(400).json({ error: 'العرض يجب أن يكون رقماً أكبر من صفر' });
  }
  if (!isPositive(rawH)) {
    return res.status(400).json({ error: 'الارتفاع يجب أن يكون رقماً أكبر من صفر' });
  }
  if (typeDef.requiresLength && !isPositive(rawL)) {
    return res.status(400).json({ error: 'الطول مطلوب للقطعة حرف L ويجب أن يكون أكبر من صفر' });
  }

  const mFactor = measurementUnit === 'cm' ? 0.01 : 1;
  const w = rawW * mFactor;
  const h = rawH * mFactor;
  const l = typeDef.requiresLength ? (rawL * mFactor) : 0;

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

  res.json({
    message: `تم تعديل "${unit.name}" بنجاح`,
    item: unit,
    state: buildState(),
  });
});

app.delete('/api/units', (req, res) => {
  units = [];
  res.json({
    message: 'تم حذف جميع الوحدات بنجاح',
    state: buildState(),
  });
});

app.delete('/api/units/:unitId', (req, res) => {
  const index = units.findIndex((u) => u.id === req.params.unitId);
  let deletedName = 'الوحدة';
  if (index !== -1) {
    const [deleted] = units.splice(index, 1);
    deletedName = deleted.name;
  }
  res.json({
    message: `تم حذف "${deletedName}" بنجاح`,
    item: { id: req.params.unitId },
    state: buildState(),
  });
});

// Backward compatibility adapter for legacy /api/materials/:materialId/units
app.post('/api/materials/:materialId/units', (req, res) => {
  // Delegate directly to units creation
  const { type = 'standard', name, width, height, length, measurementUnit = 'cm', level = 'lower' } = req.body || {};
  const typeDef = UNIT_TYPES[type];
  if (!typeDef) return res.status(400).json({ error: 'نوع الوحدة غير صالح' });
  const validLevel = VALID_LEVELS.includes(level) ? level : 'lower';
  const rawW = toNumber(width);
  const rawH = toNumber(height);
  const rawL = typeDef.requiresLength ? toNumber(length) : null;
  if (!isPositive(rawW) || !isPositive(rawH)) {
    return res.status(400).json({ error: 'الأبعاد يجب أن تكون أكبر من صفر' });
  }
  const mFactor = measurementUnit === 'cm' ? 0.01 : 1;
  const w = rawW * mFactor;
  const h = rawH * mFactor;
  const l = typeDef.requiresLength ? (rawL * mFactor) : 0;
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
  units.unshift(unit);
  res.status(201).json({ message: `تمت إضافة "${unit.name}"`, item: unit, state: buildState() });
});

app.delete('/api/materials/:materialId/units/:unitId', (req, res) => {
  const index = units.findIndex((u) => u.id === req.params.unitId);
  if (index !== -1) units.splice(index, 1);
  res.json({ message: 'تم الحذف', state: buildState() });
});

// 4. Materials Registry Endpoints
app.get('/api/materials', (req, res) => {
  res.json(materials);
});

app.post('/api/materials', (req, res) => {
  const name = cleanText(req.body?.name);
  const price = toNumber(req.body?.pricePerMeter);

  if (!name) {
    return res.status(400).json({ error: 'اسم الخامة مطلوب' });
  }
  if (!isPositive(price)) {
    return res.status(400).json({ error: 'سعر المتر يجب أن يكون رقماً أكبر من صفر' });
  }
  const duplicate = materials.some((m) => m.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    return res.status(409).json({ error: `الخامة "${name}" موجودة بالفعل` });
  }

  const now = new Date().toISOString();
  const material = {
    id: randomUUID(),
    name,
    pricePerMeter: price,
    isDefault: false,
    createdAt: now,
  };
  materials.push(material);

  res.status(201).json({
    message: `تمت إضافة الخامة "${name}" بنجاح`,
    item: material,
    state: buildState(),
  });
});

app.put('/api/materials/:materialId', (req, res) => {
  const material = materials.find((m) => m.id === req.params.materialId);
  if (!material) {
    return res.status(404).json({ error: 'الخامة غير موجودة' });
  }

  const name = cleanText(req.body?.name);
  const price = toNumber(req.body?.pricePerMeter);

  if (!name) {
    return res.status(400).json({ error: 'اسم الخامة مطلوب ولا يمكن أن يكون فارغاً' });
  }
  if (!isPositive(price)) {
    return res.status(400).json({ error: 'سعر المتر يجب أن يكون رقماً أكبر من صفر' });
  }

  const duplicate = materials.some(
    (m) => m.id !== req.params.materialId && m.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    return res.status(409).json({ error: `توجد خامة أخرى باسم "${name}" بالفعل` });
  }

  material.name = name;
  material.pricePerMeter = price;
  material.lastUpdated = new Date().toISOString();

  res.json({
    message: `تم تعديل الخامة "${material.name}" بنجاح`,
    item: material,
    state: buildState(),
  });
});

app.delete('/api/materials/:materialId', (req, res) => {
  const material = materials.find((m) => m.id === req.params.materialId);
  if (!material) {
    return res.status(404).json({ error: 'الخامة غير موجودة' });
  }

  if (materials.length <= 1) {
    return res.status(400).json({ error: 'لا يمكن حذف الخامة الأخيرة، يجب أن يحتوي الكتالوج على خامة واحدة على الأقل' });
  }

  materials = materials.filter((m) => m.id !== material.id);
  const fallbackId = materials[0]?.id;

  VALID_LEVELS.forEach((lvl) => {
    if (levelPricing[lvl] === material.id) {
      levelPricing[lvl] = fallbackId;
    }
  });

  res.json({
    message: `تم حذف الخامة "${material.name}" بنجاح`,
    item: { id: material.id },
    state: buildState(),
  });
});

// 5. Level Pricing Configuration Endpoint
app.put('/api/level-pricing', (req, res) => {
  const { lower, upper, third, level, materialId } = req.body || {};

  if (level && materialId) {
    if (!VALID_LEVELS.includes(level)) {
      return res.status(400).json({ error: 'مستوى غير صالح' });
    }
    const matExists = materials.some((m) => m.id === materialId);
    if (!matExists) {
      return res.status(404).json({ error: 'الخامة المختارة غير موجودة' });
    }
    levelPricing[level] = materialId;
  } else {
    if (lower && materials.some((m) => m.id === lower)) levelPricing.lower = lower;
    if (upper && materials.some((m) => m.id === upper)) levelPricing.upper = upper;
    if (third && materials.some((m) => m.id === third)) levelPricing.third = third;
  }

  res.json({
    message: 'تم تحديث تسعير وخامات المستويات بنجاح',
    levelPricing,
    state: buildState(),
  });
});

// 6. Accessories
app.post('/api/accessories', (req, res) => {
  const { name, price } = req.body || {};
  const cost = toNumber(price);
  if (!name || !isPositive(cost)) {
    return res.status(400).json({ error: 'يرجى إدخال اسم وسعر صحيح للإكسسوار' });
  }

  const accessory = {
    id: randomUUID(),
    name: cleanText(name),
    price: cost,
    createdAt: new Date().toISOString(),
  };

  accessories.push(accessory);

  res.status(201).json({
    message: `تمت إضافة الإكسسوار "${accessory.name}"`,
    item: accessory,
    state: buildState(),
  });
});

app.delete('/api/accessories/:id', (req, res) => {
  const index = accessories.findIndex((a) => a.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'الإكسسوار غير موجود' });
  }

  const [deleted] = accessories.splice(index, 1);
  res.json({
    message: `تم حذف "${deleted.name}"`,
    item: deleted,
    state: buildState(),
  });
});

// ---------------------------------------------------------------------------
// Error Handling & Start
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ error: 'المسار غير موجود' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: 'حدث خطأ في الخادم' });
});

app.listen(PORT, () => {
  console.log(`🚀 Kitchen Cost API running on http://localhost:${PORT}`);
});
