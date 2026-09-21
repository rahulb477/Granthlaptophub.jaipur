/**
 * Review / Testimonial normalization layer.
 *
 * Review documents in this Firestore project were written by several different
 * customer-website builds and do NOT share one schema. The real document
 * inspected in production uses:
 *   { userId, userName, rating, title, comment, productId, status,
 *     featured, verifiedPurchase, createdAt, updatedAt }
 * while the Admin Panel previously assumed `customerName` / `text`, which is
 * why the Customer and Feedback columns rendered blank.
 *
 * Nothing here invents data: every value is read from the document, or from
 * the linked users/{uid} profile, or left empty.
 */
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "./firebase";

export interface NormalizedReview {
  id: string;
  /** Resolved display name (never fabricated — falls back to "Customer"). */
  customerName: string;
  /** True when the name came from the review/user doc rather than the fallback. */
  hasRealName: boolean;
  email: string;
  userId: string;
  rating: number;
  title: string;
  feedback: string;
  productId: string;
  productName: string;
  status: "approved" | "pending" | "hidden";
  featured: boolean;
  verifiedPurchase: boolean;
  createdAt: unknown;
  /** Original document, kept for debugging / future fields. */
  raw: Record<string, unknown>;
}

function s(v: unknown): string {
  if (typeof v === "string") {
    const t = v.trim();
    return t && t.toLowerCase() !== "undefined" && t.toLowerCase() !== "null" ? t : "";
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function firstString(src: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = s(src[k]);
    if (v) return v;
  }
  return "";
}

/** Normalises the many status/approval shapes into three canonical states. */
export function normalizeStatus(raw: Record<string, unknown>): "approved" | "pending" | "hidden" {
  const st = s(raw.status).toLowerCase();
  if (st === "approved" || st === "published" || st === "visible") return "approved";
  if (st === "hidden" || st === "rejected" || st === "spam") return "hidden";
  if (st === "pending" || st === "new") return "pending";
  // Legacy boolean flags
  if (raw.approved === true) return "approved";
  if (raw.approved === false) return "pending";
  if (raw.hidden === true) return "hidden";
  if (raw.visible === false) return "hidden";
  return "pending";
}

/**
 * Normalises one review document.
 * `userLookup` supplies names/emails already fetched from users/{uid}.
 */
export function normalizeReview(
  id: string,
  raw: Record<string, unknown>,
  userLookup?: Map<string, { name?: string; email?: string }>,
  productLookup?: Map<string, string>
): NormalizedReview {
  const userId = firstString(raw, ["userId", "customerId", "uid", "authorId"]);
  const profile = userId ? userLookup?.get(userId) : undefined;

  // Name priority: review.name → userName → displayName → users/{uid}.name → "Customer"
  const nameFromReview = firstString(raw, [
    "name",
    "userName",
    "username",
    "displayName",
    "customerName",
    "author",
    "authorName",
    "fullName",
  ]);
  const nameFromProfile = s(profile?.name);
  const resolvedName = nameFromReview || nameFromProfile;

  // Feedback priority: comment → review → feedback → text/message/body
  const feedback = firstString(raw, [
    "comment",
    "review",
    "feedback",
    "text",
    "message",
    "body",
    "content",
    "description",
  ]);

  const productId = firstString(raw, ["productId", "product", "itemId"]);
  const productName =
    firstString(raw, ["productName", "productTitle"]) ||
    (productId ? productLookup?.get(productId) ?? "" : "");

  const ratingRaw = raw.rating ?? raw.stars ?? raw.score;
  const rating = Math.max(0, Math.min(5, Number(ratingRaw) || 0));

  return {
    id,
    customerName: resolvedName || "Customer",
    hasRealName: !!resolvedName,
    email: firstString(raw, ["email", "userEmail", "customerEmail"]) || s(profile?.email),
    userId,
    rating,
    title: firstString(raw, ["title", "headline", "subject"]),
    feedback,
    productId,
    productName,
    status: normalizeStatus(raw),
    featured: raw.featured === true || raw.isFeatured === true || raw.pinned === true,
    verifiedPurchase:
      raw.verifiedPurchase === true || raw.verified === true || raw.isVerifiedPurchase === true,
    createdAt: raw.createdAt ?? raw.date ?? raw.createdAtMs ?? null,
    raw,
  };
}

/**
 * Loads all reviews and resolves customer names/emails from users/{uid} and
 * product names from products/{id}. Lookup failures are non-fatal — the review
 * still renders with whatever the document itself contains.
 */
export async function getNormalizedReviews(): Promise<{
  reviews: NormalizedReview[];
  lookupWarning: string;
}> {
  const snap = await getDocs(collection(db, "reviews"));
  const rawRows = snap.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, unknown> }));

  // Collect the ids we need to resolve.
  const userIds = new Set<string>();
  const productIds = new Set<string>();
  for (const r of rawRows) {
    const uid = firstString(r.data, ["userId", "customerId", "uid", "authorId"]);
    const hasName = firstString(r.data, ["name", "userName", "username", "displayName", "customerName"]);
    if (uid && !hasName) userIds.add(uid);
    const pid = firstString(r.data, ["productId", "product", "itemId"]);
    const hasProductName = firstString(r.data, ["productName", "productTitle"]);
    if (pid && !hasProductName) productIds.add(pid);
  }

  const userLookup = new Map<string, { name?: string; email?: string }>();
  const productLookup = new Map<string, string>();
  let lookupWarning = "";

  // users/{uid} is admin-readable only; a denial must not break the page.
  await Promise.all(
    [...userIds].map(async (uid) => {
      try {
        const u = await getDoc(doc(db, "users", uid));
        if (u.exists()) {
          const d = u.data() as Record<string, unknown>;
          userLookup.set(uid, {
            name: s(d.name) || s(d.displayName) || s(d.fullName),
            email: s(d.email),
          });
        }
      } catch {
        lookupWarning =
          "Some reviewer names could not be resolved from /users (admin permission required). The review's own stored name is shown instead.";
      }
    })
  );

  await Promise.all(
    [...productIds].map(async (pid) => {
      try {
        const p = await getDoc(doc(db, "products", pid));
        if (p.exists()) productLookup.set(pid, s((p.data() as Record<string, unknown>).name));
      } catch {
        /* products are public-readable; ignore */
      }
    })
  );

  const reviews = rawRows.map((r) => normalizeReview(r.id, r.data, userLookup, productLookup));
  return { reviews, lookupWarning };
}
