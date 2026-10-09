import { NextResponse } from 'next/server';
import { loadData, saveData, buildState, VALID_LEVELS } from '@/lib/db';

export async function PUT(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { lower, upper, third, level, materialId } = body;
    const data = await loadData();
    data.levelPricing = data.levelPricing || { lower: 'mat-hpl', upper: 'mat-poly-back', third: 'mat-poly-lac' };

    if (level && materialId) {
      if (!VALID_LEVELS.includes(level)) {
        return NextResponse.json({ error: 'مستوى غير صالح' }, { status: 400 });
      }
      data.levelPricing[level] = materialId;
    } else {
      if (lower) data.levelPricing.lower = lower;
      if (upper) data.levelPricing.upper = upper;
      if (third) data.levelPricing.third = third;
    }

    await saveData(data);
    const state = await buildState();
    return NextResponse.json({
      message: 'تم تحديث تسعير وخامات المستويات بنجاح',
      levelPricing: data.levelPricing,
      state,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message || 'حدث خطأ في الخادم' }, { status: 500 });
  }
}
