import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-session";

/**
 * /api/auth — Firebase architecture only.
 *
 * Admin authentication is performed entirely by Firebase Authentication in the
 * browser (see src/app/admin/login/page.tsx + src/lib/firebase-auth.tsx), and
 * authorization is resolved from adminUsers/{uid}.active === true and enforced
 * by Firestore security rules.
 *
 * This route previously queried the legacy Postgres `admin_users` table and
 * wrote activity records to Postgres, which cannot work without DATABASE_URL.
 * It now imports NOTHING from @/db, @/lib/api or @/lib/site, so it can never
 * initialise a database connection during build or runtime.
 *
 * The only behaviour still required by the Admin Panel is DELETE, which
 * `logout()` calls to clear any stale legacy session cookie. Admin activity is
 * logged to Firestore `activityLog` from the client (src/lib/activity.ts),
 * where the authenticated admin identity is available.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET — identity always comes from the Firebase client SDK, never from here. */
export async function GET() {
  return NextResponse.json({
    user: null,
    provider: "firebase-auth",
    note: "Admin identity is provided by the Firebase client session; this endpoint holds no session state.",
  });
}

/** POST — password login is handled by Firebase Auth in the browser. */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "Password sign-in is handled by Firebase Authentication in the Admin Panel, not by this endpoint.",
      provider: "firebase-auth",
    },
    { status: 410 }
  );
}

/** DELETE — clears the legacy session cookie (safe no-op when absent). */
export async function DELETE() {
  const out = NextResponse.json({ ok: true, provider: "firebase-auth" });
  out.cookies.delete(SESSION_COOKIE);
  return out;
}
