/**
 * ADMIN ROLE & PERMISSION MATRIX — single source of truth.
 *
 * Used by three independent layers (defence in depth):
 *   1. Admin Panel UI  — hides modules/actions the role may not use.
 *   2. Server APIs     — re-check the caller's verified custom claim/role.
 *   3. Firestore rules — mirror the same matrix, so a hidden button cannot be
 *                        bypassed by typing a URL or calling Firestore directly.
 *
 * Roles are normalised internally to: superadmin | manager | staff.
 * UI labels remain: Super Admin | Manager | Staff.
 */

export type AdminRole = "superadmin" | "manager" | "staff";

/**
 * PERMANENT MASTER SUPER ADMIN.
 *
 * This Firebase Auth UID is ALWAYS a Super Admin. It must never depend on an
 * adminUsers/{uid} Firestore document existing, on a custom claim, or on any
 * role string — so the owner can never be locked out of their own panel.
 * Shared by the client UI, the server APIs and mirrored in firestore.rules.
 */
export const MASTER_SUPER_ADMIN_UID = "qdVg8nA0dVaA7SxE9QrIRzOXiz23";

/** Single source of truth for master-admin detection. */
export function isMasterSuperAdmin(uid: unknown): boolean {
  return typeof uid === "string" && uid.trim() === MASTER_SUPER_ADMIN_UID;
}

export const ROLE_LABEL: Record<AdminRole, string> = {
  superadmin: "Super Admin",
  manager: "Manager",
  staff: "Staff",
};

export const ROLE_DESCRIPTION: Record<AdminRole, string> = {
  superadmin: "Full access, including creating and managing administrator accounts.",
  manager: "Full operational and content access. Cannot manage administrator accounts.",
  staff: "Order processing and read-only catalogue access. No settings, CMS or admin management.",
};

export const ALL_ROLES: AdminRole[] = ["superadmin", "manager", "staff"];

/**
 * Normalises ANY historical role spelling to a canonical role.
 *
 * Previously this compared for EXACT equality after stripping only spaces,
 * underscores and hyphens, so real values stored in this database — such as
 * "Super Admin — Full access" (em dash) or "administrator" — silently fell
 * through to "staff" and locked legitimate Super Admins out of admin-user
 * management. That was the cause of
 * "You do not have permission to create admin users."
 *
 * Matching is now prefix/substring based over an alphanumeric-only form, and
 * "superadmin" is always tested BEFORE "admin" (because "superadmin" also
 * contains the substring "admin").
 *
 * Accepted → superadmin:
 *   superadmin · Super Admin · super_admin · super-admin · SUPER ADMIN
 *   "Super Admin — Full access" · owner · master
 * Accepted → manager:
 *   manager · Manager · admin · administrator
 * Everything else (including empty/unknown) → staff (least privilege).
 */
export function normalizeRole(raw: unknown): AdminRole {
  const r = String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (!r) return "staff";

  // Super Admin must be checked first — "superadmin" contains "admin".
  if (r.startsWith("superadmin") || r.includes("superadmin")) return "superadmin";
  if (r === "super" || r.startsWith("owner") || r.startsWith("master")) return "superadmin";

  if (r.startsWith("manager")) return "manager";
  if (r.startsWith("administrator") || r.startsWith("admin")) return "manager";

  if (r.startsWith("staff") || r.startsWith("support") || r.startsWith("employee")) return "staff";

  return "staff";
}

export type Action = "read" | "create" | "update" | "delete";

/**
 * Logical modules. Keys are used by `can()` and by the navigation filter.
 */
export type Module =
  | "dashboard"
  | "products"
  | "categories"
  | "brands"
  | "orders"
  | "customers"
  | "enquiries"
  | "homepage"
  | "videos"
  | "pages"
  | "blog"
  | "offers"
  | "coupons"
  | "reviews"
  | "appearance"
  | "seo"
  | "settings"
  | "rewards"
  | "analytics"
  | "adminUsers"
  | "backup"
  | "activity"
  | "connection";

type Matrix = Record<Module, Action[]>;

const FULL: Action[] = ["read", "create", "update", "delete"];

/** Super Admin — everything. */
const SUPERADMIN: Matrix = {
  dashboard: FULL, products: FULL, categories: FULL, brands: FULL, orders: FULL,
  customers: FULL, enquiries: FULL, homepage: FULL, videos: FULL, pages: FULL,
  blog: FULL, offers: FULL, coupons: FULL, reviews: FULL, appearance: FULL,
  seo: FULL, settings: FULL, rewards: FULL, analytics: FULL, adminUsers: FULL,
  backup: FULL, activity: FULL, connection: FULL,
};

/**
 * Manager — full operational/business access, but NO administrator management
 * and no destructive access to admin accounts.
 */
const MANAGER: Matrix = {
  dashboard: ["read"],
  products: FULL, categories: FULL, brands: FULL,
  orders: ["read", "create", "update"],
  customers: ["read", "update"],
  enquiries: ["read", "create", "update", "delete"],
  homepage: ["read", "update"],
  videos: FULL, pages: ["read", "update"], blog: FULL,
  offers: FULL, coupons: FULL, reviews: ["read", "update", "delete"],
  appearance: ["read", "update"],
  seo: ["read", "update"],
  settings: ["read", "update"],
  rewards: ["read", "update"],
  analytics: ["read"],
  adminUsers: [],           // ← no access at all
  backup: ["read"],
  activity: ["read"],
  connection: ["read"],
};

/**
 * Staff — order processing only, plus the read access needed to do it.
 * Explicitly cannot delete products, touch settings/SEO/CMS/coupons, or
 * manage admins.
 */
const STAFF: Matrix = {
  dashboard: ["read"],
  products: ["read"],
  categories: ["read"],
  brands: ["read"],
  orders: ["read", "update"],   // allowed status transitions only
  customers: ["read"],
  enquiries: ["read", "update"],
  homepage: [],
  videos: [],
  pages: [],
  blog: [],
  offers: [],
  coupons: [],
  reviews: ["read"],
  appearance: [],
  seo: [],
  settings: [],
  rewards: [],
  analytics: [],
  adminUsers: [],
  backup: [],
  activity: [],
  connection: [],
};

const MATRIX: Record<AdminRole, Matrix> = {
  superadmin: SUPERADMIN,
  manager: MANAGER,
  staff: STAFF,
};

/** Can this role perform `action` on `module`? */
export function can(role: unknown, module: Module, action: Action = "read"): boolean {
  const r = normalizeRole(role);
  return (MATRIX[r][module] ?? []).includes(action);
}

/** Does this role have ANY access to the module (used for nav filtering)? */
export function canAccess(role: unknown, module: Module): boolean {
  const r = normalizeRole(role);
  return (MATRIX[r][module] ?? []).length > 0;
}

/** Order statuses a role may set. Staff cannot cancel or delete. */
export const STAFF_ALLOWED_ORDER_STATUSES = [
  "Order Placed",
  "Confirmed",
  "Processing",
  "Shipped",
  "Delivered",
];

export function canSetOrderStatus(role: unknown, status: string): boolean {
  const r = normalizeRole(role);
  if (!can(r, "orders", "update")) return false;
  if (r === "staff") return STAFF_ALLOWED_ORDER_STATUSES.includes(status);
  return true;
}

/** Only a Super Admin may manage administrator accounts. */
export function canManageAdmins(role: unknown): boolean {
  return normalizeRole(role) === "superadmin";
}

/**
 * Authoritative check used by the server APIs.
 * The master UID is accepted regardless of role/claim/document state.
 */
export function canManageAdminsFor(uid: unknown, role: unknown): boolean {
  return isMasterSuperAdmin(uid) || canManageAdmins(role);
}


/* ------------------------------------------------------------------ *
 * PURE AUTHORIZATION RESOLVER                                         *
 * ------------------------------------------------------------------ *
 * The single decision function used by the server after a Firebase ID
 * token has been verified. Kept pure (no Firebase imports) so the
 * security decision itself is directly unit-testable.
 * ------------------------------------------------------------------ */

export interface AuthResolverInput {
  /** UID decoded from the VERIFIED Firebase ID token — never client-supplied. */
  uid: string;
  /** `role` custom claim from the verified token, if present. */
  claimRole?: string | null;
  /** Whether adminUsers/{uid} exists. */
  adminDocExists: boolean;
  /** Raw `role` value stored in Firestore, if any. */
  rawRole?: string | null;
  /** Whether adminUsers/{uid}.active !== false. */
  active: boolean;
}

export interface AuthResolution {
  allowed: boolean;
  role: AdminRole;
  masterAdminMatch: boolean;
  canManageAdminUsers: boolean;
  /** "ok" | "no-admin-doc" | "inactive" */
  denyCode: "ok" | "no-admin-doc" | "inactive";
  reason: string;
}

/**
 * Resolves an administrator's effective authorization.
 *
 * ORDER IS SECURITY-CRITICAL: the master Super Admin UID is evaluated first
 * and short-circuits everything else, so the owner is granted access even
 * when adminUsers/{uid} is missing, inactive, or holds a malformed role.
 */
export function resolveAdminAuthorization(input: AuthResolverInput): AuthResolution {
  if (isMasterSuperAdmin(input.uid)) {
    return {
      allowed: true,
      role: "superadmin",
      masterAdminMatch: true,
      canManageAdminUsers: true,
      denyCode: "ok",
      reason: "Master Super Admin UID matched — access granted unconditionally.",
    };
  }

  const role = normalizeRole(input.claimRole ?? input.rawRole);

  if (!input.adminDocExists) {
    return {
      allowed: false,
      role,
      masterAdminMatch: false,
      canManageAdminUsers: false,
      denyCode: "no-admin-doc",
      reason: "No adminUsers document exists for this UID.",
    };
  }

  if (!input.active) {
    return {
      allowed: false,
      role,
      masterAdminMatch: false,
      canManageAdminUsers: false,
      denyCode: "inactive",
      reason: "adminUsers document exists but active === false.",
    };
  }

  return {
    allowed: true,
    role,
    masterAdminMatch: false,
    canManageAdminUsers: role === "superadmin",
    denyCode: "ok",
    reason: `Authenticated as ${role} (from ${input.claimRole ? "custom claim" : "adminUsers.role"}).`,
  };
}
