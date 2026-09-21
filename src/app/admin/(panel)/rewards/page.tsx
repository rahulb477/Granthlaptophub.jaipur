"use client";
import React, { useEffect, useState } from "react";
import {
  getFirstOrderReward,
  saveFirstOrderReward,
  FIRST_ORDER_REWARD_DEFAULTS,
  type FirstOrderRewardSettings,
} from "@/lib/firestore-service";
import { logAdminAction, inr } from "@/lib/activity";
import { CUSTOMER_WEBSITE_URL } from "@/lib/firebase";

/**
 * FIRST ORDER SCRATCH REWARD — fully admin configurable.
 *
 * Stored at Firestore siteSettings/firstOrderReward and read dynamically by
 * the customer website. The previously hardcoded ₹199 is now just the default
 * seed value; the admin can change amount, type, caps, code, copy and toggle
 * the whole feature off.
 */
export default function FirstOrderRewardPage() {
  const [form, setForm] = useState<FirstOrderRewardSettings>(FIRST_ORDER_REWARD_DEFAULTS);
  const [initial, setInitial] = useState<FirstOrderRewardSettings>(FIRST_ORDER_REWARD_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await getFirstOrderReward();
        setForm(data);
        setInitial(data);
      } catch (e: any) {
        setError(e?.message || "Could not load reward settings from Firestore.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = <K extends keyof FirstOrderRewardSettings>(k: K, v: FirestoreValue<K>) =>
    setForm((f) => ({ ...f, [k]: v }));

  type FirestoreValue<K extends keyof FirstOrderRewardSettings> = FirstOrderRewardSettings[K];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (!form.couponCode.trim()) throw new Error("Coupon code (or prefix) is required.");
      const saved = await saveFirstOrderReward(form);

      // Activity log AFTER the successful write; never blocks the save.
      const changes: string[] = [];
      if (initial.enabled !== saved.enabled) changes.push(saved.enabled ? "enabled" : "disabled");
      if (initial.rewardType !== saved.rewardType) changes.push(`type → ${saved.rewardType}`);
      if (initial.discountAmount !== saved.discountAmount)
        changes.push(`fixed amount ${inr(initial.discountAmount)} → ${inr(saved.discountAmount)}`);
      if (initial.discountPercent !== saved.discountPercent)
        changes.push(`discountPercent ${initial.discountPercent}% → ${saved.discountPercent}%`);
      if (initial.couponCode !== saved.couponCode)
        changes.push(`code ${initial.couponCode} → ${saved.couponCode}`);
      void logAdminAction({
        action: "SETTINGS",
        entity: "First Order Reward",
        entityId: "siteSettings/firstOrderReward",
        description:
          changes.length > 0
            ? `First-order scratch reward updated: ${changes.join(", ")}`
            : "First-order scratch reward settings saved",
        changes: saved as unknown as Record<string, unknown>,
      });

      setForm(saved);
      setInitial(saved);
      setSuccess("Saved to siteSettings/firstOrderReward — the customer website picks this up immediately.");
      setTimeout(() => setSuccess(""), 4000);
    } catch (e: any) {
      setError(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const preview =
    form.rewardType === "fixed"
      ? `Flat ${inr(form.discountAmount)} off`
      : `${form.discountPercent}% off (max ${inr(form.maxDiscount)})`;

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-400">Loading reward settings from Firestore…</div>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B88900]">Granth Laptop Hub</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">First Order Scratch Reward</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Stored in <code className="text-slate-700">siteSettings/firstOrderReward</code> and read dynamically by{" "}
            <a href={CUSTOMER_WEBSITE_URL} target="_blank" rel="noopener noreferrer" className="text-[#B88900] underline font-semibold">
              the customer website
            </a>
            . No amount is hardcoded any more.
          </p>
        </div>
        <button type="submit" disabled={saving} className="adm-btn adm-btn-gold text-xs px-4 py-2">
          {saving ? "Saving…" : "Save Reward Settings"}
        </button>
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
          ✓ {success}
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Enable / type */}
          <div className="adm-card p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Reward Configuration</h2>

            <label className="flex items-center justify-between gap-4 p-3 rounded-xl bg-slate-50">
              <div>
                <p className="text-xs font-bold text-slate-800">Enable first-order scratch card</p>
                <p className="text-[11px] text-slate-500">
                  When off, the customer website hides the scratch card entirely.
                </p>
              </div>
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => set("enabled", e.target.checked)}
                className="w-5 h-5"
              />
            </label>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reward Type</label>
                <select
                  value={form.rewardType}
                  onChange={(e) => set("rewardType", e.target.value as "fixed" | "percentage")}
                  className="adm-input text-xs"
                >
                  <option value="fixed">Fixed Discount (₹)</option>
                  <option value="percentage">Percentage Discount (%)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Minimum Order Value (₹)</label>
                <input
                  type="number"
                  value={form.minOrderValue}
                  onChange={(e) => set("minOrderValue", Number(e.target.value) || 0)}
                  className="adm-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fixed Discount (₹)</label>
                <input
                  type="number"
                  value={form.discountAmount}
                  onChange={(e) => set("discountAmount", Number(e.target.value) || 0)}
                  disabled={form.rewardType !== "fixed"}
                  className="adm-input text-xs disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Percentage (%)</label>
                <input
                  type="number"
                  value={form.discountPercent}
                  onChange={(e) => set("discountPercent", Number(e.target.value) || 0)}
                  disabled={form.rewardType !== "percentage"}
                  className="adm-input text-xs disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Maximum Discount (₹)</label>
                <input
                  type="number"
                  value={form.maxDiscount}
                  onChange={(e) => set("maxDiscount", Number(e.target.value) || 0)}
                  className="adm-input text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">Caps discountPercent rewards. 0 = no cap.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Expiry (days)</label>
                <input
                  type="number"
                  value={form.expiryDays}
                  onChange={(e) => set("expiryDays", Number(e.target.value) || 0)}
                  className="adm-input text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">0 = the unlocked reward never expires.</p>
              </div>
            </div>
          </div>

          {/* Code */}
          <div className="adm-card p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Reward Code</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Coupon Code {form.uniqueCode ? "(used as prefix)" : ""}
                </label>
                <input
                  type="text"
                  value={form.couponCode}
                  onChange={(e) => set("couponCode", e.target.value.toUpperCase())}
                  placeholder="FIRST199"
                  className="adm-input text-xs font-mono"
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 sm:mt-6">
                <input
                  type="checkbox"
                  checked={form.uniqueCode}
                  onChange={(e) => set("uniqueCode", e.target.checked)}
                />
                Generate a unique code per customer
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={form.firstOrderOnly}
                onChange={(e) => set("firstOrderOnly", e.target.checked)}
              />
              Restrict to genuine first orders only
            </label>
            <p className="text-[11px] text-slate-500 bg-slate-50 rounded-lg p-2.5">
              Eligibility is verified server-side against the customer&apos;s real order history in Firestore
              (<code>users/&#123;uid&#125;/orders</code> must be empty) — never from localStorage.
            </p>
          </div>

          {/* Copy */}
          <div className="adm-card p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Scratch Card Copy</h2>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Congratulations!"
                className="adm-input text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Message</label>
              <textarea
                rows={3}
                value={form.message}
                onChange={(e) => set("message", e.target.value)}
                placeholder="You unlocked a special first-order discount."
                className="adm-input text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Button Text</label>
              <input
                type="text"
                value={form.buttonText}
                onChange={(e) => set("buttonText", e.target.value)}
                placeholder="Apply Reward"
                className="adm-input text-xs"
              />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <div className="adm-card p-5">
            <p className="text-xs font-bold text-slate-800 mb-3">Customer Preview</p>
            <div
              className={`rounded-2xl p-5 text-center text-white ${form.enabled ? "" : "opacity-40 grayscale"}`}
              style={{ background: "linear-gradient(135deg,#0F172A,#1F2937)" }}
            >
              <p className="text-3xl">🎁</p>
              <p className="text-lg font-extrabold mt-1">{form.title || "Congratulations!"}</p>
              <p className="text-xs text-white/70 mt-1">{form.message}</p>
              <p className="mt-3 text-2xl font-extrabold text-[#D6A600]">{preview}</p>
              <p className="mt-1 font-mono text-xs text-white/80">{form.couponCode || "CODE"}</p>
              <span className="inline-block mt-3 px-4 py-1.5 rounded-full bg-[#D6A600] text-[#111827] text-xs font-bold">
                {form.buttonText || "Apply Reward"}
              </span>
              <p className="text-[10px] text-white/50 mt-3">
                {form.minOrderValue > 0 ? `Min. order ${inr(form.minOrderValue)}` : "No minimum order"}
                {form.expiryDays > 0 ? ` · valid ${form.expiryDays} days` : " · no expiry"}
              </p>
            </div>
            {!form.enabled && (
              <p className="text-[11px] text-slate-400 mt-2 text-center">Currently disabled — not shown to customers.</p>
            )}
          </div>

          <div className="adm-card p-4 text-[11px] text-slate-500 space-y-1.5">
            <p className="font-bold text-slate-700 text-xs">Customer website integration</p>
            <p>
              Read <code className="text-slate-800">siteSettings/firstOrderReward</code> and use these fields instead of
              any hardcoded value.
            </p>
            <pre className="bg-slate-900 text-slate-100 rounded-lg p-2.5 overflow-x-auto text-[10px] leading-relaxed">{`const s = await getDoc(doc(db,"siteSettings","firstOrderReward"));
const r = s.data();
const discount = r.rewardType === "fixed"
  ? r.discountAmount
  : Math.min(subtotal * r.discountPercent / 100, r.maxDiscount || Infinity);`}</pre>
          </div>
        </div>
      </div>
    </form>
  );
}
