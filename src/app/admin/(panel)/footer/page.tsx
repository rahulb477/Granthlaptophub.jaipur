"use client";
import React, { useEffect, useState } from "react";
import {
  getDocData,
  setDocData,
} from "@/lib/firestore-service";
import { logAdminAction } from "@/lib/activity";

export default function FooterPagesCMS() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [footer, setFooter] = useState({
    businessName: "GRANTH LAPTOP HUB",
    cityLabel: "Jaipur, Rajasthan",
    description: "Jaipur's trusted laptop destination for certified refurbished & new laptops. Tested, certified, with full warranty assistance.",
    copyright: "© 2025 Granth Laptop Hub, Jaipur, Rajasthan. All rights reserved.",
    links: [
      { label: "Best Sellers", href: "#best-sellers" },
      { label: "Trending Laptops", href: "#trending" },
      { label: "Refurbished", href: "#refurbished" },
      { label: "Student Laptops", href: "#student" },
    ],
  });

  useEffect(() => {
    getDocData("siteSettings", "footer")
      .then((data) => {
        if (data) setFooter((prev) => ({ ...prev, ...data }));
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await setDocData("siteSettings", "footer", footer);
      void logAdminAction({
        action: "SETTINGS",
        entity: "Footer",
        entityId: "siteSettings/footer",
        description: "Footer / pages configuration updated",
      });
      setSuccess("Footer configuration saved to Firestore!");
      setTimeout(() => setSuccess(""), 3500);
    } catch (err: any) {
      setError("Failed to save: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-slate-400">Loading footer settings...</div>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B88900]">Granth Laptop Hub</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">Footer & Pages Manager</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Controls footer text & navigation in Firestore <code className="text-slate-700">/siteSettings/footer</code>
          </p>
        </div>

        <button type="submit" disabled={saving} className="adm-btn adm-btn-gold text-xs py-2 px-4 shadow-sm font-bold">
          {saving ? "Saving..." : "Save Footer"}
        </button>
      </div>

      {success && <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold">✓ {success}</div>}
      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">{error}</div>}

      <div className="adm-card p-5 space-y-4 max-w-2xl">
        <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">Footer Content</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Business Name</label>
            <input type="text" value={footer.businessName} onChange={(e) => setFooter({ ...footer, businessName: e.target.value })} className="adm-input text-xs" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">City Label</label>
            <input type="text" value={footer.cityLabel} onChange={(e) => setFooter({ ...footer, cityLabel: e.target.value })} className="adm-input text-xs" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Footer Tagline / Bio</label>
          <textarea rows={3} value={footer.description} onChange={(e) => setFooter({ ...footer, description: e.target.value })} className="adm-input text-xs" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Copyright Line</label>
          <input type="text" value={footer.copyright} onChange={(e) => setFooter({ ...footer, copyright: e.target.value })} className="adm-input text-xs" />
        </div>
      </div>
    </form>
  );
}
