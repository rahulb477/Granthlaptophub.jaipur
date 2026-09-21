import { db } from "@/db";
import { brands as brandsT, categories as catsT, products as productsT, reviews as reviewsT } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { can, getSessionUser } from "@/lib/auth";
import { createRow, isTable, listRows } from "@/lib/api";

export const dynamic = "force-dynamic";

async function enrichProducts(rows: any[]) {
  if (!rows.length) return rows;
  const [bs, cs, rs] = await Promise.all([
    db.select().from(brandsT),
    db.select().from(catsT),
    db.select().from(reviewsT).where(eq(reviewsT.status, "approved")),
  ]);
  const bMap = new Map(bs.map((b) => [b.id, b.name]));
  const cMap = new Map(cs.map((c) => [c.id, c.name]));
  const ratings = new Map<number, { sum: number; n: number }>();
  for (const r of rs) {
    const cur = ratings.get(r.productId) ?? { sum: 0, n: 0 };
    cur.sum += r.rating;
    cur.n += 1;
    ratings.set(r.productId, cur);
  }
  return rows.map((r) => {
    const rt = ratings.get(r.id);
    return {
      ...r,
      brandName: r.brandId ? bMap.get(r.brandId) ?? "" : "",
      categoryName: r.categoryId ? cMap.get(r.categoryId) ?? "" : "",
      rating: rt && rt.n ? Math.round((rt.sum / rt.n) * 10) / 10 : 0,
      reviewCount: rt?.n ?? 0,
    };
  });
}

export async function GET(req: Request, ctx: { params: Promise<{ col: string }> }) {
  const admin = await getSessionUser();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { col } = await ctx.params;
  if (!isTable(col)) return Response.json({ error: "Unknown collection" }, { status: 400 });
  if (!can(admin.role, "read", col)) return Response.json({ error: "Forbidden for your role" }, { status: 403 });
  const sp = new URL(req.url).searchParams;
  const { rows } = await listRows(col, {
    search: sp.get("search") ?? undefined,
    status: sp.get("status") ?? undefined,
    brandId: sp.get("brandId") ? Number(sp.get("brandId")) : undefined,
    categoryId: sp.get("categoryId") ? Number(sp.get("categoryId")) : undefined,
    sort: sp.get("sort") ?? undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : 200,
  });
  const out = col === "products" ? await enrichProducts(rows) : rows;
  return Response.json({ rows: out, total: out.length });
}

export async function POST(req: Request, ctx: { params: Promise<{ col: string }> }) {
  const admin = await getSessionUser();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { col } = await ctx.params;
  if (!isTable(col)) return Response.json({ error: "Unknown collection" }, { status: 400 });
  if (!can(admin.role, "create", col)) return Response.json({ error: "Forbidden for your role" }, { status: 403 });
  try {
    const body = await req.json();
    const row = await createRow(col, body, admin);
    return Response.json({ row }, { status: 201 });
  } catch (e: any) {
    return Response.json({ error: e.message ?? "Failed to create" }, { status: 400 });
  }
}
