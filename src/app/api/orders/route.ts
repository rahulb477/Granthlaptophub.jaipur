import { db } from "@/db";
import { coupons, customers, orders, products } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { logActivity } from "@/lib/api";

export const dynamic = "force-dynamic";

function variantDelta(product: any, variant: Record<string, string>) {
  let delta = 0;
  for (const dim of product.variants ?? []) {
    const choice = variant?.[dim.name];
    if (!choice) continue;
    const opt = (dim.options ?? []).find((o: any) => o.label === choice);
    if (opt) delta += opt.delta ?? 0;
  }
  return delta;
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return Response.json({ error: "Invalid request" }, { status: 400 });
  const name = String(b.name ?? "").trim().slice(0, 120);
  const phone = String(b.phone ?? "").trim().slice(0, 20);
  const email = String(b.email ?? "").trim().toLowerCase().slice(0, 160);
  const address = String(b.address ?? "").trim().slice(0, 500);
  const city = String(b.city ?? "Jaipur").trim().slice(0, 80);
  if (!name || !phone) return Response.json({ error: "Name and phone number are required." }, { status: 400 });
  if (!Array.isArray(b.items) || b.items.length === 0) {
    return Response.json({ error: "Your cart is empty." }, { status: 400 });
  }

  const items: any[] = [];
  let subtotal = 0;
  for (const it of b.items.slice(0, 20)) {
    const qty = Math.max(1, Math.min(10, Number(it.qty) || 1));
    const rows = await db.select().from(products).where(eq(products.id, Number(it.productId))).limit(1);
    const p = rows[0];
    if (!p || p.status !== "published") {
      return Response.json({ error: "One of the items in your cart is no longer available. Please review the cart." }, { status: 400 });
    }
    const unitPrice = p.price + variantDelta(p, it.variant ?? {});
    subtotal += unitPrice * qty;
    items.push({
      productId: p.id,
      name: p.name,
      image: p.images?.[0] ?? "",
      variant: it.variant ?? {},
      qty,
      unitPrice,
    });
  }

  /* coupon validation — real calculation, server side */
  let discount = 0;
  let couponCode = "";
  const code = String(b.couponCode ?? "").trim().toUpperCase();
  if (code) {
    const cs = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
    const c = cs[0];
    const now = new Date();
    const valid =
      c &&
      c.active &&
      (!c.startAt || c.startAt <= now) &&
      (!c.expiresAt || c.expiresAt >= now) &&
      subtotal >= c.minOrder &&
      (c.usageLimit === 0 || c.usedCount < c.usageLimit);
    if (!valid) {
      return Response.json({ error: `Coupon "${code}" is not valid for this order.` }, { status: 400 });
    }
    discount = c.type === "percent" ? Math.round((subtotal * c.value) / 100) : c.value;
    if (c.maxDiscount > 0) discount = Math.min(discount, c.maxDiscount);
    await db.update(coupons).set({ usedCount: c.usedCount + 1 }).where(eq(coupons.id, c.id));
    couponCode = c.code;
  }
  const total = Math.max(0, subtotal - discount);

  /* customer upsert by email (no passwords stored for customers) */
  let customerId: number | null = null;
  if (email) {
    const ex = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
    if (ex[0]) {
      customerId = ex[0].id;
      await db
        .update(customers)
        .set({ name, phone: phone || ex[0].phone, city: city || ex[0].city })
        .where(eq(customers.id, ex[0].id));
    } else {
      const [cu] = await db.insert(customers).values({ name, email, phone, city }).returning();
      customerId = cu.id;
    }
  }

  const count = await db.select({ id: orders.id }).from(orders);
  const orderNo = `MKC-${1000 + count.length + 1}`;
  const [order] = await db
    .insert(orders)
    .values({
      orderNo,
      customerId,
      name,
      email,
      phone,
      address: `${address}${city ? ", " + city : ""}`,
      note: String(b.note ?? "").slice(0, 500),
      items,
      subtotal,
      discount,
      couponCode,
      total,
      paymentMethod: b.paymentMethod === "upi" ? "upi" : "cod",
      status: "pending",
    })
    .returning();
  await logActivity(null, "order", "orders", order.id, `New order ${orderNo} from ${name} — total ₹${total.toLocaleString("en-IN")}`);
  return Response.json({ ok: true, orderNo: order.orderNo, total, discount }, { status: 201 });
}
