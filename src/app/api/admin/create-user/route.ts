import {
  adminAuth,
  adminDb,
  authErrorStatus,
  cleanAuthError,
  friendlyAuthError,
  isAdminSdkConfigured,
  logAuthCheck,
  logServerActivity,
  ensureMasterAdminDoc,
  verifyCaller,
  projectMismatch,
  ADMIN_AUTH_BUILD,
  serverProjectId,
} from "@/lib/firebase-admin";
import { canManageAdminsFor, normalizeRole, ROLE_LABEL, ALL_ROLES } from "@/lib/permissions";

/**
 * POST /api/admin/create-user
 *
 * Creates a real Firebase Authentication account for a new administrator and
 * writes ONLY non-sensitive metadata to adminUsers/{uid}.
 *
 * WHY THIS ENDPOINT EXISTS
 * A browser cannot do this: a freshly created Firebase Auth user is not yet an
 * admin, so Firestore rules correctly reject a client-side write to
 * adminUsers/{uid}. That was the cause of "Failed to create admin user."
 * The fix is privileged server-side creation with the Firebase Admin SDK —
 * the rules stay strict (`allow create, update, delete: if isSuperAdmin()`).
 *
 * SECURITY
 *   - Requires `Authorization: Bearer <Firebase ID token>`.
 *   - The token is verified server-side; the caller's role comes from the
 *     verified claim / adminUsers record, never from the request body.
 *   - Only a Super Admin may call this (owner UID, or role superadmin + active).
 *   - The password is forwarded to Firebase Auth and then discarded. It is
 *     never written to Firestore, never logged, never returned.
 *
 * ATOMICITY
 *   If the Auth account is created but the Firestore write fails, the Auth
 *   account is deleted again so no orphan login can exist.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  // Diagnostic logging to trace Authorization header
  const authHeader = req.headers.get("authorization");
  console.log("[SERVER] Request received at /api/admin/create-user");
  console.log("[SERVER] Authorization header present:", !!authHeader);
  console.log("[SERVER] Authorization header length:", authHeader?.length || 0);
  console.log("[SERVER] All headers:", Object.fromEntries(req.headers.entries()));

  if (!isAdminSdkConfigured()) {
    return json(
      {
        success: false,
        error: "ADMIN_SDK_UNCONFIGURED",
        message:
          "Admin user creation service is not configured correctly. Set FIREBASE_SERVICE_ACCOUNT on the server.",
        code: "ADMIN_SDK_UNCONFIGURED",
        build: ADMIN_AUTH_BUILD,
      },
      500
    );
  }

  /* ---- 0. Client/server Firebase project must match ---------------------- */
  const pm = projectMismatch();
  if (pm.mismatch) {
    console.error(
      `\nCREATE ADMIN USER CONFIG ERROR\n  clientProjectId: ${pm.client}\n  serverProjectId: ${pm.server}\n  projectMatch:    false`
    );
    return json(
      {
        success: false,
        error: "FIREBASE_PROJECT_MISMATCH",
        message:
          "Admin user creation service is not configured correctly: the server's Firebase service account belongs to a different project than the Admin Panel.",
        code: "FIREBASE_PROJECT_MISMATCH",
        diagnostics: { clientProjectId: pm.client, serverProjectId: pm.server },
        build: ADMIN_AUTH_BUILD,
      },
      500
    );
  }

  /* ---- 1 & 2. Authenticate the caller and require Super Admin ------------ */
  let caller;
  try {
    caller = await verifyCaller(req);
  } catch (e: any) {
    // ITEM 7 / 8 — use the tagged code directly so the client sees exactly
    // AUTH_TOKEN_MISSING / AUTH_TOKEN_INVALID / ADMIN_ACCOUNT_INACTIVE /
    // ADMIN_AUTHORIZATION_FAILED, never a generic "permission" error.
    const tag = e?.code ?? "";
    let mapped: { http: number; code: string };
    if (tag === "AUTH_TOKEN_MISSING" || tag === "AUTH_TOKEN_INVALID" || tag === "UNAUTHENTICATED") {
      mapped = { http: 401, code: tag };
    } else if (tag === "INACTIVE") {
      mapped = { http: 403, code: "ADMIN_ACCOUNT_INACTIVE" };
    } else if (tag === "FORBIDDEN") {
      mapped = { http: 403, code: "ADMIN_AUTHORIZATION_FAILED" };
    } else {
      const msg = String(e?.message ?? "Unauthorized");
      const status = authErrorStatus(msg);
      mapped = {
        http: status,
        code:
          status === 401
            ? "NOT_AUTHENTICATED"
            : msg.startsWith("INACTIVE")
            ? "ADMIN_ACCOUNT_INACTIVE"
            : "ADMIN_AUTHORIZATION_FAILED",
      };
    }

    // ITEM 17 — safe diagnostic log (no token, no secrets).
    console.log(
      [
        "\nCREATE ADMIN USER AUTH DEBUG",
        `  requestReceived:        true`,
        `  authorizationHeaderPresent: ${!!(req.headers.get("authorization") || req.headers.get("Authorization"))}`,
        `  tokenVerification:      ${tag || "unknown"}`,
        `  verifiedUid:            (token not verified)`,
        `  masterAdminMatch:       false`,
        `  firebaseAdminProjectId: ${serverProjectId()}`,
        `  authorizationResult:    denied`,
      ].join("\n")
    );

    return json(
      {
        success: false,
        error: mapped.code,
        message: cleanAuthError(String(e?.message ?? "Unauthorized")),
        code: mapped.code,
        build: ADMIN_AUTH_BUILD,
      },
      mapped.http
    );
  }

  /* STEP 5 / 8 — emit the safe diagnostic block either way, so the cause of
     a denial is obvious from the Vercel function log. */
  const allowed = canManageAdminsFor(caller.uid, caller.role);
  logAuthCheck("CREATE ADMIN USER AUTH CHECK", {
    ...caller.diagnostics,
    authorizationResult: allowed ? "allowed" : "denied",
    reason: allowed
      ? caller.diagnostics.reason
      : `Resolved role "${caller.diagnostics.resolvedRole}" is not superadmin and UID is not the master admin.`,
  });

  // ITEM 8 / 17 — explicit, safe debug log. No token, no secret.
  console.log(
    [
      "\nCREATE ADMIN USER AUTH DEBUG",
      `  requestReceived:        true`,
      `  authorizationHeaderPresent: true`,
      `  tokenVerification:      success`,
      `  verifiedUid:            ${caller.uid}`,
      `  verifiedEmail:          ${caller.email}`,
      `  masterUid:              qdVg8nA0dVaA7SxE9QrIRzOXiz23`,
      `  masterAdminMatch:       ${caller.diagnostics.masterAdminMatch}`,
      `  resolvedRole:           ${caller.diagnostics.resolvedRole}`,
      `  adminDocExists:         ${caller.diagnostics.adminDocExists}`,
      `  storedRole:             ${caller.diagnostics.rawRole ?? "(none)"}`,
      `  adminActive:            ${caller.diagnostics.adminActive}`,
      `  firebaseAdminProjectId: ${serverProjectId()}`,
      `  clientProjectId:        ${caller.diagnostics.clientProjectId}`,
      `  projectMatch:           ${caller.diagnostics.projectMatch}`,
      `  build:                  ${ADMIN_AUTH_BUILD}`,
      `  authorizationResult:    ${allowed ? "allowed" : "denied"}`,
    ].join("\n")
  );

  if (!allowed) {
    return json(
      {
        success: false,
        error: "ADMIN_AUTHORIZATION_FAILED",
        message:
          "Authenticated admin is not authorized to create admin users. " +
          `Server verified UID ${caller.diagnostics.callerUid} (role: ${caller.diagnostics.resolvedRole}).`,
        code: "ADMIN_AUTHORIZATION_FAILED",
        build: ADMIN_AUTH_BUILD,
        // Safe, non-sensitive context so the cause is obvious in the UI.
        diagnostics: caller.diagnostics,
      },
      403
    );
  }

  // STEP 9 — keep the master admin record correct (non-fatal, never blocks).
  if (caller.diagnostics.masterAdminMatch) {
    await ensureMasterAdminDoc(caller.email, caller.name);
  }

  /* ---- 3. Validate input -------------------------------------------------- */
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, error: "Unable to create admin account. Please try again." }, 400);
  }

  const name = String(body.name ?? body.fullName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const confirmPassword = String(body.confirmPassword ?? "");
  const roleInput = String(body.role ?? "");
  const active = body.active !== false;

  const invalid = (message: string, code = "VALIDATION_ERROR") =>
    json({ success: false, error: code, message, code, build: ADMIN_AUTH_BUILD }, 400);

  if (!name) return invalid("Full name is required.");
  if (!EMAIL_RE.test(email)) return invalid("Enter a valid email address.");
  if (password.length < MIN_PASSWORD) {
    return invalid(
      `Password does not meet the requirements (minimum ${MIN_PASSWORD} characters).`,
      "WEAK_PASSWORD"
    );
  }
  if (password !== confirmPassword) {
    return invalid("Passwords do not match.", "PASSWORD_MISMATCH");
  }
  if (!ALL_ROLES.includes(normalizeRole(roleInput)) || !roleInput) {
    return invalid("Select a role: Super Admin, Manager or Staff.", "INVALID_ROLE");
  }
  const role = normalizeRole(roleInput);

  /* ---- 4 & 5. Create the Firebase Auth account --------------------------- */
  let uid: string;
  try {
    const user = await adminAuth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: false,
      disabled: !active,
    });
    uid = user.uid;
  } catch (e: any) {
    const fbCode = String(e?.errorInfo?.code ?? e?.code ?? "");
    if (fbCode.includes("email-already-exists")) {
      return json(
        {
          success: false,
          error: "EMAIL_ALREADY_REGISTERED",
          message: "This email is already registered. Use another email.",
          code: "EMAIL_ALREADY_REGISTERED",
          build: ADMIN_AUTH_BUILD,
        },
        409
      );
    }
    return json(
      {
        success: false,
        error: "AUTH_CREATE_FAILED",
        message: friendlyAuthError(e, "Unable to create admin account. Please try again."),
        code: "AUTH_CREATE_FAILED",
        build: ADMIN_AUTH_BUILD,
      },
      500
    );
  }

  /* ---- 6. adminUsers/{uid} — NON-SENSITIVE DATA ONLY ---------------------
     Written with the Admin SDK, so the strict Firestore rule stays intact. */
  try {
    await adminDb()
      .collection("adminUsers")
      .doc(uid)
      .set(
        {
          uid,
          name,
          email,
          role,
          active,
          createdAt: new Date(),
          createdAtMs: Date.now(),
          createdBy: caller.uid,
          createdByEmail: caller.email,
        },
        { merge: true }
      );
  } catch (e: any) {
    // ---- ROLLBACK: never leave an orphan Firebase Auth account ------------
    console.error("[create-user] Firestore write failed, rolling back Auth user", uid, e);
    let rolledBack = true;
    try {
      await adminAuth().deleteUser(uid);
    } catch (delErr) {
      rolledBack = false;
      console.error("[create-user] ROLLBACK FAILED — orphan auth user:", uid, delErr);
    }
    return json(
      {
        success: false,
        error: rolledBack ? "FIRESTORE_WRITE_FAILED" : "ORPHAN_AUTH_USER",
        message: rolledBack
          ? "Could not save the administrator record, so the new login was rolled back. Please try again."
          : `The account was partially created (UID ${uid}). Contact the developer to clean it up.`,
        code: rolledBack ? "FIRESTORE_WRITE_FAILED" : "ORPHAN_AUTH_USER",
        build: ADMIN_AUTH_BUILD,
      },
      500
    );
  }

  /* ---- Custom claim: server-trusted role for API authorization ------------
     Non-critical — the adminUsers record is already the source of truth, so a
     failure here must not corrupt or roll back the account. */
  let claimSet = true;
  try {
    await adminAuth().setCustomUserClaims(uid, { role, admin: true });
  } catch (e) {
    claimSet = false;
    console.warn("[create-user] setCustomUserClaims failed (non-fatal):", e);
  }

  /* ---- 7/8. Activity log (after success, never fatal) --------------------- */
  await logServerActivity({
    adminUid: caller.uid,
    adminName: caller.name,
    adminEmail: caller.email,
    role: caller.role,
    action: "CREATE_ADMIN_USER",
    entity: "adminUser",
    entityId: uid,
    description: `Created a new ${ROLE_LABEL[role]} account for ${name} (${email})`,
    changes: { role, active },
  });

  return json({
    success: true,
    uid,
    user: { uid, name, email, role, active },
    claimSet,
    build: ADMIN_AUTH_BUILD,
    message: "Admin user created successfully",
  });
}
