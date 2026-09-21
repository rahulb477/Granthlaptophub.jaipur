/**
 * GLOBAL SEQUENTIAL ORDER NUMBER — "GLTH0001", "GLTH0002", ...
 *
 * Rules implemented here:
 *  - GLTH prefix + zero-padded 4-digit sequence (grows past 9999 naturally).
 *  - NEVER random, NEVER derived from a Firebase document id, NEVER derived
 *    from `orders.length` / a count query on the frontend.
 *  - Reserved atomically inside a Firestore transaction on a single counter
 *    document (`settings/orderCounter`), so two simultaneous checkouts can
 *    never receive the same number.
 *  - Existing orders are NEVER renumbered. The counter is seeded once from
 *    the highest existing GLTH number found in Firestore.
 *
 * The customer website should import `reserveNextOrderNumber()` (or replicate
 * this exact transaction against the same counter document) when creating an
 * order, and store the result on the order document as `orderNumber`.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  runTransaction,
} from "firebase/firestore";
import { db } from "./firebase";

export const ORDER_NUMBER_PREFIX = "GLTH";
export const ORDER_NUMBER_PAD = 4;

/** Counter document shared by the Admin Panel and the customer website. */
export const ORDER_COUNTER_PATH = { collection: "settings", doc: "orderCounter" } as const;

/** 1 -> "GLTH0001". Values above 9999 simply grow: 12345 -> "GLTH12345". */
export function formatOrderNumber(seq: number): string {
  const n = Math.max(0, Math.floor(Number(seq) || 0));
  return `${ORDER_NUMBER_PREFIX}${String(n).padStart(ORDER_NUMBER_PAD, "0")}`;
}

/** "GLTH0042" -> 42. Returns 0 for anything that is not a GLTH number. */
export function parseOrderNumber(value: unknown): number {
  if (typeof value !== "string") return 0;
  const m = value.trim().toUpperCase().match(/^GLTH(\d+)$/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * The number an admin/customer should SEE for an order.
 * Falls back to the raw Firestore document id for legacy orders that were
 * created before this system existed (they are never rewritten silently).
 */
export function displayOrderNumber(order: {
  orderNumber?: unknown;
  orderNo?: unknown;
  id?: unknown;
}): string {
  const explicit =
    (typeof order?.orderNumber === "string" && order.orderNumber.trim()) ||
    (typeof order?.orderNo === "string" && order.orderNo.trim()) ||
    "";
  if (explicit) return explicit;
  const id = typeof order?.id === "string" ? order.id : "";
  return id ? `#${id.slice(0, 8).toUpperCase()}` : "—";
}

/** True when the value shown is a real sequential GLTH number. */
export function hasSequentialNumber(order: { orderNumber?: unknown; orderNo?: unknown }): boolean {
  return parseOrderNumber(order?.orderNumber) > 0 || parseOrderNumber(order?.orderNo) > 0;
}

/**
 * Scans existing orders ONCE to find the highest GLTH number already in use,
 * so a freshly created counter continues the sequence instead of restarting.
 * Requires admin read access; failures degrade to 0 (sequence starts at 1).
 */
export async function findHighestExistingOrderNumber(): Promise<number> {
  let highest = 0;
  const consider = (data: Record<string, unknown> | undefined) => {
    if (!data) return;
    highest = Math.max(highest, parseOrderNumber(data.orderNumber), parseOrderNumber(data.orderNo));
  };

  try {
    const rootSnap = await getDocs(collection(db, "orders"));
    rootSnap.forEach((d) => consider(d.data() as Record<string, unknown>));
  } catch {
    /* collection may not exist / not readable — ignore */
  }

  try {
    const usersSnap = await getDocs(collection(db, "users"));
    await Promise.all(
      usersSnap.docs.map(async (u) => {
        try {
          const os = await getDocs(collection(db, "users", u.id, "orders"));
          os.forEach((d) => consider(d.data() as Record<string, unknown>));
        } catch {
          /* per-user failure is non-fatal */
        }
      })
    );
  } catch {
    /* ignore */
  }

  return highest;
}

/**
 * Atomically reserves the next order number.
 *
 * Uses a Firestore transaction on `settings/orderCounter`. Concurrent callers
 * are serialised by Firestore itself, so duplicates are impossible.
 *
 * @param seedIfMissing highest existing number to continue from when the
 *        counter document does not exist yet (0 = start at GLTH0001).
 */
export async function reserveNextOrderNumber(seedIfMissing = 0): Promise<{
  orderNumber: string;
  sequence: number;
}> {
  const counterRef = doc(db, ORDER_COUNTER_PATH.collection, ORDER_COUNTER_PATH.doc);

  const sequence = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? Number(snap.data()?.lastNumber) || 0 : Number(seedIfMissing) || 0;
    const next = current + 1;
    tx.set(
      counterRef,
      {
        prefix: ORDER_NUMBER_PREFIX,
        pad: ORDER_NUMBER_PAD,
        lastNumber: next,
        lastOrderNumber: formatOrderNumber(next),
        updatedAt: Date.now(),
      },
      { merge: true }
    );
    return next;
  });

  return { orderNumber: formatOrderNumber(sequence), sequence };
}

/**
 * Safe wrapper used by the Admin Panel: seeds the counter from existing data
 * the first time it is used, then reserves atomically.
 */
export async function reserveNextOrderNumberSeeded(): Promise<{ orderNumber: string; sequence: number }> {
  const counterRef = doc(db, ORDER_COUNTER_PATH.collection, ORDER_COUNTER_PATH.doc);
  let seed = 0;
  try {
    const snap = await getDoc(counterRef);
    if (!snap.exists()) seed = await findHighestExistingOrderNumber();
  } catch {
    seed = 0;
  }
  return reserveNextOrderNumber(seed);
}

/** Reads the current counter state for the Admin Panel diagnostics UI. */
export async function getOrderCounterState(): Promise<{
  exists: boolean;
  lastNumber: number;
  lastOrderNumber: string;
  nextOrderNumber: string;
}> {
  const counterRef = doc(db, ORDER_COUNTER_PATH.collection, ORDER_COUNTER_PATH.doc);
  const snap = await getDoc(counterRef);
  const lastNumber = snap.exists() ? Number(snap.data()?.lastNumber) || 0 : 0;
  return {
    exists: snap.exists(),
    lastNumber,
    lastOrderNumber: lastNumber ? formatOrderNumber(lastNumber) : "—",
    nextOrderNumber: formatOrderNumber(lastNumber + 1),
  };
}
