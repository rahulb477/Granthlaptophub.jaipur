/**
 * GET /api/health
 *
 * Liveness probe for the Firebase-based Admin Panel. Must NOT depend on
 * the legacy Postgres layer (DATABASE_URL is intentionally absent in
 * production). Returns ok:true when the Next.js server is up.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    app: "granth-laptop-hub-admin",
    backend: "firebase-firestore",
    time: new Date().toISOString(),
  });
}
