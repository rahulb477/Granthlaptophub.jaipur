# Granth Laptop Hub — Admin Panel & CMS

Back-office for **Granth Laptop Hub**, a laptop store in Jaipur, Rajasthan.
This app is a Next.js admin panel that manages the **live customer website**
(`https://laptop-web-iota.vercel.app/`, a separate deployment) by reading and
writing to the **same Firebase project** (`laptop-database-24873`). Every save
in this panel appears on the storefront immediately — no redeploy needed.

> The public storefront is **not** in this repository. This repository is the
> admin panel / CMS only; the root route redirects to `/admin`.

## Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Turbopack) + React 19 + TypeScript (strict) |
| Styling | Tailwind CSS 4 (design tokens in `src/app/globals.css` — navy/gold brand palette) |
| Data | Firebase **Firestore** (shared with the customer site) — primary store |
| Auth | Firebase **Authentication** (email/password) with custom-claim roles |
| Server-privileged ops | `firebase-admin` SDK (server-only, lazily initialized) |
| Images | Hosted on **ImgBB** via `POST /api/upload-image` (Firebase Storage is intentionally unused / deny-all) |
| Legacy layer | Drizzle ORM + PostgreSQL (`src/db/`) — build-safe, lazily initialized, **not required** |

## Getting started

```bash
npm install
cp .env.example .env     # then fill in real values (see table below)
npm run dev
```

Open `http://localhost:3000` — you'll be sent to the admin login.
Sign in with an administrator account (Firebase Auth). The primary/super-admin
UID is fixed in code (`src/lib/firebase.ts`); additional admins are created
inside the panel (Admin Users) with roles `superadmin`, `manager` or `staff`.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` **or** `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` | for user-management endpoints | Firebase Admin SDK (server only) — create/update admin users, reset passwords |
| `IMGBB_API_KEY` | for image uploads | ImgBB hosting key used by `POST /api/upload-image` |
| `DATABASE_URL` | no | Legacy Postgres layer only (unused by the Firebase architecture) |
| `NEXT_PUBLIC_FIREBASE_*` | no | Client overrides — defaults are baked in so both sites share one project |
| `NEXT_PUBLIC_CUSTOMER_WEBSITE_URL` | no | Customer site URL (defaults to the live Vercel deployment) |

The Firebase **web** config (apiKey, appId, …) is a public client key and is
baked into `src/lib/firebase.ts` with env-var overrides; it is not a secret.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (flat config, `eslint-config-next/core-web-vitals`) |
| `npm run typecheck` | `tsc --noEmit` |

## Architecture

```
src/
├── app/
│   ├── admin/
│   │   ├── login/            # Firebase Auth sign-in
│   │   └── (panel)/          # 20+ admin modules (Dashboard, Products, Orders,
│   │                         #   Customers, Enquiries, Homepage CMS, Videos,
│   │                         #   Blog, Offers & Coupons, Rewards, Reviews,
│   │                         #   Appearance, SEO, Site Settings, Analytics,
│   │                         #   Admin Users, Backup & Export, Activity Log,
│   │                         #   Website Connection, …)
│   └── api/                  # 21 route handlers (auth, admin user mgmt,
│                             #   collections CRUD, orders, reviews, uploads,
│                             #   public site-config, health/status, …)
├── admin/                    # Shared admin UI components (shell, editors, uploader)
├── lib/                      # Core modules: firebase config, admin session,
│                             #   firestore-service (all Firestore CRUD),
│                             #   permissions (role model), seo settings, …
└── db/                       # LEGACY Postgres layer (Drizzle) — optional,
                              #   build-safe proxy that throws a clear error if
                              #   called without DATABASE_URL
```

### Roles & authorization

- **superadmin** — everything, including administrator accounts.
- **manager** — all operational/content data, no admin-user management.
- **staff** — order processing + read-only catalogue.

Enforcement is layered:

1. `src/lib/permissions.ts` — UI + API role checks.
2. `firestore.rules` — the same rules mirrored in Firestore security rules, so
   restrictions hold even if a UI control is hidden or a URL is called directly.
3. `/api/admin/*` — server-side ID-token verification via the Admin SDK;
   custom claims (`role`) are authoritative.

### Data (Firestore collections shared with the customer site)

`products`, `categories`, `brands`, `blogPosts`, `videos`, `offers`, `reviews`,
`coupons`, `siteSettings`, `homepage`, `users`, `orders`, `enquiries` — plus
admin-only collections (`adminUsers`, `activityLog`). The **Website Connection**
page inside the panel verifies the link end-to-end.

### Images

All CMS images are uploaded to ImgBB (`POST /api/upload-image`) and the
resulting URLs are stored in Firestore. `storage.rules` deny all Firebase
Storage access by design.

## Deployment

Default Vercel Next.js deployment (no special config). Ensure the two required
server variables (`FIREBASE_SERVICE_ACCOUNT` and `IMGBB_API_KEY`) are set in
the hosting environment; without them the app still builds and runs, but the
respective features return a clear 503/"key missing" state (visible on the
Website Connection page).

## Security notes

- No secrets are committed. `FIREBASE_SERVICE_ACCOUNT` / `IMGBB_API_KEY` come
  from the environment (see `.env.example` for names only).
- `src/lib/firebase-admin.ts` is guarded with `server-only` and must never
  throw at import time, so builds succeed even where credentials are absent.
- Admin session handling lives in `src/lib/admin-session.ts` — all admin API
  calls go through `authenticatedAdminFetch`, which force-refreshes the token
  on every request so role changes/deactivations apply within one request.
