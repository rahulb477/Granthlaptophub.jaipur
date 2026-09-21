import { db } from "@/db";
import { customers } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

/* Customers update their own profile by email. No passwords are stored for customers. */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const email = String(b?.email ?? "").trim().toLowerCase().slice(0, 160);
  const name = String(b?.name ?? "").trim().slice(0, 120);
  const phone = String(b?.phone ?? "").trim().slice(0, 20);
  const city = String(b?.city ?? "").trim().slice(0, 80);
  if (!email || !name) return Response.json({ error: "Email and name are required." }, { status: 400 });
  const ex = await db.select().from(customers).where(eq(customers.email, email)).limit(1);
  if (ex[0]) {
    await db
      .update(customers)
      .set({
        name,
        phone: phone || ex[0].phone,
        city: city || ex[0].city,
      })
      .where(eq(customers.id, ex[0].id));
    return Response.json({ ok: true, id: ex[0].id });
  }
  const [row] = await db.insert(customers).values({ name, email, phone, city }).returning();
  return Response.json({ ok: true, id: row.id }, { status: 201 });
}
