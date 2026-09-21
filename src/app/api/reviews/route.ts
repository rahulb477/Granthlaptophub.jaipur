import { db } from "@/db";
import { products, reviews } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { logActivity } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const pid = Number(sp.get("productId"));
  if (!pid) return Response.json({ rows: [] });
  const rows = await db
    .select()
    .from(reviews)
    .where(eq(reviews.productId, pid))
    .orderBy(desc(reviews.featured), desc(reviews.createdAt));
  return Response.json({ rows: rows.filter((r) => r.status === "approved") });
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b) return Response.json({ error: "Invalid request" }, { status: 400 });
  const productId = Number(b.productId);
  const customerName = String(b.customerName ?? "").trim().slice(0, 120);
  const rating = Math.max(1, Math.min(5, Number(b.rating) || 5));
  const text = String(b.text ?? "").trim().slice(0, 2000);
  if (!productId || !customerName || !text) {
    return Response.json({ error: "Name, rating and review text are required." }, { status: 400 });
  }
  const rows = await db.select({ id: products.id, name: products.name }).from(products).where(eq(products.id, productId)).limit(1);
  if (!rows[0]) return Response.json({ error: "Product not found" }, { status: 404 });
  const [row] = await db
    .insert(reviews)
    .values({ productId, customerName, rating, text, status: "pending" })
    .returning();
  await logActivity(null, "review", "reviews", row.id, `New review (pending) on ${rows[0].name} by ${customerName}`);
  return Response.json({ ok: true, id: row.id }, { status: 201 });
}
