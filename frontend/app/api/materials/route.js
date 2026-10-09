import { NextResponse } from 'next/server';
import { loadData, saveData, buildState, cleanText, toNumber, isPositive, DEFAULT_MATERIALS } from '@/lib/db';
import { randomUUID } from 'crypto';

export async function GET() {
  const data = await loadData();
  return NextResponse.json(data.materials || DEFAULT_MATERIALS);
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const name = cleanText(body?.name);
  const price = toNumber(body?.pricePerMeter);

  if (!name) return NextResponse.json({ error: 'اسم الخامة مطلوب' }, { status: 400 });
  if (!isPositive(price)) return NextResponse.json({ error: 'سعر المتر يجب أن يكون رقماً أكبر من صفر' }, { status: 400 });

  const data = await loadData();
  data.materials = data.materials || [...DEFAULT_MATERIALS];

  if (data.materials.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: `الخامة "${name}" موجودة بالفعل` }, { status: 409 });
  }

  const now = new Date().toISOString();
  const material = {
    id: randomUUID(),
    name,
    pricePerMeter: price,
    isDefault: false,
    createdAt: now,
  };

  data.materials.push(material);
  await saveData(data);

  return NextResponse.json(
    {
      message: `تمت إضافة الخامة "${name}" بنجاح`,
      item: material,
      state: await buildState(),
    },
    { status: 201 }
  );
}
