import {
  authErrorStatus,
  cleanAuthError,
  isAdminSdkConfigured,
  logAuthCheck,
  verifyCaller,
  projectMismatch,
  ADMIN_AUTH_BUILD,
} from "@/lib/firebase-admin";
import { canManageAdminsFor, MASTER_SUPER_ADMIN_UID, ROLE_LABEL } from "@/lib/permissions";

/**
 * GET /api/admin/whoami  — authorization diagnostics.
 *
 * Answers, authoritatively and server-side:
 *   - did the server receive an ID token?
 *   - which UID did it decode?
 *   - does that UID match the master Super Admin?
 *   - does adminUsers/{uid} exist, what raw role does it hold, is it active?
 *   - what role was resolved, and may this caller manage admin users?
 *
 * Returns SAFE fields only — never the ID token, refresh token, password,
 * private key or service-account JSON. Requires a valid token, so it cannot
 * be used anonymously to probe the project.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET(req: Request) {
  const hasHeader = !!(req.headers.get("authorization") || req.headers.get("Authorization"));

  const pm = projectMismatch();

  if (!isAdminSdkConfigured()) {
    return json(
      {
        success: false,
        build: ADMIN_AUTH_BUILD,
        adminSdkConfigured: false,
        tokenReceived: hasHeader,
        clientProjectId: pm.client,
        serverProjectId: pm.server,
        error:
          "Firebase Admin credentials are not configured on the server. Set FIREBASE_SERVICE_ACCOUNT (or FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY).",
        code: "ADMIN_SDK_UNCONFIGURED",
      },
      503
    );
  }

  let caller;
  try {
    caller = await verifyCaller(req);
  } catch (e: any) {
    const msg = String(e?.message ?? "Unauthorized");
    return json(
      {
        success: false,
        build: ADMIN_AUTH_BUILD,
        adminSdkConfigured: true,
        tokenReceived: hasHeader,
        clientProjectId: pm.client,
        serverProjectId: pm.server,
        projectMatch: !pm.mismatch,
        error: cleanAuthError(msg),
        code: "AUTH",
      },
      authErrorStatus(msg)
    );
  }

  const canManage = canManageAdminsFor(caller.uid, caller.role);
  logAuthCheck("WHOAMI AUTH CHECK", {
    ...caller.diagnostics,
    authorizationResult: canManage ? "allowed" : "denied",
  });

  return json({
    success: true,
    build: ADMIN_AUTH_BUILD,
    adminSdkConfigured: true,
    tokenReceived: hasHeader,
    clientProjectId: pm.client,
    serverProjectId: pm.server,
    projectMatch: !pm.mismatch,
    uid: caller.uid,
    email: caller.email,
    name: caller.name,
    role: caller.role,
    roleLabel: ROLE_LABEL[caller.role],
    masterSuperAdminUid: MASTER_SUPER_ADMIN_UID,
    canManageAdminUsers: canManage,
    diagnostics: caller.diagnostics,
  });
}
