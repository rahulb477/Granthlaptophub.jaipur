import {
  adminAuth,
  adminDb,
  authErrorStatus,
  cleanAuthError,
  friendlyAuthError,
  isAdminSdkConfigured,
  isPrimaryAdminUid,
  logServerActivity,
  verifyCaller,
} from "@/lib/firebase-admin";
import { canManageAdminsFor, normalizeRole, ROLE_LABEL } from "@/lib/permissions";

/**
 * POST   /api/admin/update-user  — edit name / email / role / active state
 * DELETE /api/admin/update-user  — remove an administrator
 *
 * Super Admin only, verified server-side from the Firebase ID token.
 *
 * Keeps Firebase Authentication and adminUsers/{uid} in sync:
 *   active=false → admin.auth().updateUser(uid, { disabled: true })
 *   active=true  → admin.auth().updateUser(uid, { disabled: false })
 *   email change → updates the Firebase Auth email too
 *   role change  → updates the custom claim and revokes refresh tokens
 *
 * The preserved owner UID (qdVg8nA0dVaA7SxE9QrIRzOXiz23) can never be
 * demoted, deactivated or deleted.
 * No credential material is ever written to Firestore.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function guardUnconfigured() {
  if (isAdminSdkConfigured()) return null;
  return json(
    {
      success: false,
      error:
        "Admin management is not available: the server's Firebase Admin credentials are not configured. Ask the developer to set FIREBASE_SERVICE_ACCOUNT.",
      code: "ADMIN_SDK_UNCONFIGURED",
    },
    503
  );
}

async function requireSuperAdmin(req: Request) {
  const caller = await verifyCaller(req);
  if (!canManageAdminsFor(caller.uid, caller.role)) {
    throw new Error("FORBIDDEN: You do not have permission to manage admin users.");
  }
  return caller;
}

export async function POST(req: Request) {
  const unconfigured = guardUnconfigured();
  if (unconfigured) return unconfigured;

  let caller;
  try {
    caller = await requireSuperAdmin(req);
  } catch (e: any) {
    const tag = e?.code ?? "";
    let code: string;
    let http: number;
    if (tag === "AUTH_TOKEN_MISSING" || tag === "AUTH_TOKEN_INVALID" || tag === "UNAUTHENTICATED") {
      code = tag; http = 401;
    } else if (tag === "INACTIVE") {
      code = "ADMIN_ACCOUNT_INACTIVE"; http = 403;
    } else if (tag === "FORBIDDEN") {
      code = "ADMIN_AUTHORIZATION_FAILED"; http = 403;
    } else {
      const msg = String(e?.message ?? "Unauthorized");
      http = authErrorStatus(msg);
      code = http === 401 ? "NOT_AUTHENTICATED" : (msg.startsWith("INACTIVE") ? "ADMIN_ACCOUNT_INACTIVE" : "ADMIN_AUTHORIZATION_FAILED");
    }
    return json({ success: false, error: code, message: cleanAuthError(String(e?.message ?? "Unauthorized")), code }, http);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Unable to update the account. Please try again." }, 400);
  }

  const uid = String(body.uid ?? "").trim();
  if (!uid) return json({ success: false, error: "Administrator UID is required." }, 400);

  const patch: Record<string, unknown> = {};
  const changes: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) {
    patch.name = body.name.trim();
    changes.name = patch.name;
  }

  if (typeof body.email === "string" && body.email.trim()) {
    const email = body.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return json({ success: false, error: "Enter a valid email address." }, 400);
    patch.email = email;
    changes.email = email;
  }

  if (body.role !== undefined) {
    if (isPrimaryAdminUid(uid)) {
      return json({ success: false, error: "The primary owner account's role cannot be changed." }, 403);
    }
    patch.role = normalizeRole(body.role);
    changes.role = patch.role;
  }

  if (body.active !== undefined) {
    if (isPrimaryAdminUid(uid) && body.active === false) {
      return json({ success: false, error: "The primary owner account cannot be deactivated." }, 403);
    }
    patch.active = body.active !== false;
    changes.active = patch.active;
  }

  if (Object.keys(patch).length === 0) {
    return json({ success: false, error: "Nothing to update." }, 400);
  }

  try {
    /* ---- Firebase Authentication side ---- */
    const authPatch: Record<string, unknown> = {};
    if (patch.name) authPatch.displayName = patch.name;
    if (patch.email) authPatch.email = patch.email;
    // active === false must disable the Auth account, not just the flag.
    if (patch.active !== undefined) authPatch.disabled = patch.active === false;
    if (Object.keys(authPatch).length > 0) await adminAuth().updateUser(uid, authPatch);

    if (patch.role) {
      await adminAuth().setCustomUserClaims(uid, { role: patch.role, admin: true });
    }
    // Deactivation or a role change must invalidate existing sessions.
    if (patch.role || patch.active === false) {
      await adminAuth().revokeRefreshTokens(uid);
    }

    /* ---- Firestore mirror (kept in sync with Auth) ---- */
    await adminDb()
      .collection("adminUsers")
      .doc(uid)
      .set({ ...patch, updatedAt: new Date(), updatedAtMs: Date.now() }, { merge: true });
  } catch (e: any) {
    return json(
      { success: false, error: friendlyAuthError(e, "Unable to update the account. Please try again.") },
      500
    );
  }

  /* ---- Activity log: one record per meaningful change ---- */
  const parts: string[] = [];
  if (changes.name) parts.push(`name → ${changes.name}`);
  if (changes.email) parts.push(`email → ${changes.email}`);
  if (changes.role) parts.push(`role → ${ROLE_LABEL[changes.role as "superadmin" | "manager" | "staff"]}`);
  if (changes.active !== undefined) parts.push(changes.active ? "activated" : "deactivated");

  const action =
    changes.role !== undefined
      ? "CHANGE_ADMIN_ROLE"
      : changes.active !== undefined
      ? changes.active
        ? "ACTIVATE_ADMIN_USER"
        : "DEACTIVATE_ADMIN_USER"
      : "UPDATE_ADMIN_USER";

  await logServerActivity({
    adminUid: caller.uid,
    adminName: caller.name,
    adminEmail: caller.email,
    role: caller.role,
    action,
    entity: "adminUser",
    entityId: uid,
    description: `Administrator updated (${parts.join(", ")})`,
    changes,
  });

  return json({ success: true, message: `Administrator updated (${parts.join(", ")}).` });
}

export async function DELETE(req: Request) {
  const unconfigured = guardUnconfigured();
  if (unconfigured) return unconfigured;

  let caller;
  try {
    caller = await requireSuperAdmin(req);
  } catch (e: any) {
    const tag = e?.code ?? "";
    let code: string;
    let http: number;
    if (tag === "AUTH_TOKEN_MISSING" || tag === "AUTH_TOKEN_INVALID" || tag === "UNAUTHENTICATED") {
      code = tag; http = 401;
    } else if (tag === "INACTIVE") {
      code = "ADMIN_ACCOUNT_INACTIVE"; http = 403;
    } else if (tag === "FORBIDDEN") {
      code = "ADMIN_AUTHORIZATION_FAILED"; http = 403;
    } else {
      const msg = String(e?.message ?? "Unauthorized");
      http = authErrorStatus(msg);
      code = http === 401 ? "NOT_AUTHENTICATED" : (msg.startsWith("INACTIVE") ? "ADMIN_ACCOUNT_INACTIVE" : "ADMIN_AUTHORIZATION_FAILED");
    }
    return json({ success: false, error: code, message: cleanAuthError(String(e?.message ?? "Unauthorized")), code }, http);
  }

  const uid = new URL(req.url).searchParams.get("uid")?.trim() ?? "";
  if (!uid) return json({ success: false, error: "Administrator UID is required." }, 400);
  if (isPrimaryAdminUid(uid))
    return json({ success: false, error: "The primary owner account cannot be deleted." }, 403);
  if (uid === caller.uid)
    return json({ success: false, error: "You cannot delete your own administrator account." }, 400);

  let label = uid;
  try {
    const snap = await adminDb().collection("adminUsers").doc(uid).get();
    if (snap.exists) {
      const d = snap.data() ?? {};
      label = String(d.name ?? d.email ?? uid);
    }
  } catch {
    /* non-fatal */
  }

  try {
    await adminDb().collection("adminUsers").doc(uid).delete();
    await adminAuth().deleteUser(uid);
  } catch (e: any) {
    const code = String(e?.errorInfo?.code ?? e?.code ?? "");
    if (!code.includes("user-not-found")) {
      return json(
        { success: false, error: friendlyAuthError(e, "Unable to delete the account. Please try again.") },
        500
      );
    }
  }

  await logServerActivity({
    adminUid: caller.uid,
    adminName: caller.name,
    adminEmail: caller.email,
    role: caller.role,
    action: "DELETE_ADMIN_USER",
    entity: "adminUser",
    entityId: uid,
    description: `Deleted administrator ${label}`,
  });

  return json({ success: true, message: `Administrator ${label} removed.` });
}
