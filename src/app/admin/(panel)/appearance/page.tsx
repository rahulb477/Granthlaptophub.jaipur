"use client";
import React, { useEffect, useState } from "react";
import { PageHead, Card, Field, Loading, SaveBar } from "@/admin/lib";
import { getAppearance, saveAppearance, logActivity } from "@/lib/firestore-service";
import { useAdminAuth } from "@/lib/firebase-auth";
import { CUSTOMER_WEBSITE_URL } from "@/lib/firebase";

const DEFAULTS = {
  primary: "#16233a",
  accent: "#D6A600",
  accent2: "#E6BD33",
  bg: "#f6f3ec",
  surface: "#ffffff",
  text: "#233140",
  muted: "#66748a",
  line: "#e6e0d2",
  radius: "14px",
};

export default function AppearancePage() {
  const { user } = useAdminAuth();
  const [v, setV] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getAppearance()
      .then((d) => setV({ ...DEFAULTS, ...(d || {}) }))
      .catch((e) => {
        console.error(e);
        setV({ ...DEFAULTS });
      })
      .finally(() => setLoading(false));
  }, []);

  const setColor = (k: string, val: string) => setV((p: any) => ({ ...p, [k]: val }));

  async function save() {
    if (!v) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await saveAppearance(v);
      logActivity({
        adminId: user?.uid,
        adminName: user?.email ?? "admin",
        action: "update",
        entity: "siteSettings",
        entityId: "appearance",
        summary: "Appearance / brand colors updated",
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e?.message || "Save failed — check Firestore rules.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !v) return loading ? <Loading /> : null;

  return (
    <div>
      <PageHead
        title="Appearance"
        desc="Saved to Firestore /siteSettings/appearance — read by the customer website for brand identity."
      >
        <a href={CUSTOMER_WEBSITE_URL} target="_blank" rel="noreferrer" className="adm-btn adm-btn-line text-xs">
          View Website ↗
        </a>
      </PageHead>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card title="Brand Colors" action={<SaveBar saving={saving} saved={saved} error={error} />}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              ["primary", "Primary (navy)"],
              ["accent", "Gold accent"],
              ["accent2", "Gold accent 2"],
              ["bg", "Page background"],
              ["surface", "Card surface"],
              ["text", "Text"],
            ].map(([k, l]) => (
              <Field key={k} label={l}>
                <div className="flex items-center gap-2">
                  <input type="color" value={v[k]} onChange={(e) => setColor(k, e.target.value)} className="h-10 w-12 rounded-lg border border-slate-200 cursor-pointer" />
                  <input className="adm-input" value={v[k]} onChange={(e) => setColor(k, e.target.value)} />
                </div>
              </Field>
            ))}
            <Field label="Border radius">
              <select className="adm-input" value={v.radius} onChange={(e) => setColor("radius", e.target.value)}>
                {["8px", "12px", "14px", "18px", "24px"].map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
          </div>
          <button className="adm-btn adm-btn-gold mt-5" onClick={save} disabled={saving}>Save Appearance to Firestore</button>
          {error && <p className="text-[13px] text-red-600 font-semibold mt-2">{error}</p>}
          {saved && <p className="text-[13px] text-emerald-600 font-semibold mt-2">✓ Saved — customer site picks this up live.</p>}
        </Card>
        <Card title="Live Preview">
          <div className="rounded-xl border border-slate-200 p-4" style={{ background: v.bg }}>
            <div className="rounded-lg p-3 flex items-center gap-2" style={{ background: v.primary }}>
              <img src="/brand/granth-logo.png" alt="Granth Laptop Hub" className="w-8 h-8 rounded-lg object-contain bg-white p-0.5" />
              <span className="text-white text-[11px] font-bold">GRANTH LAPTOP HUB</span>
            </div>
            <div className="mt-3 p-4 rounded-xl border" style={{ background: v.surface, borderColor: v.line }}>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: v.accent }}>Customer favourites</p>
              <p className="font-bold mt-1" style={{ color: v.text }}>Best Sellers</p>
              <p className="text-[11px] mt-1" style={{ color: v.text, opacity: 0.7 }}>Dell Inspiron 15 · ₹54,990</p>
              <span className="btn btn-gold btn-sm mt-3 inline-block px-3 py-1.5 text-xs font-bold text-white rounded-lg" style={{ background: v.accent, borderRadius: `calc(${v.radius} - 4px)` }}>Add to Cart</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
