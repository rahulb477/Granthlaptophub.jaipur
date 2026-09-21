import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { canManageSettings, getSessionUser } from "@/lib/auth";
import { getAllSettings, SETTING_KEYS } from "@/lib/site";
import { logActivity } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (!SETTING_KEYS.includes(key as any)) return Response.json({ error: "Unknown setting" }, { status: 400 });
  const all = await getAllSettings();
  return Response.json({ key, value: (all as any)[key] });
}

export async function PUT(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const admin = await getSessionUser();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!canManageSettings(admin.role)) return Response.json({ error: "Only Admin / Super Admin can change site settings" }, { status: 403 });
  const { key } = await ctx.params;
  if (!SETTING_KEYS.includes(key as any)) return Response.json({ error: "Unknown setting" }, { status: 400 });
  const value = await req.json().catch(() => null);
  if (typeof value !== "object" || value === null) return Response.json({ error: "Invalid payload" }, { status: 400 });
  const existing = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  if (existing[0]) {
    await db.update(settings).set({ value, updatedAt: new Date() }).where(eq(settings.key, key));
  } else {
    await db.insert(settings).values({ key, value, updatedAt: new Date() });
  }
  const keys = Object.keys(value).slice(0, 6).join(", ");
  await logActivity(admin, "update", "settings", key, `Homepage/Settings section "${key}" updated (${keys})`);
  return Response.json({ ok: true });
}
