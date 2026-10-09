import { NextResponse } from 'next/server';
import {
  loadData,
  saveData,
  buildState,
  VALID_LEVELS,
  cleanText,
  toNumber,
  isPositive,
  round,
} from '@/lib/db';

export async function PUT(req, { params }) {
  try {
    const { materialId } = params;
    const body = await req.json().catch(() => ({}));
    const { name, pricePerMeter } = body;

    const data = await loadData();
    data.materials = data.materials || [];

    const material = data.materials.find((m) => m.id === materialId);
    if (!material) {
      return NextResponse.json({ error: 'الخامة غير موجودة' }, { status: 404 });
    }

    const trimmedName = cleanText(name);
    const parsedPrice = toNumber(pricePerMeter);

    if (!trimmedName) {
      return NextResponse.json({ error: 'اسم الخامة مطلوب ولا يمكن أن يكون فارغاً' }, { status: 400 });
    }

    if (!isPositive(parsedPrice)) {
      return NextResponse.json({ error: 'سعر المتر يجب أن يكون رقماً أكبر من صفر' }, { status: 400 });
    }

    // Check for duplicate name across other materials
    const duplicate = data.materials.some(
      (m) => m.id !== materialId && m.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicate) {
      return NextResponse.json({ error: `توجد خامة أخرى باسم "${trimmedName}" بالفعل` }, { status: 409 });
    }

    material.name = trimmedName;
    material.pricePerMeter = round(parsedPrice, 2);
    material.lastUpdated = new Date().toISOString();

    await saveData(data);
    const state = await buildState();

    return NextResponse.json({
      message: `تم تعديل الخامة "${material.name}" بنجاح`,
      item: material,
      state,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'حدث خطأ في الخادم' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { materialId } = params;
    const data = await loadData();
    data.materials = data.materials || [];

    const materialIndex = data.materials.findIndex((m) => m.id === materialId);
    if (materialIndex === -1) {
      return NextResponse.json({ error: 'الخامة غير موجودة' }, { status: 404 });
    }

    if (data.materials.length <= 1) {
      return NextResponse.json(
        { error: 'لا يمكن حذف الخامة الأخيرة، يجب أن يحتوي الكتالوج على خامة واحدة على الأقل' },
        { status: 400 }
      );
    }

    const [deletedMaterial] = data.materials.splice(materialIndex, 1);

    // Reassign levels using this material to first remaining material
    const fallbackId = data.materials[0].id;
    if (data.levelPricing) {
      VALID_LEVELS.forEach((lvl) => {
        if (data.levelPricing[lvl] === materialId) {
          data.levelPricing[lvl] = fallbackId;
        }
      });
    }

    await saveData(data);
    const state = await buildState();

    return NextResponse.json({
      message: `تم حذف الخامة "${deletedMaterial.name}" بنجاح`,
      item: { id: materialId },
      state,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
