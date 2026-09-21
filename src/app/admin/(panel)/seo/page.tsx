"use client";
import React, { useEffect, useState } from "react";
import { PageHead, Card, Field, Loading } from "@/admin/lib";
import { getSeoSettings, saveSeoSettings } from "@/lib/firestore-service";
import { logAdminAction } from "@/lib/activity";
import { ImageUploader } from "@/admin/image-uploader";
import { useAdminAuth } from "@/lib/firebase-auth";
import { can } from "@/lib/permissions";
import {
  normalizeSeo,
  SEO_DEFAULTS,
  SEO_PAGE_KEYS,
  keywordList,
  type SeoSettings,
} from "@/lib/seo-settings";

/**
 * GLOBAL SEO — writes siteSettings/seo, which the customer website consumes
 * (directly from Firestore, or through GET /api/public/site-config).
 */
export default function SeoPage() {
  const { role } = useAdminAuth();
  const mayEdit = can(role, "seo", "update");

  const [v, setV] = useState<SeoSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getSeoSettings()
      .then((d) => setV(normalizeSeo(d)))
      .catch(() => setV({ ...SEO_DEFAULTS }))
      .finally(() => setLoading(false));
  }, []);

  const set = (patch: Partial<SeoSettings>) => setV((prev) => (prev ? { ...prev, ...patch } : prev));
  const page = (k: string) => v?.pages?.[k] ?? { title: "", desc: "" };
  const setPage = (k: string, patch: Partial<{ title: string; desc: string }>) =>
    setV((prev) =>
      prev ? { ...prev, pages: { ...prev.pages, [k]: { ...page(k), ...patch } } } : prev
    );

  async function save() {
    if (!v || !mayEdit) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await saveSeoSettings(v);
      void logAdminAction({
        action: "SETTINGS",
        entity: "SEO",
        entityId: "siteSettings/seo",
        description: `Global SEO updated — title "${v.siteTitle}"`,
        changes: {
          siteTitle: v.siteTitle,
          metaDescription: v.metaDescription,
          keywords: v.keywords,
          ogImage: v.ogImage,
          favicon: v.favicon,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 4000);
    } catch (e: any) {
      setError(e?.message || "Save failed — check Firestore rules.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !v) return <Loading />;

  const titleLen = v.siteTitle.length;
  const descLen = v.metaDescription.length;

  return (
    <div>
      <PageHead
        title="SEO Settings"
        desc="Saved to Firestore /siteSettings/seo and served to the customer website via /api/public/site-config. Product & blog SEO stay in their own editors."
      >
        {mayEdit && (
          <button className="adm-btn adm-btn-gold text-xs" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save SEO Settings"}
          </button>
        )}
      </PageHead>

      {!mayEdit && (
        <div className="mb-4 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-[11px] px-4 py-3">
          Your role has read-only access to SEO settings.
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
      )}
      {saved && (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3">
          ✓ Saved to Firestore. The customer website picks this up on its next fetch (cached for ~60s).
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Global SEO">
          <div className="space-y-3.5">
            <Field label="Site title (browser tab + default <title>)">
              <input
                className="adm-input"
                disabled={!mayEdit}
                value={v.siteTitle}
                onChange={(e) => set({ siteTitle: e.target.value })}
                placeholder="Granth Laptop Hub — Refurbished & New Laptops"
              />
              <p className={`text-[10px] mt-0.5 ${titleLen > 60 ? "text-amber-600" : "text-slate-400"}`}>
                {titleLen}/60 characters {titleLen > 60 ? "— Google may truncate this" : ""}
              </p>
            </Field>

            <Field label="Meta description">
              <textarea
                rows={3}
                className="adm-input"
                disabled={!mayEdit}
                value={v.metaDescription}
                onChange={(e) => set({ metaDescription: e.target.value })}
              />
              <p className={`text-[10px] mt-0.5 ${descLen > 160 ? "text-amber-600" : "text-slate-400"}`}>
                {descLen}/160 characters {descLen > 160 ? "— may be truncated" : ""}
              </p>
            </Field>

            <Field label="Default keywords (comma separated)">
              <input
                className="adm-input"
                disabled={!mayEdit}
                value={v.keywords}
                onChange={(e) => set({ keywords: e.target.value })}
              />
              <div className="flex flex-wrap gap-1 mt-1">
                {keywordList(v.keywords).map((k) => (
                  <span key={k} className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600">{k}</span>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Canonical URL">
                <input
                  className="adm-input"
                  disabled={!mayEdit}
                  value={v.canonicalUrl}
                  onChange={(e) => set({ canonicalUrl: e.target.value })}
                  placeholder="https://laptop-web-iota.vercel.app"
                />
              </Field>
              <Field label="Robots">
                <select
                  className="adm-input"
                  disabled={!mayEdit}
                  value={v.robots}
                  onChange={(e) => set({ robots: e.target.value })}
                >
                  <option value="index, follow">index, follow</option>
                  <option value="noindex, follow">noindex, follow</option>
                  <option value="index, nofollow">index, nofollow</option>
                  <option value="noindex, nofollow">noindex, nofollow</option>
                </select>
              </Field>
            </div>

            <ImageUploader
              value={v.favicon || ""}
              onChange={(url) => set({ favicon: url })}
              folder="site"
              label="Favicon (browser tab icon)"
              hint="Uploads to ImgBB via the secure server endpoint. The customer site renders it as <link rel='icon'>."
            />
          </div>
        </Card>

        <Card title="Social sharing (Open Graph & Twitter)">
          <div className="space-y-3.5">
            <ImageUploader
              value={v.ogImage || ""}
              onChange={(url) => set({ ogImage: url })}
              folder="site"
              label="OG image (social share preview)"
              hint="Separate from the site logo. Recommended 1200×630. Only the ImgBB URL is stored in Firestore."
            />

            <Field label="OG title">
              <input
                className="adm-input"
                disabled={!mayEdit}
                value={v.ogTitle}
                onChange={(e) => set({ ogTitle: e.target.value })}
                placeholder="Falls back to the site title"
              />
            </Field>
            <Field label="OG description">
              <textarea
                rows={2}
                className="adm-input"
                disabled={!mayEdit}
                value={v.ogDescription}
                onChange={(e) => set({ ogDescription: e.target.value })}
                placeholder="Falls back to the meta description"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Social (Twitter) title">
                <input
                  className="adm-input"
                  disabled={!mayEdit}
                  value={v.socialTitle}
                  onChange={(e) => set({ socialTitle: e.target.value })}
                />
              </Field>
              <Field label="Twitter card type">
                <select
                  className="adm-input"
                  disabled={!mayEdit}
                  value={v.twitterCard}
                  onChange={(e) => set({ twitterCard: e.target.value })}
                >
                  <option value="summary_large_image">summary_large_image</option>
                  <option value="summary">summary</option>
                </select>
              </Field>
            </div>
            <Field label="Social (Twitter) description">
              <textarea
                rows={2}
                className="adm-input"
                disabled={!mayEdit}
                value={v.socialDescription}
                onChange={(e) => set({ socialDescription: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card title="Page-level SEO">
          <div className="space-y-4">
            {SEO_PAGE_KEYS.map(({ key, label, route }) => (
              <div key={key} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-bold text-slate-500 uppercase tracking-wide">{label}</p>
                  <code className="text-[10px] text-slate-400">{route}</code>
                </div>
                <div className="space-y-2">
                  <input
                    className="adm-input"
                    disabled={!mayEdit}
                    placeholder={`Title — defaults to "${v.siteTitle.slice(0, 40)}…"`}
                    value={page(key).title}
                    onChange={(e) => setPage(key, { title: e.target.value })}
                  />
                  <input
                    className="adm-input"
                    disabled={!mayEdit}
                    placeholder="Description — defaults to the global meta description"
                    value={page(key).desc}
                    onChange={(e) => setPage(key, { desc: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Customer website integration">
          <div className="space-y-3 text-[12px] text-slate-600">
            <p>
              The storefront reads this document live. Everything below updates without a redeploy.
            </p>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1.5 font-mono text-[11px]">
              <p className="text-slate-400">// Option A — one public endpoint (recommended)</p>
              <p>GET /api/public/site-config</p>
              <p className="text-slate-400 pt-1.5">// Option B — read Firestore directly</p>
              <p>getDoc(doc(db, &quot;siteSettings&quot;, &quot;seo&quot;))</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="font-bold text-slate-700 mb-1.5">Live preview of the tags the site will render</p>
              <pre className="bg-slate-900 text-slate-100 rounded-lg p-2.5 overflow-x-auto text-[10px] leading-relaxed">{`<title>${v.siteTitle}</title>
<meta name="description" content="${v.metaDescription.slice(0, 80)}…">
<meta name="keywords" content="${v.keywords.slice(0, 60)}…">
<meta name="robots" content="${v.robots}">
<link rel="icon" href="${v.favicon || "(not set)"}">
<meta property="og:title" content="${(v.ogTitle || v.siteTitle).slice(0, 60)}">
<meta property="og:image" content="${v.ogImage || "(not set)"}">
<meta name="twitter:card" content="${v.twitterCard}">`}</pre>
            </div>
            <p className="text-[11px] text-slate-500">
              Product and blog pages keep their own metadata (product name, description, image, brand,
              specifications / post title and excerpt) — those are unchanged.
            </p>
          </div>
        </Card>
      </div>

      {mayEdit && (
        <div className="mt-4">
          <button className="adm-btn adm-btn-gold" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save SEO Settings"}
          </button>
        </div>
      )}
    </div>
  );
}
