import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  serverTimestamp,
  onSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import { sanitizeFirestoreData, num, str } from "./firestore-sanitize";
import {
  buildSpecPayload,
  normalizeOptions,
  readHardwareSpecs,
  type ProductOption,
} from "./product-specs";
import { logAdminAction } from "./activity";

export interface FirestoreProduct {
  id?: string;
  name: string;
  brand: string;
  price: number;
  originalPrice?: number;
  discount?: string;
  section?: "bestSellers" | "trending" | "spotlight" | "catalog" | "";
  spotlight?: boolean;
  featured?: boolean;
  tag?: string;
  tagColor?: string;
  rating?: number;
  reviews?: number;
  specs?: string[];
  /* ---- hardware specifications (canonical names) ---- */
  processor?: string;
  generation?: string;
  screenSize?: string;
  ram?: string;
  storage?: string;
  graphics?: string;
  touch?: boolean;
  operatingSystem?: string;
  /* ---- legacy mirrors kept in sync on every write ---- */
  os?: string;
  screen?: string;
  gen?: string;
  gpu?: string;
  touchscreen?: boolean;
  specSheet?: { label: string; value: string }[];
  /* ---- per-product configurable price options ---- */
  ramOptions?: ProductOption[];
  storageOptions?: ProductOption[];
  warrantyOptions?: ProductOption[];
  /* ---- taxonomy & identifiers ---- */
  category?: string;
  /** Legacy mirror of the category name kept in sync on write. */
  categoryName?: string;
  /** Optional reference to the categories/{id} document. */
  categoryId?: string;
  sku?: string;
  /** URL-safe slug used by the customer website — never the document id. */
  slug?: string;
  condition?: "new" | "refurbished" | "open box";
  warranty?: string;
  returnPolicy?: string;
  description?: string;
  image: string; // primary image URL (ImgBB-hosted)
  images?: string[]; // all gallery images (ImgBB-hosted)
  stock?: number;
  status?: "published" | "draft" | "archived";
  numericId?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface FirestoreCategory {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  icon?: string;
  displayOrder?: number;
  active?: boolean;
  featured?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface FirestoreBrand {
  id?: string;
  name: string;
  slug?: string;
  logo?: string;
  description?: string;
  displayOrder?: number;
  active?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface FirestoreBlogPost {
  id?: string;
  title: string;
  slug?: string;
  category?: string;
  categoryColor?: string;
  excerpt?: string;
  body?: string[] | string;
  date?: string;
  gradient?: string;
  image?: string;
  published?: boolean;
  tags?: string[];
  createdAt?: any;
  updatedAt?: any;
}

export interface FirestoreVideo {
  id?: string;
  title: string;
  description?: string;
  /** Canonical Instagram Reel link, e.g. https://www.instagram.com/reel/XXXX/ (links only — never file uploads). */
  url?: string;
  /** Legacy mirrors kept so older customer-site builds keep working. */
  videoUrl?: string;
  youtubeUrl?: string;
  platform?: "instagram" | "youtube" | string;
  thumbnail?: string; // ImgBB-hosted thumbnail URL
  category?: string;
  displayOrder?: number;
  active?: boolean;
  published?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface FirestoreOffer {
  id?: string;
  title: string;
  name?: string;
  badge?: string;
  description?: string;
  discount?: string;
  image?: string;
  banner?: string;
  appliesTo?: string;
  validUntil?: string;
  startDate?: any;
  endDate?: any;
  active?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface FirestoreCoupon {
  id?: string; // usually coupon code in uppercase, e.g. "KARNI5"
  code: string;
  discountType?: "percent" | "flat";
  discountValue?: number;
  minOrder?: number;
  maxDiscount?: number;
  description?: string;
  active?: boolean;
  expiresAt?: number;
  usageLimit?: number;
  usedCount?: number;
  createdAt?: any;
}

export interface FirestoreReview {
  id?: string;
  productId: string;
  productName?: string;
  customerName: string;
  rating: number;
  text: string;
  status: "approved" | "pending" | "hidden";
  featured?: boolean;
  createdAt?: any;
}

/* ================= PRODUCTS CRUD ================= */
export async function getProducts(options?: {
  section?: string;
  spotlight?: boolean;
  status?: string;
}) {
  const colRef = collection(db, "products");
  let q = query(colRef);

  if (options?.section) {
    q = query(colRef, where("section", "==", options.section));
  } else if (options?.spotlight) {
    q = query(colRef, where("spotlight", "==", true));
  }

  const snap = await getDocs(q);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreProduct));

  if (options?.status) {
    return items.filter((p) => (p.status || "published") === options.status);
  }
  return items;
}

export async function getProduct(id: string) {
  const docRef = doc(db, "products", id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as FirestoreProduct;
}

/**
 * Creates or MERGE-updates a product.
 *
 * Critical fixes vs. the previous implementation:
 *  - Never writes `undefined` (all payloads pass through sanitizeFirestoreData),
 *    which was the source of:
 *      "Unsupported field value: undefined (found in field discount ...)"
 *  - Partial updates (e.g. `{ spotlight: true }` from the Homepage CMS) no
 *    longer clobber images/specs/discount of an existing product: derived
 *    fields are only rebuilt when their source fields are actually supplied.
 *  - Hardware specs are written under canonical names AND legacy mirrors so
 *    the customer website resolves Screen Size / Generation / Graphics.
 *  - RAM / Storage / Warranty options are normalised (value, priceAdjustment,
 *    active, stock) — no hardcoded price deltas anywhere.
 */
export async function saveProduct(data: Partial<FirestoreProduct>, id?: string) {
  const colRef = collection(db, "products");
  const docRef = id ? doc(db, "products", id) : doc(colRef);

  const isCreate = !id;
  const has = (k: keyof FirestoreProduct) => Object.prototype.hasOwnProperty.call(data, k);

  const payload: Record<string, unknown> = { ...data };

  /* ---------- pricing / discount ---------- */
  if (has("price")) payload.price = num(data.price);
  if (has("originalPrice")) payload.originalPrice = num(data.originalPrice, num(data.price));

  const priceKnown = has("price") || has("originalPrice");
  if (priceKnown) {
    const price = num(data.price);
    const original = num(data.originalPrice);
    const supplied = str(data.discount);
    if (supplied) {
      payload.discount = supplied;
    } else if (original > 0 && price > 0 && original > price) {
      payload.discount = `${Math.round(((original - price) / original) * 100)}% off`;
    } else if (isCreate) {
      payload.discount = ""; // never undefined
    } else {
      delete payload.discount; // leave the stored value untouched
    }
  } else if (has("discount")) {
    payload.discount = str(data.discount);
  } else {
    delete payload.discount;
  }

  /* ---------- images (only touched when supplied) ---------- */
  if (has("images") || has("image")) {
    const images = Array.isArray(data.images)
      ? data.images.filter((u): u is string => !!u)
      : data.image
      ? [data.image]
      : [];
    const primary = images[0] || str(data.image);
    if (images.length > 0) payload.images = images;
    if (primary) payload.image = primary;
    else if (isCreate) {
      payload.images = [];
      payload.image = "";
    }
  }

  /* ---------- hardware specifications + legacy mirrors ---------- */
  const specKeys: (keyof FirestoreProduct)[] = [
    "processor", "generation", "screenSize", "ram", "storage",
    "graphics", "touch", "operatingSystem", "os", "screen", "gen", "gpu",
  ];
  if (specKeys.some(has)) {
    Object.assign(payload, buildSpecPayload(readHardwareSpecs(data as Record<string, unknown>)));
    // An explicitly supplied specs array always wins.
    if (Array.isArray(data.specs) && data.specs.length > 0) payload.specs = data.specs;
  } else if (Array.isArray(data.specs)) {
    payload.specs = data.specs;
  } else {
    delete payload.specs;
  }

  /* ---------- configurable options ---------- */
  if (has("ramOptions")) payload.ramOptions = normalizeOptions(data.ramOptions);
  if (has("storageOptions")) payload.storageOptions = normalizeOptions(data.storageOptions);
  if (has("warrantyOptions")) payload.warrantyOptions = normalizeOptions(data.warrantyOptions);

  payload.updatedAt = serverTimestamp();

  if (isCreate) {
    payload.createdAt = serverTimestamp();
    payload.createdAtMs = Date.now();
    payload.numericId = num(data.numericId, Date.now() % 1000000);
    if (payload.status === undefined) payload.status = "published";
    if (payload.stock === undefined) payload.stock = 0;
    if (payload.ramOptions === undefined) payload.ramOptions = [];
    if (payload.storageOptions === undefined) payload.storageOptions = [];
    if (payload.warrantyOptions === undefined) payload.warrantyOptions = [];
  }

  const clean = sanitizeFirestoreData(payload);
  await setDoc(docRef, clean as Record<string, unknown>, { merge: true });
  return { id: docRef.id, ...(clean as Record<string, unknown>) } as FirestoreProduct & { id: string };
}

export async function deleteProduct(id: string) {
  await deleteDoc(doc(db, "products", id));
}

/* ================= CATEGORIES CRUD ================= */
export async function getCategories() {
  const colRef = collection(db, "categories");
  const snap = await getDocs(colRef);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreCategory));
  return items.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}

export async function saveCategory(data: Partial<FirestoreCategory>, id?: string) {
  const colRef = collection(db, "categories");
  const docRef = id ? doc(db, "categories", id) : doc(colRef);
  const payload = {
    ...data,
    updatedAt: serverTimestamp(),
    createdAt: data.createdAt || serverTimestamp(),
  };
  await setDoc(docRef, sanitizeFirestoreData(payload) as Record<string, unknown>, { merge: true });
  return { id: docRef.id, ...payload };
}

export async function deleteCategory(id: string) {
  await deleteDoc(doc(db, "categories", id));
}

/* ================= BRANDS CRUD ================= */
export async function getBrands() {
  const colRef = collection(db, "brands");
  const snap = await getDocs(colRef);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreBrand));
  return items.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}

export async function saveBrand(data: Partial<FirestoreBrand>, id?: string) {
  const colRef = collection(db, "brands");
  const docRef = id ? doc(db, "brands", id) : doc(colRef);
  const payload = {
    ...data,
    updatedAt: serverTimestamp(),
    createdAt: data.createdAt || serverTimestamp(),
  };
  await setDoc(docRef, sanitizeFirestoreData(payload) as Record<string, unknown>, { merge: true });
  return { id: docRef.id, ...payload };
}

export async function deleteBrand(id: string) {
  await deleteDoc(doc(db, "brands", id));
}

/* ================= BLOG POSTS CRUD ================= */
export async function getBlogPosts() {
  const colRef = collection(db, "blogPosts");
  const snap = await getDocs(colRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreBlogPost));
}

export async function saveBlogPost(data: Partial<FirestoreBlogPost>, id?: string) {
  const colRef = collection(db, "blogPosts");
  const docRef = id ? doc(db, "blogPosts", id) : doc(colRef);
  const payload = {
    ...data,
    updatedAt: serverTimestamp(),
    createdAt: data.createdAt || serverTimestamp(),
  };
  await setDoc(docRef, sanitizeFirestoreData(payload) as Record<string, unknown>, { merge: true });
  return { id: docRef.id, ...payload };
}

export async function deleteBlogPost(id: string) {
  await deleteDoc(doc(db, "blogPosts", id));
}

/* ================= VIDEOS CRUD ================= */
export async function getVideos() {
  const colRef = collection(db, "videos");
  const snap = await getDocs(colRef);
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreVideo));
  return items.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}

export async function saveVideo(data: Partial<FirestoreVideo>, id?: string) {
  const colRef = collection(db, "videos");
  const docRef = id ? doc(db, "videos", id) : doc(colRef);
  // Canonical Instagram Reel link; mirror to legacy fields so any
  // customer-site build reading videoUrl/youtubeUrl keeps working.
  const url = (data.url || data.videoUrl || data.youtubeUrl || "").trim();
  const payload = {
    ...data,
    url,
    videoUrl: url,
    platform: data.platform || "instagram",
    active: data.active !== false && data.published !== false,
    published: data.published !== false && data.active !== false,
    updatedAt: serverTimestamp(),
    createdAt: data.createdAt || serverTimestamp(),
  };
  await setDoc(docRef, sanitizeFirestoreData(payload) as Record<string, unknown>, { merge: true });
  return { id: docRef.id, ...payload };
}

export async function deleteVideo(id: string) {
  await deleteDoc(doc(db, "videos", id));
}

/* ================= OFFERS CRUD ================= */
export async function getOffers() {
  const colRef = collection(db, "offers");
  const snap = await getDocs(colRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreOffer));
}

export async function saveOffer(data: Partial<FirestoreOffer>, id?: string) {
  const colRef = collection(db, "offers");
  const docRef = id ? doc(db, "offers", id) : doc(colRef);
  const payload = {
    ...data,
    updatedAt: serverTimestamp(),
    createdAt: data.createdAt || serverTimestamp(),
  };
  await setDoc(docRef, sanitizeFirestoreData(payload) as Record<string, unknown>, { merge: true });
  return { id: docRef.id, ...payload };
}

export async function deleteOffer(id: string) {
  await deleteDoc(doc(db, "offers", id));
}

/* ================= COUPONS CRUD ================= */
export async function getCoupons() {
  const colRef = collection(db, "coupons");
  const snap = await getDocs(colRef);
  return snap.docs.map((d) => ({ id: d.id, code: d.id, ...d.data() } as FirestoreCoupon));
}

export async function saveCoupon(data: Partial<FirestoreCoupon>) {
  const code = (data.code || "").trim().toUpperCase();
  if (!code) throw new Error("Coupon code is required");

  const docRef = doc(db, "coupons", code);
  const payload = {
    ...data,
    code,
    active: data.active !== false,
    minOrder: Number(data.minOrder) || 0,
    expiresAt: data.expiresAt || null,
    updatedAt: serverTimestamp(),
  };
  await setDoc(docRef, sanitizeFirestoreData(payload) as Record<string, unknown>, { merge: true });
  return { id: code, ...payload };
}

export async function deleteCoupon(code: string) {
  await deleteDoc(doc(db, "coupons", code.trim().toUpperCase()));
}

/* ================= REVIEWS CRUD ================= */
export async function getReviews() {
  const colRef = collection(db, "reviews");
  const snap = await getDocs(colRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreReview));
}

export async function updateReviewStatus(id: string, status: "approved" | "pending" | "hidden", featured?: boolean) {
  const docRef = doc(db, "reviews", id);
  const patch: any = { status };
  if (featured !== undefined) patch.featured = featured;
  await updateDoc(docRef, patch);
}

export async function deleteReview(id: string) {
  await deleteDoc(doc(db, "reviews", id));
}

/* ================= SITE SETTINGS & HOMEPAGE ================= */
export async function getDocData<T = any>(col: string, docId: string): Promise<T | null> {
  const docRef = doc(db, col, docId);
  const snap = await getDoc(docRef);
  return snap.exists() ? (snap.data() as T) : null;
}

export async function setDocData(col: string, docId: string, data: any): Promise<void> {
  const docRef = doc(db, col, docId);
  // sanitizeFirestoreData strips every `undefined` before the write — this is
  // what prevents "Unsupported field value: undefined" on CMS/settings saves.
  const payload = sanitizeFirestoreData({ ...data, updatedAt: serverTimestamp() });
  await setDoc(docRef, payload as Record<string, unknown>, { merge: true });
}

/* ================= USERS & ORDERS ================= */
export interface UserOrder {
  id: string;
  /** Sequential customer/admin-facing number, e.g. "GLTH0001". */
  orderNumber?: string;
  /** Legacy mirror written by some customer-site builds. */
  orderNo?: string;
  userId: string;
  customerName: string;
  phone: string;
  email?: string;
  address: any;
  items: any[];
  subtotal: number;
  couponCode?: string;
  couponDiscount?: number;
  rewardCode?: string;
  rewardDiscount?: number;
  total: number;
  paymentMethod: string;
  status: string;
  createdAt: any;
  cancellationReason?: string;
  cancellationNote?: string;
  /** Where the document was read from — used to avoid double counting. */
  _source?: "subcollection" | "root";
}

/**
 * Reads EVERY real order exactly once.
 *
 * Source of truth = `users/{uid}/orders/{orderId}` (written by the customer
 * website checkout). A root `orders/{orderId}` mirror also exists for some
 * orders; those are merged in ONLY when the same logical order was not
 * already collected, so analytics never double counts.
 *
 * De-duplication key: orderNumber when present, otherwise the document id.
 */
export async function getAllCustomerOrders(): Promise<UserOrder[]> {
  const collected = new Map<string, UserOrder>();

  /**
   * Identity for de-duplication, in priority order:
   *   1. orderNumber / orderNo  (canonical once checkout writes GLTH numbers)
   *   2. document id
   * The same logical order stored in BOTH users/{uid}/orders and orders/{id}
   * is therefore counted exactly once.
   */
  const keyOf = (o: Partial<UserOrder> & { id: string }) => {
    const num =
      (typeof o.orderNumber === "string" && o.orderNumber.trim().toUpperCase()) ||
      (typeof o.orderNo === "string" && o.orderNo.trim().toUpperCase()) ||
      "";
    return num ? `num:${num}` : `doc:${o.id}`;
  };

  /**
   * Secondary safety net for legacy orders that have NO orderNumber and were
   * copied to the root collection under a different document id: same user +
   * same creation second + same total is treated as the same order.
   */
  const fingerprintOf = (o: UserOrder) =>
    `${o.userId || ""}|${Math.floor(orderMillis(o) / 1000)}|${orderTotal(o as any)}`;
  const fingerprints = new Set<string>();

  let usersError: unknown = null;

  // 1) users/{uid}/orders — primary source
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    await Promise.all(
      usersSnap.docs.map(async (uDoc) => {
        try {
          const ordersSnap = await getDocs(collection(db, "users", uDoc.id, "orders"));
          ordersSnap.docs.forEach((oDoc) => {
            const order = {
              id: oDoc.id,
              userId: uDoc.id,
              ...(oDoc.data() as Record<string, unknown>),
              _source: "subcollection" as const,
            } as UserOrder;
            collected.set(keyOf(order), order);
            fingerprints.add(fingerprintOf(order));
          });
        } catch (e) {
          console.warn(`[orders] could not read users/${uDoc.id}/orders:`, e);
        }
      })
    );
  } catch (e) {
    usersError = e;
    console.warn("[orders] could not list /users (admin permission required):", e);
  }

  // 2) root orders — merged only when not already present
  try {
    const rootOrders = await getDocs(collection(db, "orders"));
    rootOrders.docs.forEach((ro) => {
      const data = ro.data() as Record<string, unknown>;
      const order = {
        id: ro.id,
        userId: (data.userId as string) || "",
        ...data,
        _source: "root" as const,
      } as UserOrder;
      const key = keyOf(order);
      // Skip when already collected by number/id, or when an identical
      // user+timestamp+total order was already seen in a subcollection.
      if (collected.has(key)) return;
      if (order.userId && fingerprints.has(fingerprintOf(order))) return;
      collected.set(key, order);
      fingerprints.add(fingerprintOf(order));
    });
  } catch (e) {
    if (usersError) {
      // Both sources failed — surface a clear permission error instead of
      // silently returning an empty list that looks like "zero orders".
      throw new Error(
        "Could not read orders from Firestore. Sign in as an admin — reading /users and /orders requires admin permissions."
      );
    }
    console.warn("[orders] root /orders unavailable:", e);
  }

  return [...collected.values()].sort((a, b) => orderMillis(b) - orderMillis(a));
}

/**
 * Normalises ANY Firestore date shape to milliseconds without crashing:
 *   Firestore Timestamp | {seconds,nanoseconds} | number (ms or seconds)
 *   | ISO string | Date | null.
 * Returns 0 when the value is absent or unparseable.
 */
export function toMillis(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return 0;
    // Values below ~1e11 are almost certainly seconds, not milliseconds.
    return v > 0 && v < 1e11 ? v * 1000 : v;
  }
  if (v instanceof Date) {
    const t = v.getTime();
    return Number.isFinite(t) ? t : 0;
  }
  if (typeof v === "object") {
    if (typeof v.toMillis === "function") {
      try { return v.toMillis(); } catch { return 0; }
    }
    if (typeof v.toDate === "function") {
      try { return v.toDate().getTime(); } catch { return 0; }
    }
    if (typeof v.seconds === "number") return v.seconds * 1000;
    if (typeof v._seconds === "number") return v._seconds * 1000;
    return 0;
  }
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n) && v.trim() !== "") return n > 0 && n < 1e11 ? n * 1000 : n;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

/** Normalised creation time in ms for any order shape. */
export function orderMillis(o: { createdAt?: any; createdAtMs?: any }): number {
  return toMillis((o as any)?.createdAtMs) || toMillis(o?.createdAt);
}

/** Order total that tolerates every field name used historically. */
export function orderTotal(o: Record<string, any>): number {
  return num(o?.total ?? o?.totalAmount ?? o?.grandTotal ?? o?.amount ?? o?.payableAmount ?? 0);
}

export async function updateCustomerOrderStatus(userId: string, orderId: string, status: string) {
  const patch = { status, updatedAt: serverTimestamp(), statusUpdatedAtMs: Date.now() };
  let ok = false;
  let lastError: unknown = null;

  if (userId) {
    try {
      await updateDoc(doc(db, "users", userId, "orders", orderId), patch);
      ok = true;
    } catch (e) {
      lastError = e;
      console.warn("[orders] subcollection status update failed:", e);
    }
  }

  // Keep the root mirror in sync when it exists.
  try {
    await updateDoc(doc(db, "orders", orderId), patch);
    ok = true;
  } catch (e) {
    lastError = lastError ?? e;
  }

  if (!ok) {
    throw new Error(
      `Could not update order status. ${(lastError as any)?.message || "Check admin permissions in firestore.rules."}`
    );
  }
}

export interface FirestoreCustomer {
  id: string;
  name?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  photoURL?: string;
  role?: string;
  createdAt?: any;
  createdAtMs?: number;
  lastLoginAt?: any;
  lastActiveAt?: any;
  [key: string]: any;
}

/**
 * Lists registered customers from /users.
 * Requires admin permissions (`allow list: if isAdmin()` in firestore.rules);
 * a permission failure is rethrown with an actionable message rather than
 * silently returning an empty array.
 * Passwords are never stored in Firestore and are never read here.
 */
export async function getAllCustomers(): Promise<FirestoreCustomer[]> {
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    return usersSnap.docs.map((d) => {
      const data = d.data() as Record<string, any>;
      // Defensive: never surface anything password-like to the UI.
      delete data.password;
      delete data.passwordHash;
      delete data.pin;
      return { id: d.id, ...data } as FirestoreCustomer;
    });
  } catch (e: any) {
    if (String(e?.code || "").includes("permission-denied")) {
      throw new Error(
        "Missing permissions to list customers. The signed-in account must be an admin (adminUsers/{uid} with active == true) and firestore.rules must allow `list` on /users for admins."
      );
    }
    throw e;
  }
}

export interface CustomerDetail {
  profile: FirestoreCustomer;
  addresses: any[];
  orders: UserOrder[];
  rewards: any[];
  couponUsage: any[];
  totalOrders: number;
  totalSpent: number;
  errors: string[];
}

/**
 * Full customer profile for the Admin Panel drawer.
 * Reads users/{uid} plus the addresses / orders / rewards / couponUsage
 * subcollections. Each subcollection failure is captured (not thrown) so a
 * partially-readable customer still renders.
 */
export async function getCustomerDetail(uid: string): Promise<CustomerDetail> {
  const errors: string[] = [];
  const sub = async (name: string) => {
    try {
      const snap = await getDocs(collection(db, "users", uid, name));
      return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }));
    } catch (e: any) {
      errors.push(`${name}: ${e?.message || "unreadable"}`);
      return [];
    }
  };

  let profile: FirestoreCustomer = { id: uid };
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const data = snap.data() as Record<string, any>;
      // Never surface credentials. Firebase Auth passwords are not stored in
      // Firestore and are never requested anywhere in this project.
      delete data.password;
      delete data.passwordHash;
      delete data.pin;
      delete data.otp;
      profile = { id: uid, ...data };
    }
  } catch (e: any) {
    errors.push(`profile: ${e?.message || "unreadable"}`);
  }

  const [addresses, rawOrders, rewards, couponUsage] = await Promise.all([
    sub("addresses"),
    sub("orders"),
    sub("rewards"),
    sub("couponUsage"),
  ]);

  const orders = (rawOrders as any[])
    .map((o) => ({ ...o, userId: uid, _source: "subcollection" as const } as UserOrder))
    .sort((a, b) => orderMillis(b) - orderMillis(a));

  const totalSpent = orders
    .filter((o) => String(o.status || "").toLowerCase() !== "cancelled")
    .reduce((sum, o) => sum + orderTotal(o as Record<string, any>), 0);

  return {
    profile,
    addresses,
    orders,
    rewards,
    couponUsage,
    totalOrders: orders.length,
    totalSpent,
    errors,
  };
}

/* ================= ENQUIRIES (shared with customer website) ================= */
export interface FirestoreEnquiry {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  productId?: string;
  productName?: string;
  message?: string;
  source?: string;
  status?: "new" | "contacted" | "interested" | "converted" | "closed";
  createdAt?: any;
  updatedAt?: any;
}

export async function getEnquiries() {
  const snap = await getDocs(collection(db, "enquiries"));
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreEnquiry));
  return items.sort((a, b) => {
    const ta = (a.createdAt as any)?.toMillis?.() ?? 0;
    const tb = (b.createdAt as any)?.toMillis?.() ?? 0;
    return tb - ta;
  });
}

export async function saveEnquiry(data: Partial<FirestoreEnquiry>, id?: string) {
  const docRef = id ? doc(db, "enquiries", id) : doc(collection(db, "enquiries"));
  const payload: any = {
    ...data,
    status: data.status || "new",
    updatedAt: serverTimestamp(),
  };
  if (!id) payload.createdAt = serverTimestamp();
  await setDoc(docRef, sanitizeFirestoreData(payload) as Record<string, unknown>, { merge: true });
  return { id: docRef.id, ...payload };
}

export async function updateEnquiryStatus(id: string, status: string) {
  await updateDoc(doc(db, "enquiries", id), { status, updatedAt: serverTimestamp() });
}

export async function deleteEnquiry(id: string) {
  await deleteDoc(doc(db, "enquiries", id));
}

/* ================= ADMIN USERS (Firestore — same project as site) ================= */
export interface FirestoreAdminUser {
  id?: string;
  name: string;
  email: string;
  role: "superadmin" | "admin" | "staff";
  active?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export async function getAdminUsers() {
  const snap = await getDocs(collection(db, "adminUsers"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreAdminUser));
}

/**
 * NOTE: adminUsers documents are NEVER written from the browser.
 *
 * Creating/updating/deleting an administrator requires Firebase Admin SDK
 * privileges (it must also create the Firebase Authentication account), so it
 * is handled exclusively by the secure server endpoints:
 *   POST   /api/admin/create-user
 *   POST   /api/admin/update-user
 *   DELETE /api/admin/update-user
 *   POST   /api/admin/reset-password
 * Firestore rules deny client writes to /adminUsers for exactly this reason.
 * The previous client-side saveAdminUser()/deleteAdminUser() helpers were
 * removed so no future code can accidentally reintroduce a blocked write.
 */

/* ================= ACTIVITY LOG (Firestore) ================= */
export interface FirestoreActivity {
  id?: string;
  adminId?: string;
  adminUid?: string;
  adminName?: string;
  adminEmail?: string;
  description?: string;
  createdAtMs?: number;
  changes?: any;
  action: string;
  entity: string;
  entityId?: string;
  summary?: string;
  diff?: any;
  createdAt?: any;
}

/**
 * Backwards-compatible activity logger. Existing call sites keep working; the
 * write itself is delegated to logAdminAction() so every entry gets the
 * authenticated admin uid/email, a normalised action and createdAtMs.
 * Never throws.
 */
export async function logActivity(entry: Omit<FirestoreActivity, "id" | "createdAt">) {
  await logAdminAction({
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    description: entry.summary || `${entry.action} ${entry.entity}`,
    changes: entry.diff,
  });
}

export async function getActivityLog(limitCount = 200) {
  try {
    const snap = await getDocs(
      query(collection(db, "activityLog"), orderBy("createdAt", "desc"), limit(limitCount))
    );
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as FirestoreActivity));
  } catch {
    // Entries whose serverTimestamp() has not resolved yet are skipped by an
    // orderBy("createdAt") query — fall back to an unordered read sorted on
    // the client using the numeric createdAtMs mirror.
    const snap = await getDocs(collection(db, "activityLog"));
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() } as FirestoreActivity))
      .sort((a: any, b: any) => (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0))
      .slice(0, limitCount);
  }
}

/* ================= APPEARANCE + SEO (live customer-site config) ================= */
export async function getAppearance() {
  return (await getDocData<any>("siteSettings", "appearance")) ?? null;
}
export async function saveAppearance(data: any) {
  return setDocData("siteSettings", "appearance", data);
}
export async function getSeoSettings() {
  return (await getDocData<any>("siteSettings", "seo")) ?? null;
}
/** Writes the canonical SEO schema (legacy names normalised, no undefined). */
export async function saveSeoSettings(data: any) {
  const { normalizeSeo } = await import("./seo-settings");
  return setDocData("siteSettings", "seo", normalizeSeo(data));
}

/* ================= REALTIME LISTENERS (live sync with user website) ================= */
export function subscribeCollection(col: string, cb: (rows: any[]) => void, onError?: (e: any) => void) {
  try {
    return onSnapshot(
      collection(db, col),
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => {
        console.error(`Firestore subscribe ${col} error:`, e);
        onError?.(e);
      }
    );
  } catch (e) {
    console.error(`Firestore subscribe ${col} failed:`, e);
    onError?.(e);
    return () => {};
  }
}

export function subscribeDoc(col: string, docId: string, cb: (data: any | null) => void, onError?: (e: any) => void) {
  try {
    return onSnapshot(
      doc(db, col, docId),
      (snap) => cb(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      (e) => {
        console.error(`Firestore subscribe ${col}/${docId} error:`, e);
        onError?.(e);
      }
    );
  } catch (e) {
    console.error(`Firestore subscribe ${col}/${docId} failed:`, e);
    onError?.(e);
    return () => {};
  }
}

/* ================= MEDIA LIBRARY (ImgBB URLs catalogued in Firestore) ================= */


/* ================= FIRST ORDER SCRATCH REWARD (admin configurable) ================= */
/**
 * Canonical document: siteSettings/firstOrderReward
 *
 *   { enabled, rewardType, discountAmount, discountPercent, maxDiscount,
 *     minOrderValue, couponCode, uniqueCode, title, message, buttonText,
 *     firstOrderOnly, expiryDays }
 *
 * Legacy field names written by earlier builds are accepted on READ and
 * normalised into the canonical shape, so the currently-configured reward
 * (15% / max ₹5,000 / min ₹7,000 / FIRST15) is never reset.
 * On WRITE the canonical names are used, plus legacy mirrors so any older
 * reader keeps working. Nothing is ever written as `undefined`.
 */
export interface FirstOrderRewardSettings {
  enabled: boolean;
  rewardType: "fixed" | "percentage";
  /** Flat rupee discount used when rewardType === "fixed". */
  discountAmount: number;
  /** Percentage used when rewardType === "percentage". */
  discountPercent: number;
  maxDiscount: number;
  minOrderValue: number;
  couponCode: string;
  /** When true, a unique per-customer code is generated using couponCode as prefix. */
  uniqueCode: boolean;
  title: string;
  message: string;
  buttonText: string;
  firstOrderOnly: boolean;
  /** Validity of the unlocked reward in days (0 = never expires). */
  expiryDays: number;
  updatedAt?: any;
}

export const FIRST_ORDER_REWARD_DEFAULTS: FirstOrderRewardSettings = {
  enabled: true,
  rewardType: "fixed",
  discountAmount: 199,
  discountPercent: 10,
  maxDiscount: 500,
  minOrderValue: 0,
  couponCode: "FIRST199",
  uniqueCode: false,
  title: "Congratulations!",
  message: "You unlocked a special first-order discount.",
  buttonText: "Apply Reward",
  firstOrderOnly: true,
  expiryDays: 30,
};

/** Accepts canonical OR legacy field names and returns the canonical shape. */
export function normalizeFirstOrderReward(raw: Record<string, any> | null | undefined): FirstOrderRewardSettings {
  const d = raw ?? {};
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      if (d[k] !== undefined && d[k] !== null && d[k] !== "") return d[k];
    }
    return undefined;
  };
  const rewardTypeRaw = String(pick("rewardType", "type") ?? FIRST_ORDER_REWARD_DEFAULTS.rewardType).toLowerCase();
  const rewardType: "fixed" | "percentage" =
    rewardTypeRaw.startsWith("perc") || rewardTypeRaw === "%" ? "percentage" : "fixed";

  return {
    enabled: pick("enabled", "active") === undefined ? FIRST_ORDER_REWARD_DEFAULTS.enabled : pick("enabled", "active") !== false,
    rewardType,
    // legacy: fixedAmount / amount / rewardAmount
    discountAmount: num(pick("discountAmount", "fixedAmount", "amount", "rewardAmount"), FIRST_ORDER_REWARD_DEFAULTS.discountAmount),
    // legacy: percentage / percent
    discountPercent: num(pick("discountPercent", "percentage", "percent"), FIRST_ORDER_REWARD_DEFAULTS.discountPercent),
    maxDiscount: num(pick("maxDiscount", "maximumDiscount", "cap"), FIRST_ORDER_REWARD_DEFAULTS.maxDiscount),
    minOrderValue: num(pick("minOrderValue", "minOrder", "minimumOrder"), 0),
    couponCode: String(pick("couponCode", "code", "couponPrefix") ?? FIRST_ORDER_REWARD_DEFAULTS.couponCode).toUpperCase().trim(),
    // legacy: generateUniqueCode
    uniqueCode: pick("uniqueCode", "generateUniqueCode") === true,
    title: str(pick("title", "heading"), FIRST_ORDER_REWARD_DEFAULTS.title),
    message: str(pick("message", "subtitle", "description"), FIRST_ORDER_REWARD_DEFAULTS.message),
    buttonText: str(pick("buttonText", "ctaText"), FIRST_ORDER_REWARD_DEFAULTS.buttonText),
    firstOrderOnly: pick("firstOrderOnly") === undefined ? true : pick("firstOrderOnly") !== false,
    expiryDays: num(pick("expiryDays", "validityDays", "expiry"), FIRST_ORDER_REWARD_DEFAULTS.expiryDays),
  };
}

export async function getFirstOrderReward(): Promise<FirstOrderRewardSettings> {
  const data = await getDocData<Record<string, any>>("siteSettings", "firstOrderReward");
  return normalizeFirstOrderReward(data);
}

export async function saveFirstOrderReward(settings: Partial<FirstOrderRewardSettings>) {
  // Normalising the incoming form guarantees no undefined / NaN reaches Firestore.
  const merged = normalizeFirstOrderReward({ ...FIRST_ORDER_REWARD_DEFAULTS, ...settings });

  await setDocData("siteSettings", "firstOrderReward", {
    ...merged,
    // Legacy mirrors so any older customer-site build keeps resolving values.
    fixedAmount: merged.discountAmount,
    percentage: merged.discountPercent,
    minOrder: merged.minOrderValue,
    generateUniqueCode: merged.uniqueCode,
  });
  return merged;
}

/**
 * Server-trusted first-order eligibility: counts the customer's ACTUAL orders
 * in Firestore. Never relies on localStorage.
 */
export async function isEligibleForFirstOrderReward(uid: string): Promise<boolean> {
  if (!uid) return false;
  const settings = await getFirstOrderReward();
  if (!settings.enabled) return false;
  if (!settings.firstOrderOnly) return true;
  try {
    const snap = await getDocs(collection(db, "users", uid, "orders"));
    return snap.size === 0;
  } catch {
    return false;
  }
}

/* ================= ANALYTICS (100% real Firestore data) ================= */
export type CollectionIssueKind = "permission-denied" | "query-failed" | "unavailable";

export interface CollectionIssue {
  collection: string;
  kind: CollectionIssueKind;
  message: string;
  code?: string;
}

export interface AnalyticsSnapshot {
  products: any[];
  categories: any[];
  brands: any[];
  orders: UserOrder[];
  customers: FirestoreCustomer[];
  enquiries: any[];
  coupons: any[];
  offers: any[];
  reviews: any[];
  blogPosts: any[];
  videos: any[];
  /**
   * Collections that could not be read. The UI must distinguish these from a
   * genuine 0-record result — a blocked read is never rendered as "0".
   */
  errors: CollectionIssue[];
  /** Collections that were read successfully (even if empty). */
  loaded: string[];
}

/**
 * Loads every collection the Analytics page needs using the AUTHENTICATED
 * Firebase client session (never the public REST API). A failure in one
 * collection does not zero out the rest — it is reported instead.
 */
export async function getAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
  const errors: CollectionIssue[] = [];
  const loaded: string[] = [];

  const safe = async <T,>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      const out = await fn();
      loaded.push(name);
      return out;
    } catch (e: any) {
      const code = String(e?.code || "");
      const msg = String(e?.message || "");
      const denied =
        code.includes("permission-denied") ||
        /missing or insufficient permissions/i.test(msg) ||
        /admin permissions/i.test(msg);
      const unavailable = code.includes("unavailable") || code.includes("deadline");
      errors.push({
        collection: name,
        kind: denied ? "permission-denied" : unavailable ? "unavailable" : "query-failed",
        message: msg || "Unreadable",
        code: code || undefined,
      });
      return fallback;
    }
  };

  const [products, categories, brands, orders, customers, enquiries, coupons, offers, reviews, blogPosts, videos] =
    await Promise.all([
      safe("products", getProducts, [] as any[]),
      safe("categories", getCategories, [] as any[]),
      safe("brands", getBrands, [] as any[]),
      safe("orders", getAllCustomerOrders, [] as UserOrder[]),
      safe("users", getAllCustomers, [] as FirestoreCustomer[]),
      safe("enquiries", getEnquiries, [] as any[]),
      safe("coupons", getCoupons, [] as any[]),
      safe("offers", getOffers, [] as any[]),
      safe("reviews", getReviews, [] as any[]),
      safe("blogPosts", getBlogPosts, [] as any[]),
      safe("videos", getVideos, [] as any[]),
    ]);

  return { products, categories, brands, orders, customers, enquiries, coupons, offers, reviews, blogPosts, videos, errors, loaded };
}
