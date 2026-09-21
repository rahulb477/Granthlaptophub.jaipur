/**
 * GLOBAL SEO SETTINGS — canonical schema for siteSettings/seo.
 *
 * The Admin Panel writes this document; the customer website reads it (either
 * directly from Firestore or via GET /api/public/site-config) and uses it to
 * render <title>, <meta name="description">, keywords, favicon, canonical and
 * all Open Graph / Twitter tags.
 *
 * Legacy field names already present in the live document are mapped, never
 * duplicated: `siteTitle`, `metaDescription`, `keywords`, `ogImage`, `pages`.
 */
import { num, str } from "./firestore-sanitize";

export interface PageSeo {
  title: string;
  desc: string;
}

export interface SeoSettings {
  /* --- global --- */
  siteTitle: string;
  metaDescription: string;
  keywords: string;
  canonicalUrl: string;
  robots: string;
  favicon: string;
  /* --- social / open graph --- */
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  socialTitle: string;
  socialDescription: string;
  twitterCard: string;
  /* --- per route --- */
  pages: Record<string, PageSeo>;
  updatedAt?: unknown;
}

export const SEO_PAGE_KEYS: { key: string; label: string; route: string }[] = [
  { key: "home", label: "Homepage", route: "/" },
  { key: "shop", label: "Shop", route: "/shop" },
  { key: "about", label: "About", route: "/about" },
  { key: "contact", label: "Contact", route: "/contact" },
  { key: "compare", label: "Compare", route: "/compare" },
];

export const SEO_DEFAULTS: SeoSettings = {
  siteTitle: "Granth Laptop Hub — Refurbished & New Laptops",
  metaDescription:
    "Granth Laptop Hub, Jaipur — certified refurbished & new laptops with warranty assistance, EMI & COD.",
  keywords: "laptops jaipur, refurbished laptops, granth laptop hub",
  canonicalUrl: "",
  robots: "index, follow",
  favicon: "",
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  socialTitle: "",
  socialDescription: "",
  twitterCard: "summary_large_image",
  pages: Object.fromEntries(SEO_PAGE_KEYS.map((p) => [p.key, { title: "", desc: "" }])),
};

function pick(d: Record<string, any>, keys: string[], fallback = ""): string {
  for (const k of keys) {
    const v = str(d?.[k]);
    if (v) return v;
  }
  return fallback;
}

/** Reads any stored shape (canonical or legacy) into the canonical schema. */
export function normalizeSeo(raw: Record<string, any> | null | undefined): SeoSettings {
  const d = raw ?? {};

  const pages: Record<string, PageSeo> = {};
  for (const { key } of SEO_PAGE_KEYS) {
    const p = (d.pages ?? {})[key] ?? {};
    pages[key] = {
      title: str(p.title),
      // legacy docs used `desc`; also accept `description`
      desc: str(p.desc) || str(p.description),
    };
  }
  // Preserve any extra page keys the site may have added.
  for (const [k, v] of Object.entries((d.pages ?? {}) as Record<string, any>)) {
    if (!pages[k]) pages[k] = { title: str(v?.title), desc: str(v?.desc) || str(v?.description) };
  }

  const siteTitle = pick(d, ["siteTitle", "title", "defaultTitle"], SEO_DEFAULTS.siteTitle);
  const metaDescription = pick(
    d,
    ["metaDescription", "description", "defaultDescription"],
    SEO_DEFAULTS.metaDescription
  );
  const ogImage = pick(d, ["ogImage", "shareImage", "socialImage"]);

  return {
    siteTitle,
    metaDescription,
    keywords: pick(d, ["keywords", "defaultKeywords", "metaKeywords"], SEO_DEFAULTS.keywords),
    canonicalUrl: pick(d, ["canonicalUrl", "canonical", "siteUrl"]),
    robots: pick(d, ["robots", "robotsTag"], SEO_DEFAULTS.robots),
    favicon: pick(d, ["favicon", "faviconUrl"]),
    // Social tags fall back to the global values so the site always has content.
    ogTitle: pick(d, ["ogTitle", "openGraphTitle"]) || siteTitle,
    ogDescription: pick(d, ["ogDescription", "openGraphDescription"]) || metaDescription,
    ogImage,
    socialTitle: pick(d, ["socialTitle"]) || pick(d, ["ogTitle"]) || siteTitle,
    socialDescription: pick(d, ["socialDescription"]) || pick(d, ["ogDescription"]) || metaDescription,
    twitterCard: pick(d, ["twitterCard"], SEO_DEFAULTS.twitterCard),
    pages,
    updatedAt: d.updatedAt,
  };
}

/** Keyword string → array, for the customer site's metadata API. */
export function keywordList(keywords: string): string[] {
  return String(keywords || "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

/** Resolves the effective metadata for a given route. */
export function resolvePageSeo(seo: SeoSettings, pageKey: string): { title: string; description: string } {
  const p = seo.pages?.[pageKey];
  return {
    title: (p?.title || "").trim() || seo.siteTitle,
    description: (p?.desc || "").trim() || seo.metaDescription,
  };
}

/* ---------------------------------------------------------------- *
 * Business / shop settings (siteSettings/main) — live CMS contract  *
 * ---------------------------------------------------------------- */

export interface BusinessSettings {
  businessName: string;
  city: string;
  state: string;
  location: string;
  phone: string;
  whatsapp: string;
  /** Ready-to-use wa.me link built from the normalised number. */
  whatsappLink: string;
  email: string;
  address: string;
  openingHours: string;
  logo: string;
  favicon: string;
  instagram: string;
  instagramUrl: string;
  warrantyText: string;
  returnText: string;
  codAvailable: boolean;
  emiAvailable: boolean;
  updatedAt?: unknown;
}

/**
 * Normalises an Indian phone number to a wa.me-safe form.
 * Accepts "+91XXXXXXXXXX", "91XXXXXXXXXX", "XXXXXXXXXX", spaces, dashes.
 * Returns "" when the input cannot produce a valid link (never a broken URL).
 */
export function normalizeWhatsapp(raw: string): { digits: string; link: string } {
  const digits = String(raw || "").replace(/\D/g, "");
  if (!digits) return { digits: "", link: "" };

  let national = digits;
  if (national.startsWith("0")) national = national.replace(/^0+/, "");
  // Strip a leading country code if present.
  if (national.length > 10 && national.startsWith("91")) national = national.slice(2);

  // A valid Indian mobile is 10 digits starting 6-9.
  if (national.length === 10 && /^[6-9]/.test(national)) {
    return { digits: `91${national}`, link: `https://wa.me/91${national}` };
  }
  // Already an international number of plausible length — use as-is.
  if (digits.length >= 11 && digits.length <= 15) {
    return { digits, link: `https://wa.me/${digits}` };
  }
  return { digits, link: "" };
}

/** Normalises an Instagram handle/URL pair into a usable profile link. */
export function normalizeInstagram(handle: string, url: string): { handle: string; url: string } {
  const h = String(handle || "").trim().replace(/^@/, "");
  const u = String(url || "").trim();
  if (u) {
    const withProto = /^https?:\/\//i.test(u) ? u : `https://${u}`;
    return { handle: h ? `@${h}` : "", url: withProto };
  }
  if (h) return { handle: `@${h}`, url: `https://www.instagram.com/${h}` };
  return { handle: "", url: "" };
}

export const BUSINESS_DEFAULTS: BusinessSettings = {
  businessName: "Granth Laptop Hub",
  city: "Jaipur",
  state: "Rajasthan",
  location: "Jaipur, Rajasthan",
  phone: "",
  whatsapp: "",
  whatsappLink: "",
  email: "",
  address: "",
  openingHours: "",
  logo: "",
  favicon: "",
  instagram: "",
  instagramUrl: "",
  warrantyText: "",
  returnText: "",
  codAvailable: true,
  emiAvailable: true,
};

/** Reads siteSettings/main into a stable, customer-site-ready shape. */
export function normalizeBusiness(raw: Record<string, any> | null | undefined): BusinessSettings {
  const d = raw ?? {};
  const businessName = pick(d, ["businessName", "name", "shopName"], BUSINESS_DEFAULTS.businessName);
  const city = pick(d, ["city"], BUSINESS_DEFAULTS.city);
  const state = pick(d, ["state"], BUSINESS_DEFAULTS.state);
  const wa = normalizeWhatsapp(pick(d, ["whatsapp", "whatsappNumber", "phone"]));
  const ig = normalizeInstagram(pick(d, ["instagram", "instagramHandle"]), pick(d, ["instagramUrl", "instagramLink"]));

  return {
    businessName,
    city,
    state,
    location: pick(d, ["location"], [city, state].filter(Boolean).join(", ")),
    phone: pick(d, ["phone", "callingNumber", "contactNumber"]),
    whatsapp: wa.digits,
    whatsappLink: wa.link,
    email: pick(d, ["email", "contactEmail"]),
    address: pick(d, ["address", "storeAddress"]),
    openingHours: pick(d, ["openingHours", "hours", "timings"]),
    logo: pick(d, ["logo", "logoUrl"]),
    favicon: pick(d, ["favicon", "faviconUrl"]),
    instagram: ig.handle,
    instagramUrl: ig.url,
    warrantyText: pick(d, ["warrantyText", "warranty"]),
    returnText: pick(d, ["returnText", "returnPolicy"]),
    codAvailable: d.codAvailable !== false,
    emiAvailable: d.emiAvailable !== false,
    updatedAt: d.updatedAt,
  };
}

/** Rating helper used by the public config payload. */
export function safeNumber(v: unknown, fallback = 0): number {
  return num(v, fallback);
}
