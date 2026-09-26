"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getProduct,
  saveProduct,
  deleteProduct,
  getBrands,
  getCategories,
  logActivity,
  FirestoreProduct,
} from "@/lib/firestore-service";
import { useAdminAuth } from "@/lib/firebase-auth";
import { can } from "@/lib/permissions";
import { ImageUploader, MultiImageUploader } from "@/admin/image-uploader";
import { OptionsEditor } from "@/admin/options-editor";
import { CUSTOMER_WEBSITE_URL } from "@/lib/firebase";
import { logAdminAction, inr } from "@/lib/activity";
import {
  readHardwareSpecs,
  normalizeOptions,
  computeConfiguredPrice,
  defaultOption,
  slugify,
  readCategoryName,
  type ProductOption,
} from "@/lib/product-specs";

function isNewProduct(id?: string) {
  return !id || id === "new";
}

export function ProductsEditor({ id }: { id?: string }) {
  const router = useRouter();
  const { user, role } = useAdminAuth();
  const mayWrite = can(role, "products", isNewProduct(id) ? "create" : "update");
  const mayDelete = can(role, "products", "delete");
  const isNew = !id || id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [originalSnapshot, setOriginalSnapshot] = useState<{
    name?: string;
    price?: number;
    stock?: number;
    status?: string;
  } | null>(null);
  const [brandsList, setBrandsList] = useState<string[]>([]);
  const [categoriesList, setCategoriesList] = useState<{ id: string; name: string; slug: string }[]>([]);
  /** Legacy variants[] found on the document — preserved, never edited here. */
  const [legacyVariants, setLegacyVariants] = useState<any[] | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);

  // Form state normalized to customer website schema
  const [formData, setFormData] = useState<FirestoreProduct>({
    name: "",
    brand: "LENOVO",
    price: 24999,
    originalPrice: 65000,
    discount: "",
    section: "",
    spotlight: false,
    featured: false,
    tag: "Student-friendly",
    tagColor: "green",
    rating: 4.5,
    reviews: 5,
    specs: ["Intel Core i5", "8GB", "256GB SSD"],
    processor: "Intel Core i5",
    generation: "",
    screenSize: "",
    ram: "8GB",
    storage: "256GB SSD",
    graphics: "",
    touch: false,
    operatingSystem: "Windows 11 pro",
    os: "Windows 11 pro",
    ramOptions: [],
    storageOptions: [],
    warrantyOptions: [],
    category: "",
    sku: "",
    slug: "",
    condition: "refurbished",
    warranty: "6 Months Warranty Assistance in Jaipur",
    returnPolicy: "7 Days Easy Replacement for Manufacturing Defects",
    description: "",
    image: "",
    images: [],
    stock: 5,
    status: "published",
  });

  // Load brands and categories for dropdowns
  useEffect(() => {
    getBrands().then((bs) => {
      const names = bs.map((b) => b.name.toUpperCase());
      setBrandsList(Array.from(new Set(["LENOVO", "HP", "DELL", "APPLE", "ASUS", "ACER", ...names])));
    }).catch(() => {});

    getCategories()
      .then((cs) => {
        setCategoriesList(
          cs
            .filter((c) => !!c.name)
            .map((c) => ({ id: c.id || "", name: c.name, slug: c.slug || slugify(c.name) }))
        );
      })
      .catch(() => {});
  }, []);

  // Load existing product. `loading` already starts as `!isNew`, so the
  // new-product path needs no state update; the read result is applied in
  // the promise callback (react-hooks/set-state-in-effect pattern).
  useEffect(() => {
    if (isNew) return;

    getProduct(id!)
      .then((p) => {
        if (!p) {
          setError(`Product with ID "${id}" was not found in Firestore.`);
          return;
        }

        // Normalize specs
        const specs = Array.isArray(p.specs) ? p.specs : [];
        const proc = p.processor || specs[0] || "";
        const r = p.ram || specs[1] || "";
        const st = p.storage || specs[2] || "";

        const allImages = Array.isArray(p.images) && p.images.length > 0
          ? p.images
          : p.image
          ? [p.image]
          : [];

        // Legacy-tolerant read: screen/display -> screenSize, os -> operatingSystem,
        // gpu/graphicsCard -> graphics, gen -> generation, touchscreen -> touch.
        const hw = readHardwareSpecs(p as unknown as Record<string, unknown>);

        setFormData({
          ...p,
          brand: (p.brand || "LENOVO").toUpperCase(),
          processor: hw.processor || proc,
          generation: hw.generation,
          screenSize: hw.screenSize,
          ram: hw.ram || r,
          storage: hw.storage || st,
          graphics: hw.graphics,
          touch: hw.touch,
          operatingSystem: hw.operatingSystem,
          os: hw.operatingSystem,
          category: readCategoryName(p as unknown as Record<string, unknown>),
          categoryId: (p as any).categoryId ?? undefined,
          sku: (p as any).sku ?? "",
          slug: (p as any).slug ?? "",
          ramOptions: normalizeOptions(p.ramOptions),
          storageOptions: normalizeOptions(p.storageOptions),
          warrantyOptions: normalizeOptions(p.warrantyOptions),
          specs: specs.length > 0 ? specs : [proc, r, st].filter(Boolean),
          images: allImages,
          image: p.image || allImages[0] || "",
          price: Number(p.price) || 0,
          originalPrice: p.originalPrice ? Number(p.originalPrice) : undefined,
        });
        // Legacy variants[] are preserved on the document untouched; we only
        // surface a warning so the admin knows a second (older) price source
        // exists. The Admin Panel never writes to variants[] any more.
        const lv = (p as any).variants;
        setLegacyVariants(Array.isArray(lv) && lv.length > 0 ? lv : null);
        setSlugTouched(!!(p as any).slug);

        setOriginalSnapshot({
          name: p.name,
          price: Number(p.price) || 0,
          stock: Number(p.stock) || 0,
          status: p.status || "published",
        });
      })
      .catch((err) => {
        console.error("Error loading product:", err);
        setError("Error loading product: " + err.message);
      })
      .finally(() => setLoading(false));
  }, [id, isNew]);

  // Handle Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!mayWrite) {
      setError("Your role does not permit modifying products.");
      return;
    }
    if (!formData.name.trim()) {
      setError("Product Name is required.");
      return;
    }
    if (!formData.price || formData.price <= 0) {
      setError("Please provide a valid selling price in ₹.");
      return;
    }

    // Ensure at least one image is provided
    const allImgs = formData.images && formData.images.length > 0
      ? formData.images
      : formData.image
      ? [formData.image]
      : [];

    if (allImgs.length === 0) {
      setError("Please upload at least one product image using the upload button.");
      return;
    }

    setSaving(true);

    try {
      // Slug: use the admin value, else derive from the product name.
      // NEVER the random Firestore document id.
      const finalSlug = slugify(formData.slug || formData.name);

      // Rebuild specs (canonical + legacy mirrors are written by saveProduct)
      const finalSpecs = [formData.processor, formData.ram, formData.storage].filter(Boolean) as string[];

      // Calculate discount — never leave it undefined (Firestore rejects undefined)
      let discountStr = formData.discount ?? "";
      if (!discountStr && formData.originalPrice && formData.originalPrice > formData.price) {
        const pct = Math.round(((formData.originalPrice - formData.price) / formData.originalPrice) * 100);
        discountStr = `${pct}% off`;
      }

      const payload: Partial<FirestoreProduct> = {
        ...formData,
        brand: formData.brand.toUpperCase(),
        specs: finalSpecs.length > 0 ? finalSpecs : formData.specs,
        discount: discountStr,
        // hardware specifications (canonical names)
        processor: formData.processor ?? "",
        generation: formData.generation ?? "",
        screenSize: formData.screenSize ?? "",
        ram: formData.ram ?? "",
        storage: formData.storage ?? "",
        graphics: formData.graphics ?? "",
        touch: formData.touch === true,
        operatingSystem: formData.operatingSystem ?? formData.os ?? "",
        // taxonomy + identifiers
        category: (formData.category ?? "").trim(),
        categoryId: (formData as any).categoryId ?? "",
        categoryName: (formData.category ?? "").trim(), // legacy mirror
        sku: (formData.sku ?? "").trim(),
        slug: finalSlug,
        // configurable price options (admin-defined per product)
        ramOptions: normalizeOptions(formData.ramOptions).filter((o) => o.value),
        storageOptions: normalizeOptions(formData.storageOptions).filter((o) => o.value),
        warrantyOptions: normalizeOptions(formData.warrantyOptions).filter((o) => o.value),
        image: allImgs[0],
        images: allImgs,
        price: Number(formData.price),
        originalPrice: formData.originalPrice ? Number(formData.originalPrice) : Number(formData.price),
        spotlight: formData.section === "spotlight" || formData.spotlight === true,
      };

      const result = await saveProduct(payload, isNew ? undefined : id);

      // Activity log runs ONLY after the Firestore write succeeded and can
      // never fail the save (logAdminAction swallows its own errors).
      const diffs: string[] = [];
      if (!isNew && originalSnapshot) {
        if (originalSnapshot.price !== undefined && Number(originalSnapshot.price) !== Number(payload.price)) {
          diffs.push(`price from ${inr(originalSnapshot.price)} to ${inr(payload.price)}`);
        }
        if (originalSnapshot.stock !== undefined && Number(originalSnapshot.stock) !== Number(payload.stock ?? 0)) {
          diffs.push(`stock from ${originalSnapshot.stock} to ${payload.stock ?? 0}`);
        }
        if (originalSnapshot.status && originalSnapshot.status !== payload.status) {
          diffs.push(`status from ${originalSnapshot.status} to ${payload.status}`);
        }
      }
      void logAdminAction({
        action: isNew ? "CREATE" : "UPDATE",
        entity: "Product",
        entityId: result.id,
        description: isNew
          ? `Created product "${payload.name}" at ${inr(payload.price)}`
          : diffs.length > 0
          ? `Updated ${payload.name} — ${diffs.join(", ")}`
          : `Updated product "${payload.name}"`,
        changes: {
          price: payload.price,
          stock: payload.stock,
          status: payload.status,
          ramOptions: payload.ramOptions?.length ?? 0,
          storageOptions: payload.storageOptions?.length ?? 0,
          warrantyOptions: payload.warrantyOptions?.length ?? 0,
        },
      });
      setOriginalSnapshot({
        name: payload.name,
        price: Number(payload.price),
        stock: Number(payload.stock ?? 0),
        status: payload.status,
      });

      setSuccess("Product saved successfully to Firestore! Changes are now live on the customer website.");
      setTimeout(() => setSuccess(""), 4000);

      if (isNew && result.id) {
        router.replace(`/admin/products/${result.id}`);
      }
    } catch (err: any) {
      console.error("Error saving product:", err);
      setError("Failed to save product to Firestore: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id || isNew) return;
    if (!confirm(`Are you sure you want to permanently delete "${formData.name}" from Firestore?`)) return;
    try {
      await deleteProduct(id);
      void logAdminAction({
        action: "DELETE",
        entity: "Product",
        entityId: id,
        description: `Deleted product "${formData.name}"`,
      });
      router.push("/admin/products");
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
        <span className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <span>Loading product details from Firestore...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
            <Link href="/admin/products" className="hover:text-[#B88900]">← Back to Products</Link>
            <span>/</span>
            <span>{isNew ? "New Product" : formData.name || id}</span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B88900]">Granth Laptop Hub</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">
            {isNew ? "Create New Product" : `Edit: ${formData.name}`}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Document location: <code className="text-slate-700">products/{id || "[auto-id]"}</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && mayDelete && (
            <button
              type="button"
              onClick={handleDelete}
              className="adm-btn adm-btn-danger text-xs py-2 px-3.5"
            >
              Delete Product
            </button>
          )}

          <button
            type="submit"
            disabled={saving || !mayWrite}
            title={mayWrite ? undefined : "Your role cannot modify products"}
            className="adm-btn adm-btn-gold text-xs py-2 px-4 shadow-sm disabled:opacity-50"
          >
            {saving ? "Saving to Firestore..." : isNew ? "Create Product" : "Save Changes"}
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
            className="underline font-bold text-emerald-900 ml-4"
          >
            Verify on Customer Website ↗
          </a>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Grid Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left Column: Core Fields */}
        <div className="lg:col-span-2 space-y-5">
          {/* Section 1: Basic Info */}
          <div className="adm-card p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
              Basic Information
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Title / Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder='e.g. Lenovo ThinkPad L490 | Intel i5 8th Gen | 14" HD | Windows 11 Pro'
                className="adm-input text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Brand <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <select
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value.toUpperCase() })}
                    className="adm-input text-xs"
                  >
                    {brandsList.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="Custom Brand"
                    className="adm-input text-xs !w-32"
                    onBlur={(e) => {
                      if (e.target.value.trim()) {
                        setFormData({ ...formData, brand: e.target.value.trim().toUpperCase() });
                      }
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.category || ""}
                  onChange={(e) => {
                    const picked = categoriesList.find((c) => c.name === e.target.value);
                    setFormData({
                      ...formData,
                      category: e.target.value,
                      categoryId: picked?.id ?? "",
                    });
                  }}
                  className="adm-input text-xs"
                >
                  <option value="">— Select Category —</option>
                  {/* Keep an existing value visible even if its category doc was renamed/removed */}
                  {formData.category && !categoriesList.some((c) => c.name === formData.category) && (
                    <option value={formData.category}>{formData.category} (existing)</option>
                  )}
                  {categoriesList.map((c) => (
                    <option key={c.id || c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Saved as <code>category</code> (+ <code>categoryName</code> / <code>categoryId</code>).
                  Powers &ldquo;Products by Category&rdquo; in Analytics.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Condition</label>
                <select
                  value={formData.condition || "refurbished"}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value as any })}
                  className="adm-input text-xs"
                >
                  <option value="refurbished">Refurbished (Quality Checked)</option>
                  <option value="new">Brand New (Billed)</option>
                  <option value="open box">Open Box / Demo Unit</option>
                </select>
              </div>
            </div>

            {/* SKU + URL slug */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">SKU</label>
                <input
                  type="text"
                  value={formData.sku || ""}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="e.g. GLH-TP-T490-8-256"
                  className="adm-input text-xs font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Your internal stock code. Left exactly as typed.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  URL Slug
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.slug || ""}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setFormData({ ...formData, slug: e.target.value });
                    }}
                    onBlur={(e) =>
                      setFormData({ ...formData, slug: slugify(e.target.value) })
                    }
                    placeholder="lenovo-thinkpad-t490"
                    className="adm-input text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSlugTouched(true);
                      setFormData({ ...formData, slug: slugify(formData.name) });
                    }}
                    className="shrink-0 px-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700"
                    title="Generate from the product name"
                  >
                    Generate
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {formData.slug
                    ? `Will save as: ${slugify(formData.slug)}`
                    : `Empty → auto-generated from the name: ${slugify(formData.name) || "—"}`}
                </p>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Short Description / Highlight
              </label>
              <textarea
                rows={3}
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Key highlights, condition rating, ideal use case..."
                className="adm-input text-xs"
              />
            </div>
          </div>

          {/* Section 2: Pricing & Badges */}
          <div className="adm-card p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
              Pricing & Customer Badges
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Selling Price (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.price || ""}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                  placeholder="22999"
                  className="adm-input text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Original Price / MRP (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.originalPrice || ""}
                  onChange={(e) => setFormData({ ...formData, originalPrice: Number(e.target.value) })}
                  placeholder="64000"
                  className="adm-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Discount Text (Auto or Custom)
                </label>
                <input
                  type="text"
                  value={formData.discount || ""}
                  onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                  placeholder="e.g. 64% off"
                  className="adm-input text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tag / Badge Label
                </label>
                <input
                  type="text"
                  value={formData.tag || ""}
                  onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                  placeholder="Student-friendly, Pro workstation, Gaming, etc."
                  className="adm-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tag Color Theme
                </label>
                <select
                  value={formData.tagColor || "green"}
                  onChange={(e) => setFormData({ ...formData, tagColor: e.target.value })}
                  className="adm-input text-xs"
                >
                  <option value="green">Green (Student-friendly / Best value)</option>
                  <option value="purple">Purple (Pro workstation / High-end)</option>
                  <option value="blue">Blue (Corporate / Business)</option>
                  <option value="gray">Gray (Available)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Hardware Specifications */}
          <div className="adm-card p-5 space-y-4">
            <div className="border-b border-slate-100 pb-2">
              <h2 className="text-sm font-bold text-slate-800">Hardware Specifications</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Saved to Firestore as <code>processor</code>, <code>generation</code>,{" "}
                <code>screenSize</code>, <code>ram</code>, <code>storage</code>, <code>graphics</code>,{" "}
                <code>touch</code>, <code>operatingSystem</code> — plus legacy mirrors
                (<code>os</code>, <code>screen</code>, <code>gen</code>, <code>gpu</code>) so the
                customer website product page never shows &ldquo;—&rdquo; again.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Processor</label>
                <input
                  type="text"
                  value={formData.processor || ""}
                  onChange={(e) => setFormData({ ...formData, processor: e.target.value })}
                  placeholder="Intel Core i5"
                  className="adm-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Generation</label>
                <input
                  type="text"
                  list="gen-options"
                  value={formData.generation || ""}
                  onChange={(e) => setFormData({ ...formData, generation: e.target.value })}
                  placeholder="8th Gen"
                  className="adm-input text-xs"
                />
                <datalist id="gen-options">
                  {["6th Gen", "7th Gen", "8th Gen", "9th Gen", "10th Gen", "11th Gen", "12th Gen", "13th Gen"].map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Screen Size</label>
                <input
                  type="text"
                  list="screen-options"
                  value={formData.screenSize || ""}
                  onChange={(e) => setFormData({ ...formData, screenSize: e.target.value })}
                  placeholder={'14"'}
                  className="adm-input text-xs"
                />
                <datalist id="screen-options">
                  {['11.6"', '12.5"', '13.3"', '14"', '15.6"', '16"', '17.3"'].map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">RAM</label>
                <input
                  type="text"
                  list="ram-spec-options"
                  value={formData.ram || ""}
                  onChange={(e) => setFormData({ ...formData, ram: e.target.value })}
                  placeholder="8GB"
                  className="adm-input text-xs"
                />
                <datalist id="ram-spec-options">
                  {["4GB", "8GB", "16GB", "32GB", "64GB"].map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Storage</label>
                <input
                  type="text"
                  list="storage-spec-options"
                  value={formData.storage || ""}
                  onChange={(e) => setFormData({ ...formData, storage: e.target.value })}
                  placeholder="256GB SSD"
                  className="adm-input text-xs"
                />
                <datalist id="storage-spec-options">
                  {["128GB SSD", "256GB SSD", "512GB SSD", "1TB SSD", "1TB HDD", "512GB SSD + 1TB HDD"].map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Graphics</label>
                <input
                  type="text"
                  list="gpu-options"
                  value={formData.graphics || ""}
                  onChange={(e) => setFormData({ ...formData, graphics: e.target.value })}
                  placeholder="Intel UHD Graphics"
                  className="adm-input text-xs"
                />
                <datalist id="gpu-options">
                  {["Intel UHD Graphics", "Intel Iris Xe", "AMD Radeon Graphics", "NVIDIA GeForce MX350", "NVIDIA RTX 3050"].map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Touch Screen</label>
                <select
                  value={formData.touch ? "yes" : "no"}
                  onChange={(e) => setFormData({ ...formData, touch: e.target.value === "yes" })}
                  className="adm-input text-xs"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Operating System</label>
                <input
                  type="text"
                  list="os-options"
                  value={formData.operatingSystem || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, operatingSystem: e.target.value, os: e.target.value })
                  }
                  placeholder="Windows 11 Pro"
                  className="adm-input text-xs"
                />
                <datalist id="os-options">
                  {["Windows 10 Pro", "Windows 11 Home", "Windows 11 Pro", "macOS", "Ubuntu Linux", "DOS"].map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Warranty Information (base)
                </label>
                <input
                  type="text"
                  value={formData.warranty || ""}
                  onChange={(e) => setFormData({ ...formData, warranty: e.target.value })}
                  placeholder="6 Months in-store warranty assistance"
                  className="adm-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Return / Exchange Policy
                </label>
                <input
                  type="text"
                  value={formData.returnPolicy || ""}
                  onChange={(e) => setFormData({ ...formData, returnPolicy: e.target.value })}
                  placeholder="7 days easy replacement"
                  className="adm-input text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 3b: Configurable RAM / Storage / Warranty price options */}
          <div className="adm-card p-5 space-y-4">
            <div className="border-b border-slate-100 pb-2">
              <h2 className="text-sm font-bold text-slate-800">
                Upgrade Options &amp; Price Adjustments
              </h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Define the exact upgrade price for <strong>this product</strong>. There is no fixed
                ₹5,000 upgrade any more — every amount below is stored per product in Firestore
                (<code>ramOptions</code>, <code>storageOptions</code>, <code>warrantyOptions</code>) and the
                customer website adds the selected adjustments to the base price.
              </p>
            </div>

            {legacyVariants && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-[11px] text-amber-900 space-y-1.5">
                <p className="font-bold">
                  Legacy <code>variants[]</code> data detected on this product ({legacyVariants.length}{" "}
                  group{legacyVariants.length === 1 ? "" : "s"}).
                </p>
                <p>
                  It is <strong>preserved untouched</strong> in Firestore, but it is no longer used and is not
                  edited here. The canonical price options are{" "}
                  <code>ramOptions</code> / <code>storageOptions</code> / <code>warrantyOptions</code> below —
                  the Admin Panel writes only these, so no conflicting second price system is created.
                </p>
                <p className="text-amber-800">
                  Legacy groups:{" "}
                  {legacyVariants
                    .map((v: any) => String(v?.name ?? "unnamed"))
                    .join(", ")}
                  . Once the customer website reads the canonical arrays, this old field can be retired.
                </p>
              </div>
            )}

            <OptionsEditor
              title="RAM Options"
              description="Example: 8GB +₹0, 16GB +₹2,500, 32GB +₹5,500"
              addLabel="Add RAM Option"
              valuePlaceholder="16GB"
              suggestions={["8GB", "16GB", "32GB"]}
              basePrice={Number(formData.price) || 0}
              options={(formData.ramOptions as ProductOption[]) || []}
              onChange={(next) => setFormData({ ...formData, ramOptions: next })}
            />

            <OptionsEditor
              title="Storage Options"
              description="Example: 256GB SSD +₹0, 512GB SSD +₹2,500, 1TB SSD +₹5,000"
              addLabel="Add Storage Option"
              valuePlaceholder="512GB SSD"
              suggestions={["256GB SSD", "512GB SSD", "1TB SSD"]}
              basePrice={Number(formData.price) || 0}
              options={(formData.storageOptions as ProductOption[]) || []}
              onChange={(next) => setFormData({ ...formData, storageOptions: next })}
            />

            <OptionsEditor
              title="Warranty Options"
              description="Example: 6 Months +₹0, 1 Year +₹1,500, 2 Years +₹3,000"
              addLabel="Add Warranty Option"
              valuePlaceholder="1 Year Warranty"
              suggestions={["6 Months Warranty", "1 Year Warranty", "2 Years Warranty"]}
              basePrice={Number(formData.price) || 0}
              options={(formData.warrantyOptions as ProductOption[]) || []}
              onChange={(next) => setFormData({ ...formData, warrantyOptions: next })}
            />

            {/* Live preview of the default configuration price */}
            <div className="rounded-xl bg-slate-900 text-white p-4 text-xs space-y-1">
              <p className="font-bold text-[#D6A600] uppercase tracking-wider text-[10px]">
                Default configuration price preview
              </p>
              {(() => {
                const ramSel = defaultOption(normalizeOptions(formData.ramOptions));
                const stoSel = defaultOption(normalizeOptions(formData.storageOptions));
                const warSel = defaultOption(normalizeOptions(formData.warrantyOptions));
                const total = computeConfiguredPrice(Number(formData.price) || 0, {
                  ram: ramSel,
                  storage: stoSel,
                  warranty: warSel,
                });
                return (
                  <>
                    <p>Base price: ₹{(Number(formData.price) || 0).toLocaleString("en-IN")}</p>
                    {ramSel && (
                      <p className="text-white/70">
                        RAM · {ramSel.value}: {ramSel.priceAdjustment >= 0 ? "+" : "−"}₹
                        {Math.abs(ramSel.priceAdjustment).toLocaleString("en-IN")}
                      </p>
                    )}
                    {stoSel && (
                      <p className="text-white/70">
                        Storage · {stoSel.value}: {stoSel.priceAdjustment >= 0 ? "+" : "−"}₹
                        {Math.abs(stoSel.priceAdjustment).toLocaleString("en-IN")}
                      </p>
                    )}
                    {warSel && (
                      <p className="text-white/70">
                        Warranty · {warSel.value}: {warSel.priceAdjustment >= 0 ? "+" : "−"}₹
                        {Math.abs(warSel.priceAdjustment).toLocaleString("en-IN")}
                      </p>
                    )}
                    <p className="text-base font-extrabold pt-1">
                      Final: ₹{total.toLocaleString("en-IN")}
                    </p>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Section 4: PRODUCT IMAGE UPLOAD (ImgBB via secure /api/upload-image) */}
          <div className="adm-card p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800">
                Product Image & Gallery Upload
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Images are uploaded through the secure server endpoint /api/upload-image to ImgBB. The ImgBB API key never reaches the browser; only the hosted URL is stored in Firestore and read by the customer website.
              </p>
            </div>

            <MultiImageUploader
              values={formData.images || (formData.image ? [formData.image] : [])}
              onChange={(urls) => {
                setFormData({
                  ...formData,
                  images: urls,
                  image: urls[0] || "",
                });
              }}
              folder="products"
              label="Product Images (Upload from Camera or File Picker)"
            />
          </div>
        </div>

        {/* Right Column: Section Placement, Status & Visibility */}
        <div className="space-y-5">
          {/* Homepage Section Assignment */}
          <div className="adm-card p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
              Homepage Placement
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Assign to Section on Homepage
              </label>
              <select
                value={formData.section || ""}
                onChange={(e) => {
                  const s = e.target.value as any;
                  setFormData({
                    ...formData,
                    section: s,
                    spotlight: s === "spotlight" ? true : formData.spotlight,
                  });
                }}
                className="adm-input text-xs"
              >
                <option value="">None (Catalog view only)</option>
                <option value="bestSellers">Best Sellers Section</option>
                <option value="trending">Trending Laptops Section</option>
                <option value="spotlight">Today&apos;s Spotlight (Live Deal)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                The customer website queries Firestore: <code className="text-slate-600">where(&quot;section&quot;, &quot;==&quot;, &quot;bestSellers&quot;)</code> etc.
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!formData.spotlight}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      spotlight: e.target.checked,
                      section: e.target.checked ? "spotlight" : formData.section,
                    })
                  }
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Set as &quot;Deal of the Day&quot; / Spotlight</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!formData.featured}
                  onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Mark as Featured Product</span>
              </label>
            </div>
          </div>

          {/* Publication Status & Stock */}
          <div className="adm-card p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-2">
              Stock & Publishing
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Publishing Status
              </label>
              <select
                value={formData.status || "published"}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                className="adm-input text-xs"
              >
                <option value="published">Published (Visible on site)</option>
                <option value="draft">Draft (Hidden from site)</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Available Stock Units
              </label>
              <input
                type="number"
                min="0"
                value={formData.stock ?? 5}
                onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                className="adm-input text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Rating</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  max="5"
                  value={formData.rating ?? 4.5}
                  onChange={(e) => setFormData({ ...formData, rating: Number(e.target.value) })}
                  className="adm-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Review Count</label>
                <input
                  type="number"
                  min="0"
                  value={formData.reviews ?? 5}
                  onChange={(e) => setFormData({ ...formData, reviews: Number(e.target.value) })}
                  className="adm-input text-xs"
                />
              </div>
            </div>
          </div>

          {/* Action Card */}
          <div className="adm-card p-5 space-y-3 bg-amber-50/50 border-amber-200">
            <p className="text-xs font-bold text-amber-900">Firestore Live Synchronization</p>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              When you click Save, this document is written to the Firestore collection <code className="bg-white px-1 py-0.5 rounded border border-amber-200">products</code>.
              The customer website will load it immediately.
            </p>
            <button
              type="submit"
              disabled={saving}
              className="w-full adm-btn adm-btn-gold text-xs py-2.5 shadow-sm font-bold"
            >
              {saving ? "Saving to Firestore..." : isNew ? "Create Product" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
