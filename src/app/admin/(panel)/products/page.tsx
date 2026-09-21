"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getProducts,
  deleteProduct,
  saveProduct,
  FirestoreProduct,
} from "@/lib/firestore-service";
import { CUSTOMER_WEBSITE_URL } from "@/lib/firebase";

export default function AdminProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<FirestoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const loadProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const list = await getProducts();
      setProducts(list);
    } catch (err: any) {
      console.error("Failed to load products:", err);
      setError("Failed to load products from Firestore: " + (err.message || ""));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete product "${name}" from Firestore?`)) return;
    try {
      await deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setActionSuccess(`Deleted "${name}" successfully.`);
      setTimeout(() => setActionSuccess(""), 3000);
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const handleDuplicate = async (p: FirestoreProduct) => {
    try {
      const copy = {
        ...p,
        name: `${p.name} (Copy)`,
        numericId: Date.now() % 1000000,
        createdAt: new Date(),
      };
      delete copy.id;
      const res = await saveProduct(copy);
      setActionSuccess(`Duplicated product created: ${res.id}`);
      loadProducts();
    } catch (err: any) {
      alert("Duplicate failed: " + err.message);
    }
  };

  const handleQuickStatus = async (p: FirestoreProduct, status: "published" | "draft" | "archived") => {
    if (!p.id) return;
    try {
      await saveProduct({ ...p, status }, p.id);
      setProducts((prev) => prev.map((item) => (item.id === p.id ? { ...item, status } : item)));
    } catch (err: any) {
      alert("Status update failed: " + err.message);
    }
  };

  const handleQuickSection = async (p: FirestoreProduct, section: "bestSellers" | "trending" | "spotlight" | "") => {
    if (!p.id) return;
    try {
      const patch: any = { section };
      if (section === "spotlight") {
        patch.spotlight = true;
      } else if (p.spotlight && (section as string) !== "spotlight") {
        patch.spotlight = false;
      }
      await saveProduct(patch, p.id);
      setProducts((prev) => prev.map((item) => (item.id === p.id ? { ...item, ...patch } : item)));
    } catch (err: any) {
      alert("Section update failed: " + err.message);
    }
  };

  // Unique brands
  const brands = Array.from(new Set(products.map((p) => p.brand).filter(Boolean)));

  // Filter products
  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      p.name?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q) ||
      p.specs?.some((s) => s.toLowerCase().includes(q));

    const matchSection = !filterSection || p.section === filterSection || (filterSection === "spotlight" && p.spotlight);
    const matchBrand = !filterBrand || p.brand?.toUpperCase() === filterBrand.toUpperCase();

    return matchSearch && matchSection && matchBrand;
  });

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B88900]">Granth Laptop Hub</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">Product Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manages documents in Firestore <code className="text-slate-700">/products</code> · Live on{" "}
            <a href={CUSTOMER_WEBSITE_URL} target="_blank" rel="noopener noreferrer" className="text-[#B88900] underline font-semibold">
              laptop-web-iota.vercel.app
            </a>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/products/new"
            className="adm-btn adm-btn-gold text-xs py-2 px-3.5 inline-flex items-center gap-1.5 shadow-sm"
          >
            <span>+ Add New Product</span>
          </Link>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center justify-between">
          <span>✓ {actionSuccess}</span>
          <button onClick={() => setActionSuccess("")} className="text-emerald-900 font-bold">✕</button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="adm-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Search
            </label>
            <input
              type="text"
              placeholder="Search name, brand, processor, RAM..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="adm-input text-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Section Placement
            </label>
            <select
              value={filterSection}
              onChange={(e) => setFilterSection(e.target.value)}
              className="adm-input text-xs"
            >
              <option value="">All Sections</option>
              <option value="bestSellers">Best Sellers Section</option>
              <option value="trending">Trending Laptops Section</option>
              <option value="spotlight">Today's Spotlight (Deal of the Day)</option>
              <option value="catalog">Regular Catalog Only</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Filter by Brand
            </label>
            <select
              value={filterBrand}
              onChange={(e) => setFilterBrand(e.target.value)}
              className="adm-input text-xs"
            >
              <option value="">All Brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <span>
            Showing <strong>{filtered.length}</strong> of <strong>{products.length}</strong> products
          </span>
          {(search || filterSection || filterBrand) && (
            <button
              onClick={() => {
                setSearch("");
                setFilterSection("");
                setFilterBrand("");
              }}
              className="text-[#B88900] font-semibold hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Products Table */}
      <div className="adm-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span>Loading products from Firestore...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 space-y-2">
            <p className="font-semibold text-slate-700">No products match your criteria.</p>
            <p>Click "+ Add New Product" to add a new laptop directly to the Firestore database.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Specs</th>
                  <th className="px-4 py-3">Price / MRP</th>
                  <th className="px-4 py-3">Homepage Section</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition">
                    {/* Image & Name */}
                    <td className="px-4 py-3 min-w-[240px]">
                      <div className="flex items-center gap-3">
                        <div className="w-14 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                          <img
                            src={p.image || (p.images && p.images[0]) || "/images/laptop-thinkpad.png"}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "https://images.placeholders.dev/?width=100&height=80&text=Laptop";
                            }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-[#B88900]">
                            {p.brand} {p.condition ? `• ${p.condition}` : ""}
                          </span>
                          <Link
                            href={`/admin/products/${p.id}`}
                            className="font-bold text-slate-900 hover:text-[#B88900] block truncate"
                            title={p.name}
                          >
                            {p.name}
                          </Link>
                          {p.tag && (
                            <span
                              className={`inline-block mt-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                p.tagColor === "purple"
                                  ? "bg-purple-100 text-purple-800"
                                  : p.tagColor === "green"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {p.tag}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Specs */}
                    <td className="px-4 py-3 text-slate-600 max-w-[200px]">
                      {p.specs && p.specs.length > 0 ? (
                        <div className="space-y-0.5">
                          {p.specs.slice(0, 3).map((s, idx) => (
                            <span
                              key={idx}
                              className="inline-block mr-1 text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Price & MRP */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <p className="font-bold text-slate-900 text-sm">
                        ₹ {Number(p.price || 0).toLocaleString("en-IN")}
                      </p>
                      {p.originalPrice && p.originalPrice > p.price ? (
                        <p className="text-[10px] text-slate-400">
                          <span className="line-through">₹ {Number(p.originalPrice).toLocaleString("en-IN")}</span>
                          <span className="ml-1 text-emerald-700 font-bold">{p.discount}</span>
                        </p>
                      ) : null}
                    </td>

                    {/* Section Selector */}
                    <td className="px-4 py-3">
                      <select
                        value={p.spotlight ? "spotlight" : p.section || ""}
                        onChange={(e) => handleQuickSection(p, e.target.value as any)}
                        className="text-xs bg-slate-100 border border-slate-200 rounded px-2 py-1 outline-none font-semibold text-slate-700"
                      >
                        <option value="">None (Catalog only)</option>
                        <option value="bestSellers">⭐ Best Sellers</option>
                        <option value="trending">🔥 Trending Laptops</option>
                        <option value="spotlight">🌟 Today's Spotlight</option>
                      </select>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <select
                        value={p.status || "published"}
                        onChange={(e) => handleQuickStatus(p, e.target.value as any)}
                        className={`text-[10px] font-bold rounded-full px-2 py-0.5 border-0 outline-none cursor-pointer ${
                          p.status === "draft"
                            ? "bg-slate-100 text-slate-600"
                            : p.status === "archived"
                            ? "bg-red-50 text-red-700"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        <option value="published">Published</option>
                        <option value="draft">Draft</option>
                        <option value="archived">Archived</option>
                      </select>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1 text-xs">
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-[#FFF3C4] text-slate-700 hover:text-amber-900 font-semibold"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDuplicate(p)}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold"
                          title="Duplicate Product"
                        >
                          Duplicate
                        </button>
                        <button
                          type="button"
                          onClick={() => p.id && handleDelete(p.id, p.name)}
                          className="px-2 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 font-semibold"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
