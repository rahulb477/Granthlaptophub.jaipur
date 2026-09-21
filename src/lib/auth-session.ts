/**
 * Legacy session cookie name — kept in a dependency-free module so routes can
 * clear the cookie without importing the Postgres-backed `src/lib/auth.ts`
 * (which pulls in @/db and would otherwise initialise a database layer).
 *
 * The Admin Panel itself does not use cookie sessions: authentication is
 * Firebase Auth and authorization is adminUsers/{uid}.active === true.
 */
export const SESSION_COOKIE = "mkc_admin_session";
