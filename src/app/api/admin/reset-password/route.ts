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
import { canManageAdminsFor } from "@/lib/permissions";

/**
 * POST /api/admin/reset-password
 *
 * Sets a new Firebase Authentication password for an existing administrator.
 *
 * Security:
 *   - Super Admin only (verified from the Firebase ID token, server-side).
 *   - The existing password is never requested, read or displayed — it cannot
 *     be: Firebase stores only a salted hash.
 *   - The new password goes straight to Firebase Auth and is NEVER written to
 *     Firestore, never logged and never returned in the response.
 *
 * Two modes:
 *   { uid, newPassword, confirmPassword }  → set a new password directly
 *   { uid, mode: "link" }                  → generate Firebase's secure
 *                                            password-reset link to send to
 *                                            the administrator instead
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  if (!isAdminSdkConfigured()) {
    return json(
      {
        success: false,
        error:
          "Firebase Admin SDK is not configured on the server. Set FIREBASE_SERVICE_ACCOUNT (or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY) to reset administrator passwords.",
        code: "ADMIN_SDK_UNCONFIGURED",
      },
      503
    );
  }

  let caller;
  try {
    caller = await verifyCaller(req);
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

  if (!canManageAdminsFor(caller.uid, caller.role)) {
    return json(
      { success: false, error: "You do not have permission to reset administrator passwords.", code: "FORBIDDEN" },
      403
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Invalid request body." }, 400);
  }

  const uid = String(body.uid ?? "").trim();
  const mode = String(body.mode ?? "set");
  const newPassword = String(body.newPassword ?? "");
  const confirmPassword = String(body.confirmPassword ?? "");

  if (!uid) return json({ success: false, error: "Target administrator UID is required." }, 400);
  if (mode !== "link") {
    if (newPassword.length < 8)
      return json(
        { success: false, error: "Password does not meet the requirements (minimum 8 characters)." },
        400
      );
    if (newPassword !== confirmPassword)
      return json({ success: false, error: "Passwords do not match." }, 400);
  }

  // Confirm the target really is an administrator in this project.
  let targetName = "";
  let targetEmail = "";
  try {
    const rec = await adminAuth().getUser(uid);
    targetEmail = rec.email ?? "";
    targetName = rec.displayName ?? "";
  } catch {
    return json({ success: false, error: "That administrator account no longer exists." }, 404);
  }

  try {
    const snap = await adminDb().collection("adminUsers").doc(uid).get();
    if (snap.exists) {
      const d = snap.data() ?? {};
      targetName = targetName || String(d.name ?? "");
      targetEmail = targetEmail || String(d.email ?? "");
    } else if (!isPrimaryAdminUid(uid)) {
      return json(
        { success: false, error: "That user is not an administrator of this panel." },
        403
      );
    }
  } catch {
    /* non-fatal: the Auth record already proved the user exists */
  }

  /* ---- Mode "link": Firebase's own secure reset flow ---- */
  if (mode === "link") {
    if (!targetEmail) {
      return json({ success: false, error: "That administrator has no email address on file." }, 400);
    }
    let link: string;
    try {
      link = await adminAuth().generatePasswordResetLink(targetEmail);
    } catch (e: any) {
      return json(
        { success: false, error: friendlyAuthError(e, "Could not generate a password reset link.") },
        500
      );
    }

    await logServerActivity({
      adminUid: caller.uid,
      adminName: caller.name,
      adminEmail: caller.email,
      role: caller.role,
      action: "RESET_ADMIN_PASSWORD",
      entity: "adminUser",
      entityId: uid,
      description: `Generated a password reset link for ${targetName || targetEmail}`,
    });

    return json({
      success: true,
      resetLink: link,
      message: `Secure reset link generated for ${targetEmail}. Share it with them privately — it expires automatically.`,
    });
  }

  /* ---- Mode "set": write a new password directly ---- */
  try {
    await adminAuth().updateUser(uid, { password: newPassword });
    // Force re-authentication everywhere so the old password cannot be reused.
    await adminAuth().revokeRefreshTokens(uid);
  } catch (e: any) {
    return json(
      { success: false, error: friendlyAuthError(e, "Could not update the password. Please try again.") },
      500
    );
  }

  await logServerActivity({
    adminUid: caller.uid,
    adminName: caller.name,
    adminEmail: caller.email,
    role: caller.role,
    action: "RESET_ADMIN_PASSWORD",
    entity: "adminUser",
    entityId: uid,
    // The password itself is deliberately absent from the log.
    description: `Reset password for administrator ${targetName || targetEmail || uid}`,
  });

  return json({
    success: true,
    message: `Password updated for ${targetName || targetEmail}. Existing sessions were revoked.`,
  });
}
