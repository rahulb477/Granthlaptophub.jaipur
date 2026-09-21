import { firebaseConfig } from "@/lib/firebase";
import {
  normalizeSeo,
  normalizeBusiness,
  keywordList,
  resolvePageSeo,
  SEO_PAGE_KEYS,
} from "@/lib/seo-settings";

/**
 * GET /api/public/site-config
 *
 * PUBLIC, read-only CMS feed for the customer website.
 *
 * It returns exactly the two documents the storefront needs to render its
 * branding and metadata — and nothing else:
 *   siteSettings/main  → business name, logo, phone, WhatsApp, Instagram,
 *                        address, opening hours, policies
 *   siteSettings/seo   → title, description, keywords, favicon, canonical,
 *                        robots, Open Graph / Twitter, per-page SEO
 *
 * Both documents are already publicly readable by design (the storefront must
 * render them for anonymous visitors), so this endpoint exposes nothing new.
 * No admin-only collection is touched, no credential is returned.
 *
 * It reads through the public Firestore REST API with the public web API key,
 * so it needs no service account and works on any host.
 *
 * Caching: `s-maxage=60, stale-while-revalidate=300` — an admin save appears
 * on the storefront within a minute without a redeploy, while shielding
 * Firestore from per-request reads. Pass `?fresh=1` to bypass.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROJECT = firebaseConfig.projectId;
const KEY = firebaseConfig.apiKey;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

/** Converts a Firestore REST value into a plain JS value. */
function decode(v: any): any {
  if (v === null || v === undefined) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(decode);
  if ("mapValue" in v) return decodeFields(v.mapValue.fields ?? {});
  return null;
}

function decodeFields(fields: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = decode(v);
  return out;
}

async function readDoc(path: string): Promise<Record<string, any> | null> {
  try {
    const r = await fetch(`${BASE}/${path}?key=${KEY}`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = await r.json();
    return decodeFields(j.fields ?? {});
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";

  const [mainRaw, seoRaw] = await Promise.all([
    readDoc("siteSettings/main"),
    readDoc("siteSettings/seo"),
  ]);

  const business = normalizeBusiness(mainRaw);
  const seo = normalizeSeo(seoRaw);

  // Favicon falls back to the site logo when not configured separately;
  // OG image stays a distinct field and is never substituted by the logo.
  const favicon = seo.favicon || business.favicon || "";

  const pages = Object.fromEntries(
    SEO_PAGE_KEYS.map(({ key, route }) => [
      key,
      { route, ...resolvePageSeo(seo, key) },
    ])
  );

  const body = {
    ok: true,
    source: {
      project: PROJECT,
      documents: ["siteSettings/main", "siteSettings/seo"],
      mainFound: !!mainRaw,
      seoFound: !!seoRaw,
    },
    business,
    seo: {
      ...seo,
      favicon,
      keywordList: keywordList(seo.keywords),
    },
    /** Ready-to-render metadata for each known route. */
    pages,
    /** Head tags the storefront can map 1:1. */
    head: {
      title: seo.siteTitle,
      description: seo.metaDescription,
      keywords: seo.keywords,
      canonical: seo.canonicalUrl,
      robots: seo.robots,
      icon: favicon,
      "og:title": seo.ogTitle || seo.siteTitle,
      "og:description": seo.ogDescription || seo.metaDescription,
      "og:image": seo.ogImage,
      "og:site_name": business.businessName,
      "twitter:card": seo.twitterCard,
      "twitter:title": seo.socialTitle || seo.ogTitle || seo.siteTitle,
      "twitter:description": seo.socialDescription || seo.ogDescription || seo.metaDescription,
      "twitter:image": seo.ogImage,
    },
    generatedAt: new Date().toISOString(),
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": fresh
        ? "no-store"
        : "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
