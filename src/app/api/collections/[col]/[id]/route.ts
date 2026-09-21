import { can, getSessionUser } from "@/lib/auth";
import { deleteRow, duplicateProduct, getRow, isTable, updateRow } from "@/lib/api";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ col: string; id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const admin = await getSessionUser();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { col, id } = await ctx.params;
  if (!isTable(col) || !can(admin.role, "read", col)) return Response.json({ error: "Forbidden" }, { status: 403 });
  const row = await getRow(col, Number(id));
  return row ? Response.json({ row }) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function PUT(req: Request, ctx: Ctx) {
  const admin = await getSessionUser();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { col, id } = await ctx.params;
  if (!isTable(col) || !can(admin.role, "update", col)) return Response.json({ error: "Forbidden for your role" }, { status: 403 });
  try {
    const body = await req.json();
    const row = await updateRow(col, Number(id), body, admin);
    return Response.json({ row });
  } catch (e: any) {
    return Response.json({ error: e.message ?? "Failed to update" }, { status: 400 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const admin = await getSessionUser();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { col, id } = await ctx.params;
  if (!isTable(col) || !can(admin.role, "delete", col)) return Response.json({ error: "Forbidden for your role" }, { status: 403 });
  const hard = new URL(req.url).searchParams.get("hard") === "1" && admin.role !== "staff";
  try {
    const out = await deleteRow(col, Number(id), admin, hard);
    return Response.json(out);
  } catch (e: any) {
    return Response.json({ error: e.message ?? "Failed to delete" }, { status: 400 });
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const admin = await getSessionUser();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { col, id } = await ctx.params;
  if (col !== "products") return Response.json({ error: "Unsupported" }, { status: 400 });
  if (!can(admin.role, "create", "products")) return Response.json({ error: "Forbidden for your role" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (body.action === "duplicate") {
    const row = await duplicateProduct(Number(id), admin);
    return Response.json({ row }, { status: 201 });
  }
  return Response.json({ error: "Unknown action" }, { status: 400 });
}
