import { db } from "@/db";
import { canManageSettings, getSessionUser } from "@/lib/auth";
import { TABLES, toCsv } from "@/lib/api";

export const dynamic = "force-dynamic";

const CSV_COLS: Record<string, [string, string][]> = {
  products: [["id", "ID"], ["name", "Name"], ["sku", "SKU"], ["price", "Price"], ["mrp", "MRP"], ["stockQty", "Stock"], ["status", "Status"], ["tags", "Tags"]],
  categories: [["id", "ID"], ["name", "Name"], ["slug", "Slug"], ["description", "Description"], ["active", "Active"], ["sortOrder", "Order"]],
  orders: [["id", "ID"], ["orderNo", "Order No"], ["name", "Customer"], ["phone", "Phone"], ["email", "Email"], ["subtotal", "Subtotal"], ["discount", "Discount"], ["total", "Total"], ["status", "Status"], ["createdAt", "Date"]],
  customers: [["id", "ID"], ["name", "Name"], ["email", "Email"], ["phone", "Phone"], ["city", "City"], ["createdAt", "Since"]],
  enquiries: [["id", "ID"], ["name", "Name"], ["phone", "Phone"], ["email", "Email"], ["productName", "Product"], ["message", "Message"], ["source", "Source"], ["status", "Status"], ["createdAt", "Date"]],
  blogPosts: [["id", "ID"], ["title", "Title"], ["slug", "Slug"], ["category", "Category"], ["published", "Published"], ["featured", "Featured"], ["createdAt", "Created"]],
  reviews: [["id", "ID"], ["productId", "Product ID"], ["customerName", "Customer"], ["rating", "Rating"], ["status", "Status"], ["createdAt", "Date"]],
};

export async function GET(req: Request, ctx: { params: Promise<{ col: string }> }) {
  const admin = await getSessionUser();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageSettings(admin.role)) return Response.json({ error: "Forbidden for your role" }, { status: 403 });
  const { col } = await ctx.params;
  if (!TABLES[col]) return Response.json({ error: "Unknown collection" }, { status: 400 });
  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const rows = (await db.select().from(TABLES[col].table).limit(1000)) as any[];
  const safeName = `${col}-${new Date().toISOString().slice(0, 10)}`;
  if (format === "csv") {
    const csv = toCsv(rows, CSV_COLS[col] ?? [["id", "ID"]]);
    return new Response(csv, {
      headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="${safeName}.csv"` },
    });
  }
  return new Response(JSON.stringify(rows, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="${safeName}.json"` },
  });
}
