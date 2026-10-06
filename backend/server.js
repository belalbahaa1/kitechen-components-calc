const express = require('express');
const cors = require('cors');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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
  base: {
    key: 'base',
    label: 'وحدة سفلية',
    multiplier: 1,
    requiresLength: false,
    rule: 'العرض × الارتفاع',
  },
  wall: {
    key: 'wall',
    label: 'وحدة علوية',
    multiplier: 1,
    requiresLength: false,
    rule: 'العرض × الارتفاع',
  },
  island: {
    key: 'island',
    label: 'جزيرة',
    multiplier: 1.5,
    requiresLength: false,
    rule: '(العرض × الارتفاع) × 1.5',
  },
  custom: {
    key: 'custom',
    label: 'وحدة خاصة',
    multiplier: 1.2,
    requiresLength: false,
    rule: '(العرض × الارتفاع) × 1.2',
  },
};

let materials = [];
let accessories = [];

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

const findMaterial = (id) => materials.find((m) => m.id === id);

const buildState = () => {
  // Sort materials by lastUpdated desc
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
};

app.get('/api/state', (req, res) => {
  res.json(buildState());
});

app.get('/api/unit-types', (req, res) => {
  res.json(Object.values(UNIT_TYPES));
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
    createdAt: now,
    lastUpdated: now,
    units: [],
  };
  materials.push(material);

  res.status(201).json({
    message: `تمت إضافة الخامة "${name}" بنجاح`,
    item: { id: material.id, name, pricePerMeter: price },
    state: buildState(),
  });
});

app.delete('/api/materials/:materialId', (req, res) => {
  const material = findMaterial(req.params.materialId);
  if (!material) {
    return res.status(404).json({ error: 'الخامة غير موجودة' });
  }

  materials = materials.filter((m) => m.id !== material.id);
  res.json({
    message: `تم حذف الخامة "${material.name}"`,
    item: { id: material.id },
    state: buildState(),
  });
});

app.post('/api/materials/:materialId/units', (req, res) => {
  const material = findMaterial(req.params.materialId);
  if (!material) {
    return res.status(404).json({ error: 'الخامة غير موجودة' });
  }

  const { type, name, width, height, length, measurementUnit = 'cm' } = req.body || {};
  const typeDef = UNIT_TYPES[type];
  if (!typeDef) {
    return res.status(400).json({ error: 'نوع الوحدة غير صالح' });
  }

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
  material.units.push(unit);
  material.lastUpdated = new Date().toISOString();

  res.status(201).json({
    message: `تمت إضافة "${unit.name}" إلى ${material.name}`,
    item: unit,
    state: buildState(),
  });
});

app.delete('/api/materials/:materialId/units/:unitId', (req, res) => {
  const material = findMaterial(req.params.materialId);
  if (!material) {
    return res.status(404).json({ error: 'الخامة غير موجودة' });
  }

  const unit = material.units.find((u) => u.id === req.params.unitId);
  if (!unit) {
    return res.status(404).json({ error: 'الوحدة غير موجودة' });
  }

  material.units = material.units.filter((u) => u.id !== unit.id);
  material.lastUpdated = new Date().toISOString();
  
  res.json({
    message: `تم حذف "${unit.name}"`,
    item: { id: unit.id, materialId: material.id },
    state: buildState(),
  });
});

app.put('/api/materials/:materialId/units/:unitId', (req, res) => {
  const material = findMaterial(req.params.materialId);
  if (!material) {
    return res.status(404).json({ error: 'الخامة غير موجودة' });
  }

  const unit = material.units.find((u) => u.id === req.params.unitId);
  if (!unit) {
    return res.status(404).json({ error: 'الوحدة غير موجودة' });
  }

  const { name, width, height, length, measurementUnit = unit.measurementUnit } = req.body || {};
  const typeDef = UNIT_TYPES[unit.type];

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
  unit.width = rawW;
  unit.height = rawH;
  unit.length = rawL;
  unit.measurementUnit = measurementUnit;
  unit.calculation = describeCalculation(typeDef, rawW, rawH, rawL, unitStr);
  unit.area = round(area, 4);

  material.lastUpdated = new Date().toISOString();

  res.json({
    message: `تم تعديل "${unit.name}" بنجاح`,
    item: unit,
    state: buildState(),
  });
});

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
    message: `تم إضافة الإكسسوار "${accessory.name}"`,
    state: buildState(),
  });
});

app.delete('/api/accessories/:id', (req, res) => {
  const index = accessories.findIndex(a => a.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'الإكسسوار غير موجود' });
  }

  const [deleted] = accessories.splice(index, 1);
  res.json({
    message: `تم حذف "${deleted.name}"`,
    state: buildState(),
  });
});

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
