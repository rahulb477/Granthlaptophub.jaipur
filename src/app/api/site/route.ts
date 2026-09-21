import { db } from "@/db";
import { coupons } from "@/db/schema";
import { getAllSettings } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function GET() {
  const all = await getAllSettings();
  const now = new Date();
  const rows = await db.select().from(coupons);
  const validCoupons = rows
    .filter((c) => c.active && (!c.startAt || c.startAt <= now) && (!c.expiresAt || c.expiresAt >= now))
    .map((c) => ({ code: c.code, type: c.type, value: c.value, minOrder: c.minOrder, maxDiscount: c.maxDiscount }));
  return Response.json({ ...all, validCoupons });
}
