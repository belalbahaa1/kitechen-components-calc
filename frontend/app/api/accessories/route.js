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
    message: `تم إضافة الإكسسوار "${accessory.name}"`,
    state: await buildState(),
  }, { status: 201 });
}
