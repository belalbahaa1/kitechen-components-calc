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
    message: `تم حذف "${deleted.name}"`,
    state: await buildState(),
  });
}
