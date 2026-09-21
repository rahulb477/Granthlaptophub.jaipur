/**
 * GET /api/admin/notifications
 *
 * Firebase-architecture safe: this route intentionally performs NO database
 * I/O. The Admin Panel reads live data directly from Firestore on the
 * client (see src/lib/firestore-service.ts), so the notification bell
 * derives its counts there. This endpoint exists only so existing callers
 * never crash — it always returns an empty, honest result.
 *
 * NOTE: deliberately imports NOTHING from @/db, @/lib/api, @/lib/auth or
 * @/lib/site (legacy Postgres layer) so `npm run build` never requires
 * DATABASE_URL.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ success: true, notifications: [] });
}
