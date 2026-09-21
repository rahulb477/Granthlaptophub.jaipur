import { db } from "@/db";
import { enquiries, products } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== "object") return Response.json({ error: "Invalid request" }, { status: 400 });
  const name = String(b.name ?? "").trim().slice(0, 120);
  const phone = String(b.phone ?? "").trim().slice(0, 20);
  const email = String(b.email ?? "").trim().slice(0, 160);
  if (!name || (!phone && !email)) {
    return Response.json({ error: "Please provide your name and a phone number or email." }, { status: 400 });
  }
  let productName = String(b.productName ?? "").trim().slice(0, 200);
  let productId: number | null = b.productId ? Number(b.productId) : null;
  if (productId) {
    const rows = await db.select({ id: products.id, name: products.name }).from(products).where(eq(products.id, productId)).limit(1);
    if (rows[0]) productName = productName || rows[0].name;
  }
  const [row] = await db
    .insert(enquiries)
    .values({
      name,
      phone,
      email,
      productId,
      productName,
      message: String(b.message ?? "").slice(0, 2000),
      source: ["website", "whatsapp", "product", "general"].includes(String(b.source)) ? String(b.source) : "website",
    })
    .returning();
  return Response.json({ ok: true, id: row.id }, { status: 201 });
}
