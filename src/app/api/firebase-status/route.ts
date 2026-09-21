import { firebaseConfig, CUSTOMER_WEBSITE_URL } from "@/lib/firebase";

export const dynamic = "force-dynamic";

/**
 * Verifies the Admin Panel is connected to the SAME Firebase project
 * as the customer (user) website, using the public Firestore REST API
 * with the owner-provided apiKey (no service-account secrets needed).
 */
async function restCount(collectionId: string, apiKey: string, projectId: string) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionId}?pageSize=100&key=${apiKey}`;
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return { ok: false, count: 0, status: r.status, error: text.slice(0, 300) };
    }
    const j = await r.json().catch(() => ({}));
    const docs = Array.isArray(j.documents) ? j.documents : [];
    return { ok: true, count: docs.length, status: 200, sample: docs[0]?.name ?? null };
  } catch (e: any) {
    return { ok: false, count: 0, status: 0, error: e?.message ?? "fetch failed" };
  }
}

async function checkCustomerSite(url: string) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    const html = await r.text().catch(() => "");
    const mentionsProject = html.includes("laptop-database-24873");
    return { ok: r.ok, status: r.status, mentionsProject };
  } catch (e: any) {
    return { ok: false, status: 0, mentionsProject: false, error: e?.message ?? "fetch failed" };
  }
}

export async function GET() {
  const { apiKey, projectId, authDomain, storageBucket, appId } = firebaseConfig;
  const collections = [
    "products",
    "categories",
    "brands",
    "blogPosts",
    "videos",
    "offers",
    "coupons",
    "users",
    "enquiries",
    "reviews",
  ];
  const results: Record<string, any> = {};
  for (const c of collections) {
    results[c] = await restCount(c, apiKey, projectId);
  }
  // siteSettings + homepage are single-doc config collections — check one known doc each
  const siteMain = await (async () => {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/siteSettings/main?key=${apiKey}`;
    try {
      const r = await fetch(url, { cache: "no-store" });
      return { ok: r.ok, status: r.status, exists: r.ok };
    } catch (e: any) {
      return { ok: false, status: 0, exists: false, error: e?.message };
    }
  })();
  const homeContent = await (async () => {
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/homepage/content?key=${apiKey}`;
    try {
      const r = await fetch(url, { cache: "no-store" });
      return { ok: r.ok, status: r.status, exists: r.ok };
    } catch (e: any) {
      return { ok: false, status: 0, exists: false, error: e?.message };
    }
  })();

  const customerSite = await checkCustomerSite(CUSTOMER_WEBSITE_URL);

  const firestoreOk = Object.values(results).some((v: any) => v.ok);
  return Response.json({
    projectId,
    authDomain,
    storageBucket,
    appId,
    customerWebsite: CUSTOMER_WEBSITE_URL,
    firestoreOk,
    collections: results,
    siteSettingsMain: siteMain,
    homepageContent: homeContent,
    customerSite,
    checkedAt: new Date().toISOString(),
  });
}
