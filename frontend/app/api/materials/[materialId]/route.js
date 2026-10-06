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
    message: `تم حذف الخامة "${material.name}"`,
    item: { id: material.id },
    state: await buildState(),
  });
}
