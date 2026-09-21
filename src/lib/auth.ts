import { cookies } from "next/headers";
import crypto from "node:crypto";
import { db } from "@/db";
import { adminUsers } from "@/db/schema";
import { eq } from "drizzle-orm";

const SECRET = process.env.ADMIN_SECRET || "mkc-jodhpur-local-secret";
export const SESSION_COOKIE = "mkc_admin_session";

export function hashPassword(pw: string, salt?: string) {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(pw, s, 32).toString("hex");
  return `${s}:${h}`;
}

export function verifyPassword(pw: string, stored: string) {
  const [s, h] = stored.split(":");
  if (!s || !h) return false;
  const t = crypto.scryptSync(pw, s, 32).toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(h, "hex"), Buffer.from(t, "hex"));
  } catch {
    return false;
  }
}

function mac(payload: string) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
}

export function createSessionToken(adminId: number, ttlMs: number) {
  const payload = `${adminId}.${Date.now() + ttlMs}`;
  const enc = Buffer.from(payload).toString("base64url");
  return `${enc}.${mac(enc)}`;
}

export async function readSessionAdminId(): Promise<number | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [enc, sig] = token.split(".");
  if (!enc || !sig || sig !== mac(enc)) return null;
  const [id, exp] = Buffer.from(enc, "base64url").toString("latin1").split(".").map(Number);
  if (!Number.isFinite(id) || !Number.isFinite(exp) || exp < Date.now()) return null;
  return id;
}

export async function getSessionUser() {
  const id = await readSessionAdminId();
  if (!id) return null;
  const rows = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.id, id))
    .limit(1);
  const u = rows[0];
  return u && u.active ? u : null;
}

export type AdminRole = "superadmin" | "admin" | "staff";

/* ---------- role permissions (enforced server-side in the API layer) ---------- */
export function can(role: string, action: "read" | "create" | "update" | "delete", col: string) {
  if (role === "superadmin") return true;
  if (role === "admin") return col !== "adminUsers";
  if (role === "staff") {
    if (action === "read") return true;
    if (col === "products") return action === "create" || action === "update";
    if (col === "orders" || col === "enquiries" || col === "reviews") return action === "update";
    return false;
  }
  return false;
}

export function canManageSettings(role: string) {
  return role === "superadmin" || role === "admin";
}
