"use client";
import React, { useEffect, useState } from "react";
import {
  getDocData,
  setDocData,
  getProducts,
  FirestoreProduct,
} from "@/lib/firestore-service";
import { ImageUploader } from "@/admin/image-uploader";
import { CUSTOMER_WEBSITE_URL } from "@/lib/firebase";
import { sanitizeFirestoreData } from "@/lib/firestore-sanitize";
import { logAdminAction } from "@/lib/activity";

export default function HomepageCMSPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [products, setProducts] = useState<FirestoreProduct[]>([]);

  // Homepage CMS data in Firestore /homepage/content
  const [homepage, setHomepage] = useState({
    heroBadge: "100% Genuine Billed Refurbished Laptops",
    heroHeading: "Empower Your Work with Premium Refurbished Laptops",
    heroHighlight: "Premium Refurbished Laptops",
    heroDescription:
      "Carefully tested, certified, and guaranteed with up to 1-Year Warranty. Save up to 70% compared to new laptops.",
    heroImage: "/images/hero-laptop.png",
    heroCtaText: "Shop Best Sellers",
    heroCtaLink: "#best-sellers",
    trustItems: [
      { id: "1", title: "100% Genuine", desc: "GST Billed Products", icon: "badge" },
      { id: "2", title: "Warranty", desc: "Up to 1 Year Assistance", icon: "shield" },
      { id: "3", title: "Fast Delivery", desc: "Safe Doorstep Dispatch", icon: "truck" },
      { id: "4", title: "Best Value", desc: "Up to 70% Savings", icon: "wallet" },
    ],
    spotlightBadge: "Live Deal of the Day",
    spotlightHeading: "Today's Spotlight Laptop",
    spotlightProductId: "",
    spotlightDiscountText: "Save ₹ 52,000",
  });

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [cmsData, prods] = await Promise.all([
          getDocData("homepage", "content"),
          getProducts(),
        ]);
        if (cmsData) {
          setHomepage((prev) => ({ ...prev, ...cmsData }));
        }
        setProducts(prods);
      } catch (err: any) {
        console.error("Load error:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      // sanitizeFirestoreData strips every `undefined` (optional CMS fields,
      // banners, product references) before the write. This is what fixes:
      //   "Unsupported field value: undefined (found in field discount ...)"
      const cmsPayload = sanitizeFirestoreData({
        ...homepage,
        heroImage: homepage.heroImage ?? "",
        spotlightProductId: homepage.spotlightProductId ?? "",
        spotlightDiscountText: homepage.spotlightDiscountText ?? "",
        trustItems: (homepage.trustItems ?? []).map((t) => ({
          id: t.id ?? "",
          title: t.title ?? "",
          desc: t.desc ?? "",
          icon: t.icon ?? "badge",
        })),
      });

      // Write to Firestore /homepage/content
      await setDocData("homepage", "content", cmsPayload);

      // Spotlight flag: MERGE-update only the two flag fields. saveProduct()
      // no longer rebuilds discount/specs/images for partial payloads, so the
      // referenced product keeps all of its existing data intact.
      if (homepage.spotlightProductId) {
        const { saveProduct } = await import("@/lib/firestore-service");
        const targetProd = products.find((p) => p.id === homepage.spotlightProductId);
        if (targetProd?.id) {
          await saveProduct({ spotlight: true, section: "spotlight" }, targetProd.id);
          // Clear the flag on any other product that still claims spotlight.
          await Promise.all(
            products
              .filter((p) => p.id && p.id !== targetProd.id && (p.spotlight === true || p.section === "spotlight"))
              .map((p) => saveProduct({ spotlight: false, section: "catalog" }, p.id))
          );
        }
      }

      void logAdminAction({
        action: "UPDATE",
        entity: "Homepage CMS",
        entityId: "homepage/content",
        description: `Homepage CMS updated${
          homepage.spotlightProductId
            ? ` — spotlight set to "${products.find((p) => p.id === homepage.spotlightProductId)?.name ?? homepage.spotlightProductId}"`
            : ""
        }`,
      });

      setSuccess("Homepage CMS updated successfully in Firestore! Changes are now reflected on the customer website.");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err: any) {
      console.error("Error saving homepage:", err);
      setError("Failed to save homepage settings: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTrustItemChange = (index: number, field: string, val: string) => {
    const updated = [...homepage.trustItems];
    updated[index] = { ...updated[index], [field]: val };
    setHomepage({ ...homepage, trustItems: updated });
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-400">Loading Homepage CMS from Firestore...</div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B88900]">Granth Laptop Hub</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">Homepage CMS Manager</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Controls the sections & text of the live customer website (
            <a href={CUSTOMER_WEBSITE_URL} target="_blank" rel="noopener noreferrer" className="text-[#B88900] underline font-semibold">
              laptop-web-iota.vercel.app
            </a>
            )
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={saving}
            className="adm-btn adm-btn-gold text-xs py-2 px-4 shadow-sm font-bold"
          >
            {saving ? "Saving to Firestore..." : "Save Homepage CMS"}
          </button>
        </div>
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center justify-between">
          <span>✓ {success}</span>
          <a
            href={CUSTOMER_WEBSITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-bold text-emerald-900"
          >
            View Customer Website ↗
          </a>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Hero Section Card */}
        <div className="adm-card p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
            Hero Section Text & Copy
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Top Badge / Announcement
            </label>
            <input
              type="text"
              value={homepage.heroBadge}
              onChange={(e) => setHomepage({ ...homepage, heroBadge: e.target.value })}
              className="adm-input text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Main Hero Heading
            </label>
            <textarea
              rows={2}
              value={homepage.heroHeading}
              onChange={(e) => setHomepage({ ...homepage, heroHeading: e.target.value })}
              className="adm-input text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Highlighted Heading Fragment
            </label>
            <input
              type="text"
              value={homepage.heroHighlight}
              onChange={(e) => setHomepage({ ...homepage, heroHighlight: e.target.value })}
              className="adm-input text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Hero Description Text
            </label>
            <textarea
              rows={3}
              value={homepage.heroDescription}
              onChange={(e) => setHomepage({ ...homepage, heroDescription: e.target.value })}
              className="adm-input text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Primary CTA Button
              </label>
              <input
                type="text"
                value={homepage.heroCtaText}
                onChange={(e) => setHomepage({ ...homepage, heroCtaText: e.target.value })}
                className="adm-input text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                CTA Target Anchor/Link
              </label>
              <input
                type="text"
                value={homepage.heroCtaLink}
                onChange={(e) => setHomepage({ ...homepage, heroCtaLink: e.target.value })}
                className="adm-input text-xs"
              />
            </div>
          </div>
        </div>

        {/* Hero Image Upload (ImgBB) Card */}
        <div className="space-y-5">
          <div className="adm-card p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
              Hero Image (ImgBB Upload)
            </h2>

            <ImageUploader
              value={homepage.heroImage}
              onChange={(url) => setHomepage({ ...homepage, heroImage: url })}
              folder="homepage"
              label="Hero Laptop Display Image"
              hint="Select → preview → Upload to ImgBB. High-resolution PNG or WebP with transparent background works best."
            />
          </div>

          {/* Spotlight / Deal of the Day Selection */}
          <div className="adm-card p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
              Today's Spotlight (Deal of the Day)
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Spotlight Product
              </label>
              <select
                value={homepage.spotlightProductId}
                onChange={(e) => setHomepage({ ...homepage, spotlightProductId: e.target.value })}
                className="adm-input text-xs"
              >
                <option value="">— Select from Firestore Products —</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (₹ {Number(p.price).toLocaleString("en-IN")})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Selecting this will flag the product with <code className="text-slate-600">spotlight: true</code> in Firestore.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Badge Text</label>
                <input
                  type="text"
                  value={homepage.spotlightBadge}
                  onChange={(e) => setHomepage({ ...homepage, spotlightBadge: e.target.value })}
                  className="adm-input text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Savings Text</label>
                <input
                  type="text"
                  value={homepage.spotlightDiscountText}
                  onChange={(e) => setHomepage({ ...homepage, spotlightDiscountText: e.target.value })}
                  className="adm-input text-xs"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="adm-card p-5 space-y-4 lg:col-span-2">
          <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
            Trust Badges & Strip Items
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {homepage.trustItems.map((item, idx) => (
              <div key={item.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <span className="text-[10px] font-bold uppercase text-[#B88900]">Badge #{idx + 1}</span>
                <input
                  type="text"
                  value={item.title}
                  onChange={(e) => handleTrustItemChange(idx, "title", e.target.value)}
                  placeholder="Title (e.g. 100% Genuine)"
                  className="adm-input text-xs font-bold"
                />
                <input
                  type="text"
                  value={item.desc}
                  onChange={(e) => handleTrustItemChange(idx, "desc", e.target.value)}
                  placeholder="Subtitle (e.g. GST Billed)"
                  className="adm-input text-xs"
                />
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="adm-btn adm-btn-gold text-xs py-2 px-4 shadow-sm font-bold"
            >
              {saving ? "Saving to Firestore..." : "Save Homepage CMS"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
