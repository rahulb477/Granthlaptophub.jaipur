/**
 * Admin Activity Log — single entry point for every admin mutation.
 *
 * Guarantees:
 *  - Called ONLY AFTER the underlying operation succeeded.
 *  - NEVER throws: a logging failure must not fail the product/order/CMS write.
 *  - Captures the authenticated Firebase admin automatically (uid + email),
 *    so no page has to thread the user through.
 *  - Writes both `createdAt` (serverTimestamp) and `createdAtMs` (client
 *    number) so the Activity page can order entries even before the server
 *    timestamp resolves.
 *
 * Documents are append-only: Firestore rules allow create + read for admins
 * and deny update/delete, so the log is immutable from the Admin Panel.
 */
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";
import { sanitizeFirestoreData } from "./firestore-sanitize";

export const ACTIVITY_COLLECTION = "activityLog";

export type ActivityAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "STATUS"
  | "PUBLISH"
  | "UPLOAD"
  | "LOGIN"
  | "LOGOUT"
  | "SETTINGS";

export interface AdminActivityInput {
  action: ActivityAction | string;
  /** Logical entity: Product, Category, Brand, Order, Coupon, Settings, ... */
  entity: string;
  entityId?: string;
  /** Human sentence, e.g. "Updated ThinkPad T490 price from ₹29,999 to ₹27,999". */
  description: string;
  /** Optional structured before/after for auditing. */
  changes?: Record<string, unknown>;
}

/**
 * Fire-and-forget activity write. Always resolves; errors are only warned.
 */
export async function logAdminAction(input: AdminActivityInput): Promise<void> {
  try {
    const user = auth.currentUser;
    const payload = sanitizeFirestoreData({
      adminUid: user?.uid ?? "unknown",
      adminName: user?.displayName || user?.email || "admin",
      adminEmail: user?.email ?? "",
      action: String(input.action || "UPDATE").toUpperCase(),
      entity: input.entity,
      entityId: input.entityId ?? "",
      description: input.description,
      summary: input.description, // legacy field name used by the Activity page
      changes: input.changes,
      createdAt: serverTimestamp(),
      createdAtMs: Date.now(),
    });
    await addDoc(collection(db, ACTIVITY_COLLECTION), payload as Record<string, unknown>);
  } catch (e) {
    // Non-fatal by design — the real operation already succeeded.
    console.warn("[activity] log write failed (non-fatal):", e);
  }
}

/** Builds a readable "field changed from X to Y" description. */
export function describeChange(
  label: string,
  before: unknown,
  after: unknown,
  format: (v: unknown) => string = (v) => String(v ?? "—")
): string | null {
  if (before === after) return null;
  return `${label} changed from ${format(before)} to ${format(after)}`;
}

export function inr(v: unknown): string {
  const n = Number(v);
  return Number.isFinite(n) ? `₹${n.toLocaleString("en-IN")}` : "—";
}
