"use client";
import React, { useState } from "react";
import { PageHead } from "@/admin/lib";
import {
  getProducts,
  getCategories,
  getBrands,
  getBlogPosts,
  getVideos,
  getOffers,
  getCoupons,
  getReviews,
  getEnquiries,
  getAllCustomers,
  getAllCustomerOrders,
} from "@/lib/firestore-service";

const ITEMS = [
  { col: "products", label: "Products", desc: "Full Firestore catalogue — the live customer website data", loader: getProducts },
  { col: "categories", label: "Categories", desc: "All categories with order & status", loader: getCategories },
  { col: "brands", label: "Brands", desc: "All brands with logos", loader: getBrands },
  { col: "orders", label: "Orders", desc: "Customer orders from users/{uid}/orders + root orders", loader: getAllCustomerOrders },
  { col: "customers", label: "Customers", desc: "Firestore users (no password data — never stored)", loader: getAllCustomers },
  { col: "enquiries", label: "Enquiries", desc: "All enquiries with source & status", loader: getEnquiries },
  { col: "blogPosts", label: "Blog Posts", desc: "Full content, drafts included", loader: getBlogPosts },
  { col: "videos", label: "Videos", desc: "All video cards", loader: getVideos },
  { col: "offers", label: "Offers", desc: "All promotional offers", loader: getOffers },
  { col: "coupons", label: "Coupons", desc: "All coupon codes", loader: getCoupons },
  { col: "reviews", label: "Reviews", desc: "All reviews with approval status", loader: getReviews },
];

function download(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(rows: any[]) {
  if (!rows.length) return "";
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r)))).filter(
    (k) => !["createdAt", "updatedAt"].includes(k)
  );
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}

function clean(rows: any[]) {
  return rows.map((r) => {
    const c: any = { ...r };
    for (const k of ["createdAt", "updatedAt"]) {
      if (c[k]?.toDate) c[k] = c[k].toDate().toISOString();
      else if (c[k]?.toMillis) c[k] = new Date(c[k].toMillis()).toISOString();
    }
    return c;
  });
}

export default function BackupPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function exportCol(col: string, format: "json" | "csv") {
    const item = ITEMS.find((i) => i.col === col);
    if (!item) return;
    setBusy(col + format);
    setMsg("");
    try {
      const rows: any[] = await (item.loader as any)();
      const cleaned = clean(rows);
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === "json") {
        download(`${col}-firestore-${stamp}.json`, JSON.stringify(cleaned, null, 2), "application/json");
      } else {
        download(`${col}-firestore-${stamp}.csv`, toCsv(cleaned), "text/csv");
      }
      setMsg(`Exported ${cleaned.length} ${col} rows from Firestore.`);
    } catch (e: any) {
      setMsg(`Export failed for ${col}: ${e?.message || e}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHead
        title="Backup / Export"
        desc="Exports read LIVE from Firestore project laptop-database-24873 — the same data the customer website uses. Never includes passwords."
      />
      {msg && <div className="adm-card p-3 mb-4 text-[13px] font-semibold text-slate-700">{msg}</div>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((it) => (
          <div key={it.col} className="adm-card p-5">
            <p className="font-bold text-slate-900">{it.label}</p>
            <p className="text-[12px] text-slate-400 mt-1 mb-1 font-mono">/{it.col === "orders" ? "users/{uid}/orders" : it.col === "customers" ? "users" : it.col}</p>
            <p className="text-[12px] text-slate-400 mb-4">{it.desc}</p>
            <div className="flex gap-2">
              <button disabled={!!busy} onClick={() => exportCol(it.col, "json")} className="adm-btn adm-btn-gold text-xs flex-1">
                {busy === it.col + "json" ? "…" : "JSON"}
              </button>
              <button disabled={!!busy} onClick={() => exportCol(it.col, "csv")} className="adm-btn adm-btn-line text-xs flex-1">
                {busy === it.col + "csv" ? "…" : "CSV"}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="adm-card p-5 mt-4 bg-slate-50">
        <p className="text-[13px] text-slate-600">
          <strong>Tip:</strong> schedule a monthly JSON export of Products + Orders into your own drive. Firestore remains the single source of truth the website reads in real time.
        </p>
      </div>
    </div>
  );
}
