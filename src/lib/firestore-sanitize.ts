/**
 * Firestore write sanitizer.
 *
 * Firestore rejects `undefined` field values:
 *   "Function setDoc() called with invalid data.
 *    Unsupported field value: undefined (found in field discount ...)"
 *
 * Every write performed by the Admin Panel must pass through
 * `sanitizeFirestoreData()` first. It recursively removes `undefined`
 * (and `NaN`, and functions) while carefully PRESERVING Firestore
 * sentinel values (serverTimestamp(), deleteField(), increment(),
 * arrayUnion()) and Timestamp / GeoPoint / DocumentReference / Date
 * instances, which must never be deep-cloned.
 */

/** Sentinels & Firestore SDK objects that must be passed through untouched. */
function isFirestoreNativeValue(v: unknown): boolean {
  if (v === null || typeof v !== "object") return false;
  if (v instanceof Date) return true;
  const ctor = (v as { constructor?: { name?: string } }).constructor?.name ?? "";
  // FieldValue (serverTimestamp/increment/arrayUnion/deleteField), Timestamp,
  // GeoPoint, DocumentReference, Bytes — all expose SDK class names.
  if (
    ctor.includes("FieldValue") ||
    ctor.includes("Timestamp") ||
    ctor.includes("GeoPoint") ||
    ctor.includes("DocumentReference") ||
    ctor.includes("Bytes")
  ) {
    return true;
  }
  const anyV = v as Record<string, unknown>;
  if (typeof anyV.toMillis === "function" && typeof anyV.toDate === "function") return true;
  if (typeof anyV._methodName === "string") return true; // modular FieldValue sentinel
  return false;
}

/**
 * Recursively strips `undefined` / `NaN` / functions from an object graph.
 * Arrays keep their positions (undefined entries become `null` is avoided —
 * they are filtered out instead, which is what Firestore arrays expect).
 */
export function sanitizeFirestoreData<T>(input: T): T {
  return sanitizeValue(input) as T;
}

function sanitizeValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "number" && Number.isNaN(value)) return undefined;
  if (typeof value === "function") return undefined;
  if (isFirestoreNativeValue(value)) return value;

  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (const item of value) {
      const clean = sanitizeValue(item);
      if (clean !== undefined) out.push(clean);
    }
    return out;
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const clean = sanitizeValue(v);
      if (clean !== undefined) out[k] = clean;
    }
    return out;
  }

  return value;
}

/** Shallow helper for payloads that are already flat. */
export function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

/** Number coercion that never yields NaN/undefined. */
export function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

/** String coercion that never yields "undefined"/"null"/"[object Object]". */
export function str(v: unknown, fallback = ""): string {
  if (v === undefined || v === null) return fallback;
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return fallback;
}
