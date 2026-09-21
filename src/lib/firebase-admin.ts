import "server-only";
import {
  initializeApp,
  getApps,
  getApp,
  cert,
  type App,
  applicationDefault,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { FIREBASE_PROJECT_ID } from "./firebase";
import {
  normalizeRole,
  isMasterSuperAdmin,
  resolveAdminAuthorization,
  MASTER_SUPER_ADMIN_UID,
  type AdminRole,
} from "./permissions";

/**
 * Firebase Admin SDK — SERVER ONLY.
 *
 * Used exclusively for privileged actions that cannot be performed from the
 * browser: creating Firebase Auth users, setting custom claims and resetting
 * passwords. It is never imported into client code ("server-only" guards this).
 *
 * Credentials come from environment variables — never committed, never sent to
 * the browser:
 *   FIREBASE_SERVICE_ACCOUNT        full service-account JSON (recommended), or
 *   FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY
 *
 * IMPORTANT: this module must never throw at import time, so that `npm run
 * build` succeeds on hosts where the service account is not configured. The
 * credential is resolved lazily and route handlers return a clear 503 instead.
 */

/**
 * BUILD STAMP — lets you prove the LIVE endpoint is this version.
 * Bump when the auth path changes. Returned by /api/admin/whoami and by the
 * create-user error payloads.
 */
export const ADMIN_AUTH_BUILD = "auth-v3-master-uid-first";

/** Project the CLIENT is configured for (from src/lib/firebase.ts). */
export const CLIENT_PROJECT_ID = FIREBASE_PROJECT_ID;

/** Project the SERVER Admin SDK will use. Never exposes credentials. */
export function serverProjectId(): string {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return String(parsed.project_id ?? parsed.projectId ?? "");
    } catch {
      return "";
    }
  }
  return String(process.env.FIREBASE_PROJECT_ID || "");
}

/**
 * ITEM 6 — client/server Firebase project must match, otherwise
 * verifyIdToken() rejects every token from the panel.
 */
export function projectMismatch(): { mismatch: boolean; client: string; server: string } {
  const server = serverProjectId();
  const client = CLIENT_PROJECT_ID;
  return { mismatch: !!server && !!client && server !== client, client, server };
}

export class AdminSdkUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdminSdkUnavailableError";
  }
}

/**
 * Thrown by `verifyCaller` with a stable machine-readable code. The API
 * routes map this to an HTTP status and a structured JSON error without
 * ever leaking the token or internal Firebase error strings to the browser.
 */
export class AuthTaggedError extends Error {
  code: "AUTH_TOKEN_MISSING" | "AUTH_TOKEN_INVALID" | "INACTIVE" | "UNAUTHENTICATED" | "FORBIDDEN";
  constructor(
    code: "AUTH_TOKEN_MISSING" | "AUTH_TOKEN_INVALID" | "INACTIVE" | "UNAUTHENTICATED" | "FORBIDDEN",
    message: string
  ) {
    super(message);
    this.name = "AuthTaggedError";
    this.code = code;
  }
}

let cached: App | null = null;

function loadCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      return cert({
        projectId: parsed.project_id ?? parsed.projectId,
        clientEmail: parsed.client_email ?? parsed.clientEmail,
        privateKey: String(parsed.private_key ?? parsed.privateKey ?? "").replace(/\\n/g, "\n"),
      });
    } catch {
      throw new AdminSdkUnavailableError(
        "FIREBASE_SERVICE_ACCOUNT is set but is not valid JSON. Paste the full service-account key."
      );
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (projectId && clientEmail && privateKey) {
    return cert({ projectId, clientEmail, privateKey });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return applicationDefault();

  throw new AdminSdkUnavailableError(
    "Firebase Admin SDK is not configured on the server. Set FIREBASE_SERVICE_ACCOUNT (full JSON) " +
      "or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY in the deployment environment. " +
      "Admin-user creation and password resets require it; all other Admin Panel features work without it."
  );
}

export function getAdminApp(): App {
  if (cached) return cached;
  if (getApps().length > 0) {
    cached = getApp();
    return cached;
  }
  cached = initializeApp({
    credential: loadCredential(),
    projectId: process.env.FIREBASE_PROJECT_ID || FIREBASE_PROJECT_ID,
  });
  return cached;
}

export function adminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function adminDb(): Firestore {
  return getFirestore(getAdminApp());
}

/** True when privileged endpoints can run (checked before use, never at import). */
export function isAdminSdkConfigured(): boolean {
  return !!(
    process.env.FIREBASE_SERVICE_ACCOUNT?.trim() ||
    (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}

/** Permanent master owner UID (single source of truth in permissions.ts). */
export const PRIMARY_ADMIN_UID = MASTER_SUPER_ADMIN_UID;

export interface VerifiedCaller {
  uid: string;
  email: string;
  name: string;
  role: AdminRole;
  active: boolean;
  /** Safe diagnostics describing HOW the decision was reached. */
  diagnostics: AuthDiagnostics;
}

export interface AuthDiagnostics {
  callerUid: string;
  verifiedEmail: string;
  clientProjectId: string;
  serverProjectId: string;
  projectMatch: boolean;
  adminSdkInitialized: boolean;
  build: string;
  masterAdminMatch: boolean;
  adminDocExists: boolean;
  /** Raw value stored in Firestore, before normalisation. */
  rawRole: string | null;
  /** Role from the verified custom claim, if any. */
  claimRole: string | null;
  resolvedRole: AdminRole;
  adminActive: boolean;
  authorizationResult: "allowed" | "denied";
  reason: string;
}

/** Re-exported so routes and rules share one definition. */
export function isPrimaryAdminUid(uid: string): boolean {
  return isMasterSuperAdmin(uid);
}

/**
 * Logs the authorization decision. Safe fields ONLY — never the ID token,
 * refresh token, password, private key or service-account JSON.
 */
export function logAuthCheck(label: string, d: AuthDiagnostics) {
  console.log(
    [
      `\n${label}`,
      `  build:               ${d.build}`,
      `  adminSdkInitialized: ${d.adminSdkInitialized}`,
      `  clientProjectId:     ${d.clientProjectId}`,
      `  serverProjectId:     ${d.serverProjectId}`,
      `  projectMatch:        ${d.projectMatch}`,
      `  callerUid:           ${d.callerUid}`,
      `  verifiedEmail:       ${d.verifiedEmail}`,
      `  masterUid:           ${MASTER_SUPER_ADMIN_UID}`,
      `  masterAdminMatch:    ${d.masterAdminMatch}`,
      `  adminDocExists:      ${d.adminDocExists}`,
      `  rawRole:             ${d.rawRole ?? "(none)"}`,
      `  claimRole:           ${d.claimRole ?? "(none)"}`,
      `  resolvedRole:        ${d.resolvedRole}`,
      `  adminActive:         ${d.adminActive}`,
      `  authorizationResult: ${d.authorizationResult}`,
      `  reason:              ${d.reason}`,
    ].join("\n")
  );
}

/**
 * Verifies `Authorization: Bearer <Firebase ID token>` and resolves the
 * caller's authoritative identity.
 *
 * ORDER MATTERS — the master UID is checked FIRST and short-circuits:
 *   1. uid === MASTER_SUPER_ADMIN_UID  → superadmin, ALWAYS.
 *      No Firestore document, custom claim or role string is required, so the
 *      owner can never be locked out.
 *   2. otherwise adminUsers/{uid} must exist, be active, and its role (or the
 *      verified custom claim) decides the privileges.
 *
 * The role is NEVER read from the request body, query string or any other
 * client-supplied value.
 */
export async function verifyCaller(req: Request): Promise<VerifiedCaller> {
  const header = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  console.log("[VERIFY] Raw authorization header:", header.substring(0, 50) + "...");
  console.log("[VERIFY] Header starts with 'Bearer ':", header.startsWith("Bearer "));
  
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  console.log("[VERIFY] Extracted token length:", token.length);
  
  if (!token) {
    throw new AuthTaggedError("AUTH_TOKEN_MISSING", "Authorization header is missing.");
  }

  let decoded;
  try {
    // checkRevoked=true rejects sessions revoked after a deactivation.
    decoded = await adminAuth().verifyIdToken(token, true);
  } catch (e: any) {
    const code = String(e?.errorInfo?.code ?? e?.code ?? "");
    const msg = String(e?.message ?? "");

    // ITEM 7 — the client must see one of three codes here:
    //   AUTH_TOKEN_INVALID  (401) — malformed/expired/unverifiable token
    //   INACTIVE            (403) — token is valid but account is disabled/revoked
    //   UNAUTHENTICATED     (401) — other transient verification failure

    if (code.includes("id-token-revoked")) {
      console.error(
        ["\nADMIN API AUTH DEBUG",
         "  tokenVerification: id-token-revoked",
         "  authorizationResult: denied",
         "  reason: token was revoked after a role/deactivation change"
        ].join("\n")
      );
      throw new AuthTaggedError("INACTIVE", "Your admin session has been revoked. Please sign in again.");
    }
    if (code.includes("user-disabled")) {
      throw new AuthTaggedError("INACTIVE", "Your admin account is disabled. Contact a Super Admin.");
    }
    if (code.includes("id-token-expired") || code.includes("auth/argument-error")) {
      throw new AuthTaggedError("AUTH_TOKEN_INVALID", "Your admin session has expired. Please log in again.");
    }

    // Retry the plain signature verification once — transient Admin SDK
    // lookup failures should not immediately lock out a legitimate admin.
    try {
      decoded = await adminAuth().verifyIdToken(token);
    } catch (retryErr: any) {
      const retryCode = String(retryErr?.errorInfo?.code ?? retryErr?.code ?? "");
      console.error(
        ["\nADMIN API AUTH DEBUG",
         `  tokenVerification: failed (${retryCode || retryErr?.message || "unknown"})`,
         "  authorizationResult: denied",
         "  reason: Firebase Admin SDK rejected the ID token"
        ].join("\n")
      );
      throw new AuthTaggedError("AUTH_TOKEN_INVALID", "Your admin session has expired. Please log in again.");
    }
  }

  const uid = decoded.uid;
  const claimRole = typeof decoded.role === "string" ? decoded.role : null;

  /* ---- 1. MASTER SUPER ADMIN — unconditional ---------------------------- */
  if (isMasterSuperAdmin(uid)) {
    const pm = projectMismatch();
    const diagnostics: AuthDiagnostics = {
      callerUid: uid,
      verifiedEmail: decoded.email ?? "",
      clientProjectId: pm.client,
      serverProjectId: pm.server,
      projectMatch: !pm.mismatch,
      adminSdkInitialized: true,
      build: ADMIN_AUTH_BUILD,
      masterAdminMatch: true,
      adminDocExists: false, // irrelevant for the master account
      rawRole: null,
      claimRole,
      resolvedRole: "superadmin",
      adminActive: true,
      authorizationResult: "allowed",
      reason: "Master Super Admin UID matched — access granted unconditionally.",
    };
    return {
      uid,
      email: decoded.email ?? "",
      name: decoded.name ?? decoded.email ?? "Owner",
      role: "superadmin",
      active: true,
      diagnostics,
    };
  }

  /* ---- 2. Everyone else: adminUsers/{uid} must exist and be active ------ */
  let snap;
  try {
    snap = await adminDb().collection("adminUsers").doc(uid).get();
  } catch (e) {
    console.error("[verifyCaller] adminUsers read failed:", e);
    throw new AuthTaggedError("FORBIDDEN", "Could not verify your administrator account. Please try again.");
  }

  const adminDocExists = snap.exists;
  const d = (snap.data() ?? {}) as Record<string, unknown>;
  const rawRole = adminDocExists ? String(d.role ?? "") || null : null;
  const active = adminDocExists ? d.active !== false : false;

  // Pure, unit-tested decision function.
  const decision = resolveAdminAuthorization({
    uid,
    claimRole,
    adminDocExists,
    rawRole,
    active,
  });
  const resolvedRole = decision.role;

  const pm2 = projectMismatch();
  const diagnostics: AuthDiagnostics = {
    callerUid: uid,
    verifiedEmail: decoded.email ?? "",
    clientProjectId: pm2.client,
    serverProjectId: pm2.server,
    projectMatch: !pm2.mismatch,
    adminSdkInitialized: true,
    build: ADMIN_AUTH_BUILD,
    masterAdminMatch: decision.masterAdminMatch,
    adminDocExists,
    rawRole,
    claimRole,
    resolvedRole,
    adminActive: active,
    authorizationResult: decision.allowed ? "allowed" : "denied",
    reason: decision.reason,
  };

  if (!decision.allowed) {
    logAuthCheck("ADMIN AUTH CHECK", diagnostics);
    throw decision.denyCode === "inactive"
      ? new AuthTaggedError("INACTIVE", "Your admin account is inactive. Contact a Super Admin.")
      : new AuthTaggedError("FORBIDDEN", "You do not have permission to manage admin users.");
  }

  return {
    uid,
    email: decoded.email ?? String(d.email ?? ""),
    name: String(d.name ?? decoded.name ?? decoded.email ?? "admin"),
    role: resolvedRole,
    active: true,
    diagnostics,
  };
}

/**
 * STEP 9 — self-heal the master admin record.
 *
 * The master UID works without any document, but if one exists it is
 * normalised to { uid, role: "superadmin", active: true } so the UI, the
 * admin list and Firestore rules all agree. Runs with Admin SDK privileges
 * (never from the browser) and is entirely non-fatal.
 */
export async function ensureMasterAdminDoc(email = "", name = "Owner"): Promise<void> {
  try {
    const ref = adminDb().collection("adminUsers").doc(MASTER_SUPER_ADMIN_UID);
    const snap = await ref.get();
    const existing = (snap.data() ?? {}) as Record<string, unknown>;
    const needsFix =
      !snap.exists ||
      normalizeRole(existing.role) !== "superadmin" ||
      existing.active !== true ||
      existing.uid !== MASTER_SUPER_ADMIN_UID;

    if (!needsFix) return;

    await ref.set(
      {
        uid: MASTER_SUPER_ADMIN_UID,
        role: "superadmin",
        active: true,
        name: String(existing.name ?? name),
        email: String(existing.email ?? email),
        updatedAt: new Date(),
        updatedAtMs: Date.now(),
        note: "Master Super Admin — normalised automatically.",
      },
      { merge: true }
    );
    console.log("[ensureMasterAdminDoc] master admin record normalised.");
  } catch (e) {
    console.warn("[ensureMasterAdminDoc] non-fatal:", e);
  }
}

/** Maps a thrown verification error to an HTTP status. */
export function authErrorStatus(message: string): number {
  if (message.startsWith("UNAUTHENTICATED")) return 401;
  if (message.startsWith("FORBIDDEN")) return 403;
  if (message.startsWith("INACTIVE")) return 403;
  return 400;
}

/** Maps an `AuthTaggedError.code` to the correct HTTP status. */
export function taggedAuthStatus(code: string): number {
  if (code === "AUTH_TOKEN_MISSING" || code === "AUTH_TOKEN_INVALID" || code === "UNAUTHENTICATED") return 401;
  if (code === "FORBIDDEN" || code === "INACTIVE") return 403;
  return 400;
}

/** Strips the internal tag so only a clean sentence reaches the browser. */
export function cleanAuthError(message: string): string {
  return message.replace(
    /^(UNAUTHENTICATED|FORBIDDEN|INACTIVE|AUTH_TOKEN_MISSING|AUTH_TOKEN_INVALID):\s*/,
    ""
  );
}

/**
 * Converts a raw Firebase Admin error into a safe, user-facing message.
 * Full details are logged server-side only — never returned to the browser.
 */
export function friendlyAuthError(e: any, fallback: string): string {
  const code = String(e?.errorInfo?.code ?? e?.code ?? "");
  console.error("[firebase-admin]", code, e?.message ?? e);
  if (code.includes("email-already-exists")) {
    return "This email is already registered. Use another email.";
  }
  if (code.includes("invalid-email")) return "That email address is not valid.";
  if (code.includes("invalid-password") || code.includes("weak-password")) {
    return "Password does not meet the requirements (minimum 6 characters).";
  }
  if (code.includes("user-not-found")) return "That administrator account no longer exists.";
  if (code.includes("insufficient-permission")) {
    return "The server's Firebase service account lacks permission for this action.";
  }
  return fallback;
}

/**
 * Server-side activity log using the Admin SDK.
 * Never throws — a logging failure must not fail the privileged operation.
 */
/**
 * Server-side activity log (Admin SDK).
 *
 * ITEM 15 — writes to BOTH collections so nothing is lost during the
 * transition: `activities` (the requested canonical name) and `activityLog`
 * (what the existing Activity Log page already reads). Both records carry the
 * same payload and an `alsoWrittenTo` marker so they are recognisable as one
 * event rather than two separate actions.
 *
 * Never throws — a logging failure must never fail the privileged operation.
 * Passwords are never included.
 */
export async function logServerActivity(entry: {
  adminUid: string;
  adminName: string;
  adminEmail: string;
  role: string;
  action: string;
  entity: string;
  entityId?: string;
  description: string;
  changes?: Record<string, unknown>;
}): Promise<void> {
  const payload = {
    ...entry,
    entityId: entry.entityId ?? "",
    changes: entry.changes ?? null,
    createdAt: new Date(),
    createdAtMs: Date.now(),
    source: "server",
    // Password material is never included in an activity record.
  };

  const write = async (col: string) => {
    try {
      await adminDb().collection(col).add({ ...payload, alsoWrittenTo: col === "activities" ? "activityLog" : "activities" });
    } catch (e) {
      console.warn(`[activity] ${col} write failed (non-fatal):`, e);
    }
  };

  await Promise.all([write("activities"), write("activityLog")]);
}
