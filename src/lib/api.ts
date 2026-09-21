import { db } from "@/db";
import * as S from "@/db/schema";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { AdminUser } from "@/lib/types";

const T = S as any;

export const TABLES: Record<string, { table: any; label: string; searchCols: string[] }> = {
  products: { table: T.products, label: "Product", searchCols: ["name", "sku", "processor", "seoTitle"] },
  categories: { table: T.categories, label: "Category", searchCols: ["name"] },
  brands: { table: T.brands, label: "Brand", searchCols: ["name"] },
  orders: { table: T.orders, label: "Order", searchCols: ["orderNo", "name", "phone", "email"] },
  customers: { table: T.customers, label: "Customer", searchCols: ["name", "email", "phone"] },
  enquiries: { table: T.enquiries, label: "Enquiry", searchCols: ["name", "phone", "email", "productName"] },
  offers: { table: T.offers, label: "Offer", searchCols: ["name", "badge"] },
  coupons: { table: T.coupons, label: "Coupon", searchCols: ["code"] },
  reviews: { table: T.reviews, label: "Review", searchCols: ["customerName", "text"] },
  videos: { table: T.videos, label: "Video", searchCols: ["title"] },
  blogPosts: { table: T.blogPosts, label: "Blog Post", searchCols: ["title", "category"] },
  media: { table: T.media, label: "Media", searchCols: ["name", "url"] },
  adminUsers: { table: T.adminUsers, label: "Admin User", searchCols: ["name", "email"] },
  activityLog: { table: T.activityLog, label: "Activity", searchCols: ["summary", "entity", "adminName"] },
};

export function isTable(col: string) {
  return !!TABLES[col];
}

const trunc = (v: unknown, n = 90) => {
  const s = v === null || v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v);
  return s.length > n ? s.slice(0, n) + "…" : s;
};

export async function logActivity(
  admin: AdminUser | null,
  action: string,
  entity: string,
  entityId: string | number,
  summary: string,
  diff?: Record<string, { from: string; to: string }>
) {
  try {
    await db.insert(S.activityLog).values({
      adminId: admin?.id ?? null,
      adminName: admin?.name ?? "system",
      action,
      entity,
      entityId: String(entityId ?? ""),
      summary,
      diff: diff ?? null,
    });
  } catch (e) {
    console.error("activity log failed", e);
  }
}

/* ---------- list ---------- */
export interface ListQuery {
  search?: string;
  status?: string;
  brandId?: number;
  categoryId?: number;
  sort?: string;
  limit?: number;
}

export async function listRows(col: string, q: ListQuery) {
  if (!isTable(col)) return { rows: [], total: 0 };
  const { table, searchCols } = TABLES[col];
  const conds: any[] = [];
  if (q.search) {
    const like = `%${q.search}%`;
    conds.push(or(...searchCols.map((c) => ilike(table[c], like))!));
  }
  if (q.status && "status" in table) conds.push(eq(table.status, q.status));
  if (q.brandId && "brandId" in table) conds.push(eq(table.brandId, q.brandId));
  if (q.categoryId && "categoryId" in table) conds.push(eq(table.categoryId, q.categoryId));

  let order: any = desc(table.createdAt);
  const sort = q.sort || "";
  if (sort === "price_asc") order = asc(table.price);
  else if (sort === "price_desc") order = desc(table.price);
  else if (sort === "name_asc") order = asc(table.name);
  else if (sort === "stock_asc") order = asc(table.stockQty);
  else if ("sortOrder" in table) order = asc(table.sortOrder);
  else if (sort === "oldest") order = asc(table.createdAt);

  const rows = await db
    .select()
    .from(table)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(order)
    .limit(q.limit ?? 200);

  return { rows, total: rows.length };
}

/* ---------- read ---------- */
export async function getRow(col: string, id: number) {
  if (!isTable(col)) return null;
  const rows = await db.select().from(TABLES[col].table).where(eq(TABLES[col].table.id, id)).limit(1);
  return rows[0] ?? null;
}

/* ---------- write ---------- */
export async function createRow(col: string, body: Record<string, unknown>, admin: AdminUser | null) {
  if (!isTable(col)) throw new Error("Unknown collection");
  const { table, label } = TABLES[col];
  const cols = Object.keys(table);
  const data: Record<string, unknown> = {};
  for (const k of Object.keys(body)) {
    if (cols.includes(k) && body[k] !== undefined) data[k] = body[k];
  }
  if ("slug" in table && (!data.slug || !String(data.slug).trim())) {
    const base = slugifyLocal(String(data.name ?? data.code ?? `item-${Date.now()}`));
    let slug = base;
    let i = 2;
    while (await slugTaken(table, slug)) slug = `${base}-${i++}`;
    data.slug = slug;
  }
  const created = (await db.insert(table).values(data).returning()) as any[];
  const row = created[0];
  await logActivity(admin, "create", col, row.id, `${label} created: ${trunc(String(data.name ?? data.code ?? data.title ?? data.email ?? ""))}`);
  return row;
}

export async function updateRow(col: string, id: number, body: Record<string, unknown>, admin: AdminUser | null) {
  if (!isTable(col)) throw new Error("Unknown collection");
  const { table, label } = TABLES[col];
  const old = await getRow(col, id);
  if (!old) throw new Error("Record not found");
  const cols = Object.keys(table);
  const data: Record<string, unknown> = {};
  const diff: Record<string, { from: string; to: string }> = {};
  for (const k of Object.keys(body)) {
    if (!cols.includes(k) || body[k] === undefined) continue;
    if (k === "id" || k === "createdAt") continue;
    data[k] = body[k];
    if (JSON.stringify((old as any)[k]) !== JSON.stringify(body[k])) {
      diff[k] = { from: trunc((old as any)[k]), to: trunc(body[k]) };
    }
  }
  if (Object.keys(data).length === 0) return old;
  if ("updatedAt" in table) data.updatedAt = new Date();
  const updated = (await db.update(table).set(data).where(eq(table.id, id)).returning()) as any[];
  const row = updated[0];
  const summaryBits = Object.keys(diff).slice(0, 5).join(", ");
  await logActivity(admin, "update", col, id, `${label} #${id} updated${summaryBits ? ` (${summaryBits})` : ""}`, diff);
  return row;
}

export async function deleteRow(col: string, id: number, admin: AdminUser | null, hard = false) {
  if (!isTable(col)) throw new Error("Unknown collection");
  const { table, label } = TABLES[col];
  if (col === "products" && !hard) {
    const row = await updateRow(col, id, { status: "archived" }, admin);
    return { archived: true, row };
  }
  const old = await getRow(col, id);
  await db.delete(table).where(eq(table.id, id));
  await logActivity(admin, hard ? "delete" : "archive", col, id, `${label} #${id} ${hard ? "permanently deleted" : "removed"}${old ? `: ${trunc(String((old as any).name ?? (old as any).orderNo ?? (old as any).title ?? ""))}` : ""}`);
  return { hard: true };
}

export async function duplicateProduct(id: number, admin: AdminUser | null) {
  const p = await getRow("products", id);
  if (!p) throw new Error("Product not found");
  const name = `${(p as any).name} (Copy)`;
  let slug = `${(p as any).slug}-copy`;
  let i = 2;
  while (await slugTaken(T.products, slug)) slug = `${(p as any).slug}-copy-${i++}`;
  const dup = (await db
    .insert(T.products)
    .values({
      ...(p as any),
      id: undefined,
      name,
      slug,
      sku: `${(p as any).sku ? (p as any).sku + "-" : ""}C${i}`,
      status: "draft",
    } as any)
    .returning()) as any[];
  const row = dup[0];
  await logActivity(admin, "create", "products", row.id, `Product duplicated: ${trunc(name)}`);
  return row;
}

async function slugTaken(table: any, slug: string) {
  const rows = await db.select({ id: table.id }).from(table).where(eq(table.slug, slug)).limit(1);
  return rows.length > 0;
}

function slugifyLocal(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "").slice(0, 80);
}

/* ---------- csv export ---------- */
export function toCsv(rows: any[], cols: [string, string][]) {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = cols.map(([, l]) => l).join(",");
  const body = rows.map((r) => cols.map(([k]) => esc(r[k])).join(",")).join("\n");
  return head + "\n" + body;
}

/* ---------- admin global search ---------- */
export async function adminGlobalSearch(q: string) {
  const like = `%${q}%`;
  const out: Record<string, any[]> = {};
  const pairs: [string, string[]][] = [
    ["products", ["name", "sku", "processor"]],
    ["orders", ["orderNo", "name", "phone"]],
    ["customers", ["name", "email", "phone"]],
    ["enquiries", ["name", "phone", "productName"]],
    ["blogPosts", ["title"]],
    ["offers", ["name"]],
  ];
  for (const [col, cols] of pairs) {
    if (!TABLES[col]) continue;
    const t = TABLES[col].table;
    const rows = await db
      .select()
      .from(t)
      .where(or(...cols.map((c) => ilike(t[c], like))!))
      .limit(4);
    out[col] = rows;
  }
  return out;
}

/* ---------- notifications ---------- */
export async function adminNotifications(threshold: number) {
  const [newEnq, pendingRev, pendingOrders, lowStock] = await Promise.all([
    db.select({ id: S.enquiries.id }).from(S.enquiries).where(eq(S.enquiries.status, "new")).limit(50),
    db.select({ id: S.reviews.id }).from(S.reviews).where(eq(S.reviews.status, "pending")).limit(50),
    db.select({ id: S.orders.id }).from(S.orders).where(eq(S.orders.status, "pending")).limit(50),
    db
      .select({ id: S.products.id, name: S.products.name, stockQty: S.products.stockQty })
      .from(S.products)
      .where(and(eq(S.products.status, "published"), sql`${S.products.stockQty} <= ${threshold}`, sql`${S.products.stockQty} >= 0`)),
  ]);
  return {
    newEnquiries: newEnq.length,
    pendingReviews: pendingRev.length,
    pendingOrders: pendingOrders.length,
    lowStock,
  };
}
