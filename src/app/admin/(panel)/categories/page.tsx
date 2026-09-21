"use client";
import React, { useEffect, useState } from "react";
import {
  getCategories,
  saveCategory,
  deleteCategory,
  FirestoreCategory,
} from "@/lib/firestore-service";
import { ImageUploader } from "@/admin/image-uploader";
import { CUSTOMER_WEBSITE_URL } from "@/lib/firebase";
import { logAdminAction } from "@/lib/activity";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<FirestoreCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FirestoreCategory | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadAll = async () => {
    setLoading(true);
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (err: any) {
      setError("Failed to load categories: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const openNew = () => {
    setEditing({
      name: "",
      slug: "",
      description: "",
      image: "",
      icon: "laptop",
      displayOrder: categories.length + 1,
      active: true,
      featured: true,
    });
    setIsNew(true);
    setError("");
  };

  const openEdit = (cat: FirestoreCategory) => {
    setEditing({ ...cat });
    setIsNew(false);
    setError("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.name.trim()) {
      setError("Category Name is required.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const slug =
        editing.slug ||
        editing.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "");

      const payload = {
        ...editing,
        slug,
        displayOrder: Number(editing.displayOrder) || 0,
        active: editing.active !== false,
      };

      const saved = await saveCategory(payload, isNew ? undefined : editing.id);
      void logAdminAction({
        action: isNew ? "CREATE" : "UPDATE",
        entity: "Category",
        entityId: saved.id,
        description: `${isNew ? "Created" : "Updated"} category "${editing.name}"`,
      });
      setSuccess(`Category "${editing.name}" saved to Firestore successfully.`);
      setTimeout(() => setSuccess(""), 3500);

      setEditing(null);
      loadAll();
    } catch (err: any) {
      setError("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: FirestoreCategory) => {
    if (!cat.id) return;
    if (!confirm(`Permanently delete category "${cat.name}" from Firestore?`)) return;
    try {
      await deleteCategory(cat.id);
      void logAdminAction({
        action: "DELETE",
        entity: "Category",
        entityId: cat.id,
        description: `Deleted category "${cat.name}"`,
      });
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      setSuccess(`Category "${cat.name}" deleted.`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B88900]">Granth Laptop Hub</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">Categories Manager</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Document location: <code className="text-slate-700">/categories</code> · Image uploads hosted on ImgBB
          </p>
        </div>

        <button
          type="button"
          onClick={openNew}
          className="adm-btn adm-btn-gold text-xs py-2 px-3.5 shadow-sm inline-flex items-center gap-1.5"
        >
          <span>+ Add New Category</span>
        </button>
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
          ✓ {success}
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Categories Grid/Table */}
      <div className="adm-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading categories from Firestore...</div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No categories found. Click "+ Add New Category" to create one with a direct image upload.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Category Image</th>
                  <th className="px-4 py-3">Category Name</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-2.5">
                      <div className="w-14 h-10 rounded-lg bg-slate-100 overflow-hidden border border-slate-200">
                        {c.image ? (
                          <img src={c.image} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full grid place-items-center text-slate-400 text-xs">
                            No Img
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-900">{c.name}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">{c.slug}</td>
                    <td className="px-4 py-2.5 text-slate-600">{c.displayOrder ?? 0}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.active !== false ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {c.active !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-amber-100 text-slate-700 font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(c)}
                          className="px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 font-semibold"
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

      {/* Edit/Create Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {isNew ? "Create New Category" : `Edit Category: ${editing.name}`}
              </h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Business Laptops"
                  className="adm-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">URL Slug</label>
                <input
                  type="text"
                  value={editing.slug}
                  onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                  placeholder="e.g. business-laptops (auto-generated if empty)"
                  className="adm-input text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editing.description || ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="Short description of this laptop category..."
                  className="adm-input text-xs"
                />
              </div>

              {/* DIRECT FIREBASE STORAGE IMAGE UPLOAD */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <ImageUploader
                  value={editing.image || ""}
                  onChange={(url) => setEditing({ ...editing, image: url })}
                  folder="categories"
                  label="Upload Category Image (ImgBB)"
                  hint="Select → preview → Upload to ImgBB. The hosted URL saves to Firestore on Save."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Display Order</label>
                  <input
                    type="number"
                    value={editing.displayOrder ?? 0}
                    onChange={(e) => setEditing({ ...editing, displayOrder: Number(e.target.value) })}
                    className="adm-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Icon Style</label>
                  <select
                    value={editing.icon || "laptop"}
                    onChange={(e) => setEditing({ ...editing, icon: e.target.value })}
                    className="adm-input text-xs"
                  >
                    <option value="laptop">Laptop</option>
                    <option value="star">Star / Recommended</option>
                    <option value="play">Play / Gaming</option>
                    <option value="badge">Badge / Premium</option>
                    <option value="refresh">Refresh / Refurbished</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editing.active !== false}
                    onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>Active & Visible</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!editing.featured}
                    onChange={(e) => setEditing({ ...editing, featured: e.target.checked })}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>Featured on Home</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="adm-btn adm-btn-line text-xs py-2 px-3"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="adm-btn adm-btn-gold text-xs py-2 px-4 font-bold"
                >
                  {saving ? "Saving to Firestore..." : isNew ? "Create Category" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
