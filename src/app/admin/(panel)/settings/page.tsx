"use client";
import React, { useEffect, useState } from "react";
import {
  getDocData,
  setDocData,
} from "@/lib/firestore-service";
import { ImageUploader } from "@/admin/image-uploader";
import { CUSTOMER_WEBSITE_URL } from "@/lib/firebase";
import { logAdminAction } from "@/lib/activity";
import { useAdminAuth } from "@/lib/firebase-auth";
import { can } from "@/lib/permissions";
import { normalizeWhatsapp, normalizeInstagram } from "@/lib/seo-settings";

/**
 * Canonical branding for Granth Laptop Hub. Used ONLY as a form default for a
 * brand-new settings document and as the target of the explicit
 * "Apply canonical branding" action below — it is never written to Firestore
 * automatically, so existing stored values are never silently overwritten.
 */
const CANONICAL_BRANDING = {
  businessName: "Granth Laptop Hub",
  city: "Jaipur",
  state: "Rajasthan",
  location: "Jaipur, Rajasthan",
} as const;

/** Outdated branding tokens that should no longer appear in site settings. */
const STALE_TOKENS = ["maa karni", "maakarni", "jodhpur", "surat"];

function findStaleFields(obj: Record<string, unknown>): { field: string; value: string }[] {
  const out: { field: string; value: string }[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v !== "string" || !v.trim()) continue;
    const low = v.toLowerCase();
    if (STALE_TOKENS.some((t) => low.includes(t))) out.push({ field: k, value: v });
  }
  return out;
}

export default function SiteSettingsPage() {
  const { role } = useAdminAuth();
  const mayEdit = can(role, "settings", "update");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [settings, setSettings] = useState<Record<string, any> & {
    businessName: string; city: string; state: string; location: string;
    phone: string; whatsapp: string; email: string; address: string;
    instagram: string; instagramUrl: string; logo: string; favicon: string;
    warrantyText: string; returnText: string; codAvailable: boolean;
    emiAvailable: boolean; openingHours: string;
  }>({
    businessName: CANONICAL_BRANDING.businessName,
    city: String(CANONICAL_BRANDING.city),
    state: String(CANONICAL_BRANDING.state),
    location: String(CANONICAL_BRANDING.location),
    phone: "7413070733",
    whatsapp: "7413070733",
    email: "granthlaptophub@gmail.com",
    address: "Jaipur, Rajasthan",
    instagram: "@granthlaptophub",
    instagramUrl: "https://www.instagram.com/granthlaptophub",
    logo: "",
    favicon: "",
    warrantyText: "6 Months to 1 Year In-Store Warranty Assistance in Jaipur",
    returnText: "7 Days Easy Replacement for Manufacturing Defects",
    codAvailable: true,
    emiAvailable: true,
    openingHours: "Mon - Sat: 10:30 AM - 8:30 PM | Sun: 11:00 AM - 2:00 PM",
  });

  useEffect(() => {
    getDocData("siteSettings", "main")
      .then((data) => {
        if (data) setSettings((prev) => ({ ...prev, ...data }));
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const stale = findStaleFields(settings as unknown as Record<string, unknown>);

  /**
   * Fills the FORM with the canonical branding. The admin still has to press
   * Save, so nothing is written to Firestore without an explicit action, and
   * contact details (phone, WhatsApp, email, hours, logo) are left untouched.
   */
  const applyCanonicalBranding = () => {
    setSettings((prev) => ({
      ...prev,
      businessName: CANONICAL_BRANDING.businessName,
      city: CANONICAL_BRANDING.city,
      state: CANONICAL_BRANDING.state,
      location: CANONICAL_BRANDING.location,
      address: /jodhpur|surat|sardar market/i.test(prev.address || "")
        ? CANONICAL_BRANDING.location
        : prev.address,
      warrantyText: (prev.warrantyText || "").replace(/jodhpur|surat/gi, CANONICAL_BRANDING.city),
    }));
    setSuccess("");
    setError("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await setDocData("siteSettings", "main", settings);
      void logAdminAction({
        action: "SETTINGS",
        entity: "Site Settings",
        entityId: "siteSettings/main",
        description: `Site settings updated — ${settings.businessName}, ${settings.city}${
          settings.state ? ", " + settings.state : ""
        }`,
        changes: {
          businessName: settings.businessName,
          city: settings.city,
          state: settings.state,
          location: settings.location,
        },
      });
      setSuccess("Site Settings saved to Firestore /siteSettings/main successfully!");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      setError("Failed to save settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-400">Loading Site Settings from Firestore...</div>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B88900]">Granth Laptop Hub</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">Site Settings</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Document location: <code className="text-slate-700">/siteSettings/main</code> in Firestore
          </p>
        </div>

        <button type="submit" disabled={saving} className="adm-btn adm-btn-gold text-xs py-2 px-4 shadow-sm font-bold">
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {stale.length > 0 && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-[12px] text-amber-900 space-y-2">
          <p className="font-bold">
            Outdated branding / location detected in the stored settings document:
          </p>
          <ul className="space-y-0.5">
            {stale.map((f) => (
              <li key={f.field}>
                <code className="font-mono font-bold">{f.field}</code>: &ldquo;{f.value}&rdquo;
              </li>
            ))}
          </ul>
          <p>
            Canonical branding is <strong>{CANONICAL_BRANDING.businessName}</strong>,{" "}
            <strong>{CANONICAL_BRANDING.location}</strong>. Use the button below to fill the form, review
            it, then press <strong>Save Settings</strong> — nothing is written until you save, and phone /
            WhatsApp / email / hours are left untouched.
          </p>
          <button
            type="button"
            onClick={applyCanonicalBranding}
            className="adm-btn adm-btn-line text-[11px] py-1.5 px-3 font-bold"
          >
            Apply canonical branding to this form
          </button>
        </div>
      )}

      {success && <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold">✓ {success}</div>}
      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">{error}</div>}

      {!mayEdit && (
        <div className="p-3 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[11px]">
          Your role has read-only access to site settings.
        </div>
      )}

      {/* Live CMS connection status */}
      <div className="adm-card p-5">
        <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2 mb-3">
          Customer Website Connection
        </h2>
        <p className="text-[12px] text-slate-600">
          These values are the single source of truth in{" "}
          <code className="text-slate-800">siteSettings/main</code>. The storefront reads them live through{" "}
          <code className="text-slate-800">GET /api/public/site-config</code> (or directly from Firestore), so a
          save here reaches the site without a redeploy.
        </p>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-[11px] space-y-1">
            <p className="font-bold text-slate-700">Resolved WhatsApp link</p>
            {normalizeWhatsapp(settings.whatsapp).link ? (
              <a
                href={normalizeWhatsapp(settings.whatsapp).link}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-emerald-700 break-all hover:underline"
              >
                {normalizeWhatsapp(settings.whatsapp).link}
              </a>
            ) : (
              <p className="text-red-600 font-semibold">
                Invalid / empty number — the storefront button would be broken. Enter a 10-digit mobile.
              </p>
            )}
          </div>
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-[11px] space-y-1">
            <p className="font-bold text-slate-700">Resolved Instagram link</p>
            {normalizeInstagram(settings.instagram, settings.instagramUrl).url ? (
              <a
                href={normalizeInstagram(settings.instagram, settings.instagramUrl).url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[#B88900] break-all hover:underline"
              >
                {normalizeInstagram(settings.instagram, settings.instagramUrl).url}
              </a>
            ) : (
              <p className="text-slate-400">Not configured.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Business Contact */}
        <div className="adm-card p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Business & Contact Info</h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Business Name</label>
            <input type="text" value={settings.businessName} onChange={(e) => setSettings({ ...settings, businessName: e.target.value })} className="adm-input text-xs" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Calling Phone Number</label>
              <input type="text" value={settings.phone} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} className="adm-input text-xs" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">WhatsApp Business Number</label>
              <input type="text" value={settings.whatsapp} onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })} className="adm-input text-xs font-mono" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <input type="email" value={settings.email} onChange={(e) => setSettings({ ...settings, email: e.target.value })} className="adm-input text-xs" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
              <input type="text" value={settings.city} onChange={(e) => setSettings({ ...settings, city: e.target.value })} className="adm-input text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
              <input type="text" value={settings.state} onChange={(e) => setSettings({ ...settings, state: e.target.value })} placeholder="Rajasthan" className="adm-input text-xs" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Location Label</label>
              <input type="text" value={settings.location} onChange={(e) => setSettings({ ...settings, location: e.target.value })} placeholder="Jaipur, Rajasthan" className="adm-input text-xs" />
              <p className="text-[10px] text-slate-400 mt-0.5">Shown as the shop location on the customer website.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Store Address</label>
            <textarea rows={2} value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} className="adm-input text-xs" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Hours</label>
            <input type="text" value={settings.openingHours} onChange={(e) => setSettings({ ...settings, openingHours: e.target.value })} className="adm-input text-xs" />
          </div>
        </div>

        {/* Branding & Policies */}
        <div className="space-y-5">
          <div className="adm-card p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Site Logo & Favicon (ImgBB)</h2>
            <ImageUploader
              value={settings.logo}
              onChange={(url) => setSettings({ ...settings, logo: url })}
              folder="site"
              label="Upload Site Logo"
              hint="Select → preview → Upload to ImgBB. The customer website reads this exact Firestore field (siteSettings/main.logo)."
            />
            <ImageUploader
              value={settings.favicon}
              onChange={(url) => setSettings({ ...settings, favicon: url })}
              folder="site"
              label="Upload Favicon (optional)"
              hint="Small square icon for the browser tab. Hosted on ImgBB."
            />
          </div>

          <div className="adm-card p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Social & Online Presence</h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Instagram Handle</label>
              <input type="text" value={settings.instagram} onChange={(e) => setSettings({ ...settings, instagram: e.target.value })} className="adm-input text-xs" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Instagram Profile Link</label>
              <input type="text" value={settings.instagramUrl} onChange={(e) => setSettings({ ...settings, instagramUrl: e.target.value })} className="adm-input text-xs font-mono" />
            </div>
          </div>

          <div className="adm-card p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Store Policies & Features</h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Warranty Information</label>
              <input type="text" value={settings.warrantyText} onChange={(e) => setSettings({ ...settings, warrantyText: e.target.value })} className="adm-input text-xs" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Return / Replacement Policy</label>
              <input type="text" value={settings.returnText} onChange={(e) => setSettings({ ...settings, returnText: e.target.value })} className="adm-input text-xs" />
            </div>

            <div className="flex items-center gap-6 pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={!!settings.codAvailable} onChange={(e) => setSettings({ ...settings, codAvailable: e.target.checked })} className="rounded text-amber-600 focus:ring-amber-500" />
                <span>Cash on Delivery (COD)</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={!!settings.emiAvailable} onChange={(e) => setSettings({ ...settings, emiAvailable: e.target.checked })} className="rounded text-amber-600 focus:ring-amber-500" />
                <span>No-Cost & Card EMI</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
