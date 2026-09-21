import { auth } from "./firebase";
import { browserLocalPersistence, setPersistence } from "firebase/auth";

/**
 * ADMIN SESSION CONTRACT
 *
 * Every Admin Panel API call goes through `authenticatedAdminFetch` (or the
 * `useAdminFetch` hook) — never through a hand-rolled `fetch` with a manually
 * stored token. This guarantees:
 *
 *   1. The token always comes from the live Firebase Auth user (not from
 *      localStorage, cookies or React state), so revoked/expired sessions
 *      are detected immediately.
 *   2. The token is force-refreshed on every call so custom-claim changes
 *      (role updates, deactivation) take effect within one request.
 *   3. Only a real HTTP 401 (or a missing current user) produces the
 *      "session expired" message. A 403, 409 or 500 from the server does NOT
 *      sign the user out or pretend their session is gone.
 *
 * Persistence is set to `browserLocalPersistence` during module initialisation
 * so a page reload does not drop the authenticated session. Firebase Auth
 * restores the session from IndexedDB/localStorage automatically; the provider
 * just has to wait for `onAuthStateChanged` to fire before making calls.
 */

export class AdminSessionError extends Error {
  code: "ADMIN_SESSION_EXPIRED" | "ADMIN_TOKEN_UNAVAILABLE" | "ADMIN_AUTH_LOADING";
  constructor(
    code: "ADMIN_SESSION_EXPIRED" | "ADMIN_TOKEN_UNAVAILABLE" | "ADMIN_AUTH_LOADING",
    message: string
  ) {
    super(message);
    this.name = "AdminSessionError";
    this.code = code;
  }
}

let persistenceSet = false;
let persistencePromise: Promise<void> | null = null;

/**
 * Sets Firebase Auth to persist across reloads. Called once per session; safe
 * to call repeatedly. If `setPersistence` fails (e.g. private browsing with
 * disabled storage), the session still works in-memory — we never throw.
 */
export async function ensureAuthPersistence(): Promise<void> {
  if (persistenceSet) return;
  if (!persistencePromise) {
    persistencePromise = setPersistence(auth, browserLocalPersistence)
      .then(() => {
        persistenceSet = true;
        console.log("ADMIN AUTH PERSISTENCE: browserLocalPersistence");
      })
      .catch((e) => {
        // Non-fatal: the session continues working, it just won't survive a
        // reload in this browser. Log for diagnosis, do not break login.
        console.warn("ADMIN AUTH PERSISTENCE: fallback (no local storage):", e?.message);
        persistenceSet = true;
      });
  }
  return persistencePromise;
}

/**
 * Returns the current Firebase user, waiting for Auth to finish its initial
 * state restoration if it hasn't already. Resolves with `null` only when Auth
 * has truly reported "no user signed in" — not during the transient loading
 * window right after a page reload.
 *
 * The returned user is the SAME singleton the rest of the app sees; this does
 * NOT create a second Auth instance.
 */
export function getCurrentUserAfterInit(timeoutMs = 8000): Promise<import("firebase/auth").User | null> {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsub();
      resolve(auth.currentUser);
    }, timeoutMs);

    const unsub = auth.onAuthStateChanged((u) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unsub();
      resolve(u);
    });
  });
}

/**
 * Returns a fresh Firebase ID token for the current admin session.
 *
 * Throws `AdminSessionError` with one of three codes when the call cannot be
 * made — the caller (UI) decides whether to show "session expired" or simply
 * keep the page usable. The token itself is never included in the error.
 *
 * Safe diagnostics are logged: uid, email, project id. Never the token.
 */
export async function getFreshAdminIdToken(): Promise<string> {
  const user = await getCurrentUserAfterInit();

  if (!user) {
    throw new AdminSessionError(
      "ADMIN_SESSION_EXPIRED",
      "Your admin session has expired. Please log in again."
    );
  }

  console.log(
    [
      "\nADMIN SESSION DEBUG",
      `  uid:           ${user.uid}`,
      `  email:         ${user.email ?? "(no email)"}`,
      `  projectId:     ${auth.app.options.projectId ?? "(unknown)"}`,
      `  authenticated: true`,
    ].join("\n")
  );

  let token: string;
  try {
    // `true` forces a refresh so custom-claim changes and revocations are
    // picked up on the very next request.
    token = await user.getIdToken(true);
  } catch (e: any) {
    // auth/token-expired, auth/network-request-failed, auth/invalid-api-key...
    // None of these should masquerade as a silent 500 — they're all session
    // issues from the user's point of view.
    const code = String(e?.code ?? "");
    if (code.includes("auth/network") || code.includes("auth/token-expired")) {
      throw new AdminSessionError(
        "ADMIN_TOKEN_UNAVAILABLE",
        "Could not refresh your admin session token. Please check your connection and try again."
      );
    }
    if (code.includes("auth/user-token-expired")) {
      throw new AdminSessionError(
        "ADMIN_SESSION_EXPIRED",
        "Your admin session has expired. Please log in again."
      );
    }
    throw new AdminSessionError(
      "ADMIN_TOKEN_UNAVAILABLE",
      "Could not refresh your admin session token. Please log in again."
    );
  }

  if (!token) {
    throw new AdminSessionError(
      "ADMIN_TOKEN_UNAVAILABLE",
      "Your admin session has expired. Please log in again."
    );
  }

  return token;
}

/**
 * The canonical fetch wrapper for every `/api/admin/*` call.
 *
 *   - attaches a fresh Bearer token from `auth.currentUser`
 *   - maps ONLY a real HTTP 401 (or `ADMIN_SESSION_EXPIRED` / `ADMIN_TOKEN_INVALID`
 *     from the server) to the "session expired" user-facing message
 *   - leaves 403 / 409 / 500 with their real server-supplied message
 *   - never signs the user out as a side effect
 */
export async function authenticatedAdminFetch(
  url: string,
  init: RequestInit = {}
): Promise<{ response: Response; body: any }> {
  console.log("[CLIENT] authenticatedAdminFetch called for:", url);
  
  let token: string;
  try {
    token = await getFreshAdminIdToken();
    console.log("[CLIENT] Token obtained successfully, length:", token?.length);
  } catch (e) {
    console.error("[CLIENT] Failed to get token:", e);
    throw e;
  }

  if (!token) {
    console.error("[CLIENT] Token is empty or null");
    throw new AdminSessionError(
      "ADMIN_TOKEN_UNAVAILABLE",
      "Could not obtain authentication token."
    );
  }

  // Build headers object explicitly
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // Merge any existing headers from init
  if (init.headers) {
    if (init.headers instanceof Headers) {
      init.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (typeof init.headers === "object") {
      Object.assign(headers, init.headers);
    }
  }

  console.log("[CLIENT] Final headers to send:");
  console.log("[CLIENT]   - Content-Type:", headers["Content-Type"]);
  console.log("[CLIENT]   - Authorization present:", !!headers.Authorization);
  console.log("[CLIENT]   - Authorization length:", headers.Authorization?.length || 0);
  console.log("[CLIENT]   - Authorization starts with 'Bearer ':", headers.Authorization?.startsWith("Bearer "));

  const fetchInit: RequestInit = {
    method: init.method || "GET",
    headers,
    body: init.body,
    mode: init.mode,
    credentials: init.credentials,
    cache: init.cache,
    redirect: init.redirect,
    referrer: init.referrer,
    integrity: init.integrity,
  };

  console.log("[CLIENT] Making fetch request...");

  let response: Response;
  try {
    response = await fetch(url, fetchInit);
    console.log("[CLIENT] Fetch completed, status:", response.status);
  } catch (e) {
    console.error("[CLIENT] Fetch failed:", e);
    throw e;
  }

  let body: any = {};
  try {
    body = await response.json();
    console.log("[CLIENT] Response body parsed:", { success: body.success, error: body.error, code: body.code });
  } catch {
    console.warn("[CLIENT] Could not parse response as JSON");
    body = {};
  }

  return { response, body };
}

/**
 * Classifies the result of an admin API call into a user-facing error.
 *
 * ONLY the cases below are rendered as "session expired":
 *   - HTTP 401
 *   - server code AUTH_TOKEN_MISSING / AUTH_TOKEN_INVALID / NOT_AUTHENTICATED
 *
 * 403 (permission), 409 (duplicate email), 500 (server config), 400 (validation)
 * are returned with the server's actual message — the UI must NOT reframe
 * them as "session expired" and must NOT sign the user out.
 */
export function classifyAdminError(status: number, body: any): {
  kind: "session" | "permission" | "conflict" | "config" | "validation" | "server";
  message: string;
} {
  const code = String(body?.error ?? body?.code ?? "");
  const serverMsg = String(body?.message ?? "");

  // Real authentication failures — the ONLY category that becomes "expired".
  const authCodes = new Set([
    "NOT_AUTHENTICATED",
    "AUTH_TOKEN_MISSING",
    "AUTH_TOKEN_INVALID",
    "ADMIN_SESSION_EXPIRED",
    "ADMIN_TOKEN_UNAVAILABLE",
    "ADMIN_AUTH_LOADING",
  ]);
  if (status === 401 || authCodes.has(code)) {
    return {
      kind: "session",
      message: "Your admin session has expired. Please log in again.",
    };
  }

  if (status === 403) {
    return {
      kind: "permission",
      message:
        serverMsg ||
        "Your account does not have permission to create admin users.",
    };
  }

  if (status === 409) {
    return {
      kind: "conflict",
      message: serverMsg || "This email is already registered. Use another email.",
    };
  }

  if (status === 400) {
    return {
      kind: "validation",
      message: serverMsg || "Please check the form and try again.",
    };
  }

  if (status === 500 || status === 503) {
    return {
      kind: "config",
      message:
        serverMsg ||
        "Admin user creation service is temporarily unavailable. Please try again.",
    };
  }

  return { kind: "server", message: serverMsg || `Request failed (HTTP ${status}).` };
}
