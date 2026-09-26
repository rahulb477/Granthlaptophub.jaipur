"use client";
import React, { useEffect, useState } from "react";
import {
  getOffers,
  saveOffer,
  deleteOffer,
  getCoupons,
  saveCoupon,
  deleteCoupon,
  FirestoreOffer,
  FirestoreCoupon,
} from "@/lib/firestore-service";
import { ImageUploader } from "@/admin/image-uploader";
import { logAdminAction } from "@/lib/activity";

export default function OffersCouponsPage() {
  const [activeTab, setActiveTab] = useState<"offers" | "coupons">("offers");

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B88900]">Granth Laptop Hub</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">Offers & Coupons Manager</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manages documents in Firestore <code className="text-slate-700">/offers</code> and <code className="text-slate-700">/coupons</code>
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("offers")}
            className={`adm-btn text-xs py-2 px-3.5 ${
              activeTab === "offers" ? "adm-btn-primary" : "adm-btn-line"
            }`}
          >
            Promotional Offers
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("coupons")}
            className={`adm-btn text-xs py-2 px-3.5 ${
              activeTab === "coupons" ? "adm-btn-primary" : "adm-btn-line"
            }`}
          >
            Checkout Coupons
          </button>
        </div>
      </div>

      {activeTab === "offers" ? <OffersTab /> : <CouponsTab />}
    </div>
  );
}

function OffersTab() {
  const [offers, setOffers] = useState<FirestoreOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FirestoreOffer | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const loadAll = async () => {
    setLoading(true);
    try {
      const data = await getOffers();
      setOffers(data);
    } catch (err: any) {
      setError("Load error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Mount-time load: only starts the module-level Firestore read; state is
  // updated inside the promise callbacks (the pattern accepted by
  // react-hooks/set-state-in-effect). The save/delete handlers use loadAll.
  useEffect(() => {
    let on = true;
    getOffers()
      .then((data) => {
        if (on) setOffers(data);
      })
      .catch((err: any) => {
        if (on) setError("Load error: " + err.message);
      })
      .finally(() => {
        if (on) setLoading(false);
      });
    return () => {
      on = false;
    };
  }, []);

  const openNew = () => {
    setEditing({
      title: "",
      badge: "LIMITED DEAL",
      description: "",
      discount: "Flat ₹ 2,000 OFF",
      appliesTo: "all",
      banner: "",
      active: true,
    });
    setIsNew(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const saved = await saveOffer(editing, isNew ? undefined : editing.id);
      void logAdminAction({
        action: isNew ? "CREATE" : "UPDATE",
        entity: "Offer",
        entityId: saved.id,
        description: `${isNew ? "Created" : "Updated"} offer "${editing.title}"`,
      });
      setSuccess(`Offer "${editing.title}" saved to Firestore.`);
      setTimeout(() => setSuccess(""), 3000);
      setEditing(null);
      loadAll();
    } catch (err: any) {
      setError("Failed to save offer: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (o: FirestoreOffer) => {
    if (!o.id) return;
    if (!confirm(`Delete offer "${o.title}"?`)) return;
    try {
      await deleteOffer(o.id);
      void logAdminAction({
        action: "DELETE",
        entity: "Offer",
        entityId: o.id,
        description: `Deleted offer "${o.title ?? o.id}"`,
      });
      setOffers((prev) => prev.filter((x) => x.id !== o.id));
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  return (
    <div className="space-y-4">
      {success && <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold">✓ {success}</div>}
      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">{error}</div>}

      <div className="flex justify-end">
        <button onClick={openNew} className="adm-btn adm-btn-gold text-xs py-2 px-3.5">
          + Add New Offer
        </button>
      </div>

      <div className="adm-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading offers from Firestore...</div>
        ) : offers.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No offers found. Click &quot;+ Add New Offer&quot; to create one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Banner</th>
                  <th className="px-4 py-3">Offer Title</th>
                  <th className="px-4 py-3">Badge</th>
                  <th className="px-4 py-3">Discount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {offers.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5">
                      <div className="w-16 h-10 rounded bg-slate-100 overflow-hidden border border-slate-200">
                        {o.banner ? <img src={o.banner} alt="" className="w-full h-full object-cover" /> : null}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-bold text-slate-900">{o.title}</td>
                    <td className="px-4 py-2.5 font-mono text-[#B88900]">{o.badge}</td>
                    <td className="px-4 py-2.5">{o.discount}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${o.active !== false ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                        {o.active !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => { setEditing({ ...o }); setIsNew(false); }} className="px-2.5 py-1 rounded bg-slate-100 hover:bg-amber-100 text-slate-700 font-semibold">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(o)} className="px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 font-semibold">
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

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">{isNew ? "Create Offer" : `Edit: ${editing.title}`}</h2>
              <button onClick={() => setEditing(null)} className="text-slate-400 font-bold text-lg">✕</button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Offer Title <span className="text-red-500">*</span></label>
                <input type="text" required value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="adm-input text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Badge Text</label>
                  <input type="text" value={editing.badge || ""} onChange={(e) => setEditing({ ...editing, badge: e.target.value })} className="adm-input text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Discount Amount</label>
                  <input type="text" value={editing.discount || ""} onChange={(e) => setEditing({ ...editing, discount: e.target.value })} className="adm-input text-xs" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea rows={2} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="adm-input text-xs" />
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <ImageUploader value={editing.banner || ""} onChange={(url) => setEditing({ ...editing, banner: url })} folder="offers" label="Upload Offer Banner" />
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
                <input type="checkbox" checked={editing.active !== false} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} className="rounded text-amber-600 focus:ring-amber-500" />
                <span>Active on Storefront</span>
              </label>
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setEditing(null)} className="adm-btn adm-btn-line text-xs py-2 px-3">Cancel</button>
                <button type="submit" disabled={saving} className="adm-btn adm-btn-gold text-xs py-2 px-4 font-bold">{saving ? "Saving..." : "Save Offer"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function CouponsTab() {
  const [coupons, setCoupons] = useState<FirestoreCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FirestoreCoupon | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const loadAll = async () => {
    setLoading(true);
    try {
      const data = await getCoupons();
      setCoupons(data);
    } catch (err: any) {
      setError("Load error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Mount-time load: only starts the module-level Firestore read; state is
  // updated inside the promise callbacks (the pattern accepted by
  // react-hooks/set-state-in-effect). The save/delete handlers use loadAll.
  useEffect(() => {
    let on = true;
    getCoupons()
      .then((data) => {
        if (on) setCoupons(data);
      })
      .catch((err: any) => {
        if (on) setError("Load error: " + err.message);
      })
      .finally(() => {
        if (on) setLoading(false);
      });
    return () => {
      on = false;
    };
  }, []);

  const openNew = () => {
    setEditing({
      code: "",
      discountType: "percent",
      discountValue: 10,
      minOrder: 15000,
      maxDiscount: 2500,
      description: "Special festival discount",
      active: true,
      expiresAt: Date.now() + 30 * 86400000,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.code.trim()) {
      setError("Coupon Code is required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveCoupon({
        ...editing,
        code: editing.code.trim().toUpperCase(),
        minOrder: Number(editing.minOrder) || 0,
        discountValue: Number(editing.discountValue) || 0,
        maxDiscount: Number(editing.maxDiscount) || 0,
        active: editing.active !== false,
      });
      void logAdminAction({
        action: "UPDATE",
        entity: "Coupon",
        entityId: editing.code.toUpperCase(),
        description: `Saved coupon "${editing.code.toUpperCase()}"`,
      });
      setSuccess(`Coupon "${editing.code.toUpperCase()}" saved to Firestore.`);
      setTimeout(() => setSuccess(""), 3000);
      setEditing(null);
      loadAll();
    } catch (err: any) {
      setError("Failed to save coupon: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: FirestoreCoupon) => {
    if (!c.code) return;
    if (!confirm(`Permanently delete coupon "${c.code}" from Firestore?`)) return;
    try {
      await deleteCoupon(c.code);
      void logAdminAction({
        action: "DELETE",
        entity: "Coupon",
        entityId: c.code,
        description: `Deleted coupon "${c.code}"`,
      });
      setCoupons((prev) => prev.filter((x) => x.code !== c.code));
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  return (
    <div className="space-y-4">
      {success && <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold">✓ {success}</div>}
      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">{error}</div>}

      <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between">
        <div>
          <span className="font-bold">First Order Scratch Reward:</span>
          <span className="ml-1">Code <code className="font-mono bg-white px-1 py-0.5 rounded border border-amber-300">FIRST199</code> is reserved for the 1st order scratch card and stored in <code className="font-mono text-[11px]">users/{'{uid}'}/rewards/firstOrder</code>.</span>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={openNew} className="adm-btn adm-btn-gold text-xs py-2 px-3.5">
          + Add New Coupon
        </button>
      </div>

      <div className="adm-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading coupons from Firestore...</div>
        ) : coupons.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No custom coupons found. Click &quot;+ Add New Coupon&quot; to create one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Discount</th>
                  <th className="px-4 py-3">Min Order</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {coupons.map((c) => (
                  <tr key={c.code} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{c.code}</td>
                    <td className="px-4 py-2.5 font-semibold text-emerald-700">
                      {c.discountType === "percent" ? `${c.discountValue || 0}%` : `₹ ${c.discountValue || 0}`} OFF
                    </td>
                    <td className="px-4 py-2.5">₹ {Number(c.minOrder || 0).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString("en-IN") : "Never"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.active !== false ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                        {c.active !== false ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setEditing({ ...c })} className="px-2.5 py-1 rounded bg-slate-100 hover:bg-amber-100 text-slate-700 font-semibold">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(c)} className="px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 font-semibold">
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

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Configure Coupon</h2>
              <button onClick={() => setEditing(null)} className="text-slate-400 font-bold text-lg">✕</button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Coupon Code <span className="text-red-500">*</span></label>
                <input type="text" required value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} placeholder="e.g. FESTIVAL10" className="adm-input text-xs font-mono font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                  <select value={editing.discountType || "percent"} onChange={(e) => setEditing({ ...editing, discountType: e.target.value as any })} className="adm-input text-xs">
                    <option value="percent">Percentage (%)</option>
                    <option value="flat">Flat Amount (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Discount Value</label>
                  <input type="number" required value={editing.discountValue || 0} onChange={(e) => setEditing({ ...editing, discountValue: Number(e.target.value) })} className="adm-input text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Min Order (₹)</label>
                  <input type="number" value={editing.minOrder || 0} onChange={(e) => setEditing({ ...editing, minOrder: Number(e.target.value) })} className="adm-input text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Max Cap (₹)</label>
                  <input type="number" value={editing.maxDiscount || 0} onChange={(e) => setEditing({ ...editing, maxDiscount: Number(e.target.value) })} className="adm-input text-xs" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <input type="text" value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="adm-input text-xs" />
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
                <input type="checkbox" checked={editing.active !== false} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} className="rounded text-amber-600 focus:ring-amber-500" />
                <span>Coupon Active for Checkout</span>
              </label>
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setEditing(null)} className="adm-btn adm-btn-line text-xs py-2 px-3">Cancel</button>
                <button type="submit" disabled={saving} className="adm-btn adm-btn-gold text-xs py-2 px-4 font-bold">{saving ? "Saving..." : "Save Coupon"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
