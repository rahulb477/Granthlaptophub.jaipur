"use client";
import React, { useEffect, useState } from "react";
import {
  getBrands,
  saveBrand,
  deleteBrand,
  FirestoreBrand,
} from "@/lib/firestore-service";
import { ImageUploader } from "@/admin/image-uploader";
import { logAdminAction } from "@/lib/activity";

export default function BrandsPage() {
  const [brands, setBrands] = useState<FirestoreBrand[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FirestoreBrand | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadAll = async () => {
    setLoading(true);
    try {
      const data = await getBrands();
      setBrands(data);
    } catch (err: any) {
      setError("Failed to load brands: " + err.message);
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
      logo: "",
      description: "",
      displayOrder: brands.length + 1,
      active: true,
    });
    setIsNew(true);
    setError("");
  };

  const openEdit = (b: FirestoreBrand) => {
    setEditing({ ...b });
    setIsNew(false);
    setError("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.name.trim()) {
      setError("Brand Name is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const slug =
        editing.slug ||
        editing.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      const payload = {
        ...editing,
        name: editing.name.toUpperCase(),
        slug,
        displayOrder: Number(editing.displayOrder) || 0,
        active: editing.active !== false,
      };

      const saved = await saveBrand(payload, isNew ? undefined : editing.id);
      void logAdminAction({
        action: isNew ? "CREATE" : "UPDATE",
        entity: "Brand",
        entityId: saved.id,
        description: `${isNew ? "Created" : "Updated"} brand "${payload.name}"`,
      });
      setSuccess(`Brand "${payload.name}" saved to Firestore successfully.`);
      setTimeout(() => setSuccess(""), 3500);

      setEditing(null);
      loadAll();
    } catch (err: any) {
      setError("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (b: FirestoreBrand) => {
    if (!b.id) return;
    if (!confirm(`Delete brand "${b.name}" from Firestore?`)) return;
    try {
      await deleteBrand(b.id);
      void logAdminAction({
        action: "DELETE",
        entity: "Brand",
        entityId: b.id,
        description: `Deleted brand "${b.name}"`,
      });
      setBrands((prev) => prev.filter((item) => item.id !== b.id));
      setSuccess(`Brand "${b.name}" deleted.`);
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
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">Brands Manager</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manages brands in Firestore <code className="text-slate-700">/brands</code> · Logo upload hosted on ImgBB
          </p>
        </div>

        <button
          type="button"
          onClick={openNew}
          className="adm-btn adm-btn-gold text-xs py-2 px-3.5 shadow-sm inline-flex items-center gap-1.5"
        >
          <span>+ Add New Brand</span>
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

      {/* Brands Grid */}
      <div className="adm-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading brands from Firestore...</div>
        ) : brands.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No brands found in Firestore.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Logo</th>
                  <th className="px-4 py-3">Brand Name</th>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {brands.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-2.5">
                      <div className="w-12 h-10 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 grid place-items-center p-1">
                        {b.logo ? (
                          <img src={b.logo} alt="" className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">{b.name?.slice(0, 3)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-900">{b.name}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-500">{b.slug}</td>
                    <td className="px-4 py-2.5 text-slate-600">{b.displayOrder ?? 0}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          b.active !== false ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {b.active !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(b)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-amber-100 text-slate-700 font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(b)}
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
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {isNew ? "Create Brand" : `Edit Brand: ${editing.name}`}
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
                  Brand Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value.toUpperCase() })}
                  placeholder="e.g. DELL / HP / LENOVO"
                  className="adm-input text-xs"
                />
              </div>

              {/* Direct Firebase Storage Logo Upload */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <ImageUploader
                  value={editing.logo || ""}
                  onChange={(url) => setEditing({ ...editing, logo: url })}
                  folder="brands"
                  label="Upload Brand Logo (Firebase Storage)"
                  hint="PNG or SVG logo on transparent background recommended"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Display Order</label>
                <input
                  type="number"
                  value={editing.displayOrder ?? 0}
                  onChange={(e) => setEditing({ ...editing, displayOrder: Number(e.target.value) })}
                  className="adm-input text-xs"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={editing.active !== false}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Active on Storefront</span>
              </label>

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
                  {saving ? "Saving to Firestore..." : isNew ? "Create Brand" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
