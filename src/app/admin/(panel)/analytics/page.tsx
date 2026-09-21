"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHead, Loading, ErrorBox } from "@/admin/lib";
import {
  getAnalyticsSnapshot,
  orderMillis,
  orderTotal,
  toMillis,
  type AnalyticsSnapshot,
} from "@/lib/firestore-service";

/**
 * ANALYTICS — 100% real Firestore data.
 *
 * Every number below is derived from documents read through the AUTHENTICATED
 * Firebase client session (never the public REST API, never mock values).
 * Orders are de-duplicated inside getAllCustomerOrders(): the source of truth
 * is users/{uid}/orders and a root orders/{id} document is only merged when
 * the same order was not already collected, so nothing is double counted.
 */

const CANCELLED = "cancelled";

function inr(n: number) {
  return "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
}
function monthKey(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
/** Accepts Timestamp | number | ISO string | Date without crashing. */
const ts = toMillis;
function statusOf(o: any): string {
  return String(o?.status || "Order Placed").trim();
}

function Bars({
  rows,
  color = "linear-gradient(90deg,#0F172A,#1F2937)",
  format = (n: number) => String(n),
  empty,
}: {
  rows: [string, number][];
  color?: string;
  format?: (n: number) => string;
  empty: string;
}) {
  const max = Math.max(...rows.map(([, n]) => n), 1);
  if (rows.length === 0) return <p className="text-[13px] text-slate-400 text-center py-8">{empty}</p>;
  return (
    <div className="space-y-2.5">
      {rows.map(([label, n]) => (
        <div key={label}>
          <div className="flex items-center justify-between text-[12px] font-semibold mb-1">
            <span className="text-slate-600 capitalize truncate pr-2">{label}</span>
            <span className="text-[#111827] whitespace-nowrap">{format(n)}</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${(n / max) * 100}%`, background: color }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Panel({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="adm-card p-5 sm:p-6">
      <p className="text-[15px] font-bold text-[#111827] tracking-tight">{title}</p>
      <p className="text-[11px] text-slate-400 mb-4">{sub}</p>
      {children}
    </div>
  );
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [snap, setSnap] = useState<AnalyticsSnapshot | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        setSnap(await getAnalyticsSnapshot());
      } catch (err: any) {
        setError(err?.message || "Could not load analytics from Firestore.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const m = useMemo(() => {
    const s =
      snap ??
      ({
        products: [], categories: [], brands: [], orders: [], customers: [],
        enquiries: [], coupons: [], offers: [], reviews: [], blogPosts: [], videos: [],
        errors: [], loaded: [],
      } as AnalyticsSnapshot);

    const orders = s.orders;
    const live = orders.filter((o) => statusOf(o).toLowerCase() !== CANCELLED);

    const statusCount = (name: string) =>
      orders.filter((o) => statusOf(o).toLowerCase().includes(name)).length;

    const revenueAll = orders.reduce((sum, o) => sum + orderTotal(o as any), 0);
    const revenueLive = live.reduce((sum, o) => sum + orderTotal(o as any), 0);

    const group = <T,>(items: T[], key: (t: T) => string) => {
      const map = new Map<string, number>();
      for (const it of items) {
        const k = key(it) || "Other";
        map.set(k, (map.get(k) || 0) + 1);
      }
      return [...map.entries()].sort((a, b) => b[1] - a[1]);
    };

    const monthlyRevenue = (() => {
      const map = new Map<string, number>();
      for (const o of live) {
        const t = orderMillis(o);
        if (!t) continue;
        map.set(monthKey(t), (map.get(monthKey(t)) || 0) + orderTotal(o as any));
      }
      return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
    })();

    const monthlyOrders = (() => {
      const map = new Map<string, number>();
      for (const o of orders) {
        const t = orderMillis(o);
        if (!t) continue;
        map.set(monthKey(t), (map.get(monthKey(t)) || 0) + 1);
      }
      return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
    })();

    const signups = (() => {
      const map = new Map<string, number>();
      for (const c of s.customers) {
        const t = ts((c as any).createdAt ?? (c as any).createdAtMs ?? (c as any).registeredAt);
        if (!t) continue;
        map.set(monthKey(t), (map.get(monthKey(t)) || 0) + 1);
      }
      return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-8);
    })();

    const isPublished = (p: any) => (p.status || "published") === "published";
    const outOfStock = (p: any) => Number(p.stock ?? 0) <= 0;
    const activeOffer = (o: any) => o.active !== false;

    return {
      s,
      totals: {
        products: s.products.length,
        published: s.products.filter(isPublished).length,
        outOfStock: s.products.filter(outOfStock).length,
        categories: s.categories.length,
        brands: s.brands.length,
        orders: orders.length,
        pending: statusCount("placed") + statusCount("pending"),
        confirmed: statusCount("confirmed"),
        processing: statusCount("processing"),
        shipped: statusCount("shipped"),
        delivered: statusCount("delivered"),
        cancelled: statusCount("cancelled"),
        revenueAll,
        revenueLive,
        aov: live.length ? revenueLive / live.length : 0,
        customers: s.customers.length,
        enquiries: s.enquiries.length,
        coupons: s.coupons.length,
        activeOffers: s.offers.filter(activeOffer).length,
        reviews: s.reviews.length,
        blogPosts: s.blogPosts.length,
        videos: s.videos.length,
      },
      monthlyRevenue,
      monthlyOrders,
      signups,
      statusMix: group(orders, (o) => statusOf(o)),
      brandMix: group(s.products, (p: any) => String(p.brand || "Other")),
      categoryMix: group(s.products, (p: any) => String(p.category || p.categoryName || "Uncategorised")),
      sourceMix: group(s.enquiries, (e: any) => String(e.source || "website")),
    };
  }, [snap]);

  const kpis: { label: string; value: string; sub?: string }[] = [
    { label: "Total Revenue", value: inr(m.totals.revenueAll), sub: "All orders incl. cancelled" },
    { label: "Revenue (excl. cancelled)", value: inr(m.totals.revenueLive), sub: `${m.totals.orders - m.totals.cancelled} valid orders` },
    { label: "Average Order Value", value: m.totals.aov ? inr(m.totals.aov) : "—", sub: "Excludes cancelled" },
    { label: "Total Orders", value: String(m.totals.orders), sub: "Counted once each" },
    { label: "Total Customers", value: String(m.totals.customers), sub: "Registered users" },
    { label: "Total Products", value: String(m.totals.products), sub: `${m.totals.published} published` },
    { label: "Out of Stock", value: String(m.totals.outOfStock), sub: "Stock ≤ 0" },
    { label: "Categories / Brands", value: `${m.totals.categories} / ${m.totals.brands}` },
    { label: "Enquiries", value: String(m.totals.enquiries), sub: "WhatsApp + website" },
    { label: "Coupons", value: String(m.totals.coupons), sub: `${m.totals.activeOffers} active offers` },
    { label: "Reviews", value: String(m.totals.reviews) },
    { label: "Blog / Videos", value: `${m.totals.blogPosts} / ${m.totals.videos}` },
  ];

  const statusCards: { label: string; value: number; tone: string }[] = [
    { label: "Pending", value: m.totals.pending, tone: "bg-slate-100 text-slate-700" },
    { label: "Confirmed", value: m.totals.confirmed, tone: "bg-blue-50 text-blue-700" },
    { label: "Processing", value: m.totals.processing, tone: "bg-indigo-50 text-indigo-700" },
    { label: "Shipped", value: m.totals.shipped, tone: "bg-amber-50 text-amber-700" },
    { label: "Delivered", value: m.totals.delivered, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Cancelled", value: m.totals.cancelled, tone: "bg-red-50 text-red-700" },
  ];

  return (
    <div>
      <PageHead
        title="Analytics"
        desc="Real store performance computed live from Firestore products, orders, customers, enquiries and content. No sample or placeholder values."
      >
        <Link href="/admin/orders" className="adm-btn adm-btn-line text-xs">View Orders</Link>
        <Link href="/admin/backup" className="adm-btn adm-btn-gold text-xs">Backup &amp; Export</Link>
      </PageHead>

      {error && <div className="mb-4"><ErrorBox msg={error} /></div>}

      {!loading && snap && snap.errors.length > 0 && (
        <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-[12px] text-amber-900 space-y-2">
          <p className="font-bold">
            {snap.errors.length} collection{snap.errors.length === 1 ? "" : "s"} could not be read — the
            figures below exclude them. A blocked read is <strong>not</strong> reported as 0.
          </p>
          <ul className="space-y-1">
            {snap.errors.map((e) => (
              <li key={e.collection} className="flex flex-wrap items-center gap-2">
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    e.kind === "permission-denied"
                      ? "bg-red-100 text-red-700"
                      : e.kind === "unavailable"
                      ? "bg-slate-200 text-slate-700"
                      : "bg-amber-200 text-amber-900"
                  }`}
                >
                  {e.kind === "permission-denied"
                    ? "Permission denied"
                    : e.kind === "unavailable"
                    ? "Unavailable"
                    : "Query failed"}
                </span>
                <code className="font-mono font-bold">/{e.collection}</code>
                <span className="text-amber-800">{e.message}</span>
              </li>
            ))}
          </ul>
          {snap.errors.some((e) => e.kind === "permission-denied") && (
            <p>
              Permission errors mean this signed-in account is not recognised as an admin. Verify{" "}
              <code>adminUsers/&#123;uid&#125;</code> exists with <code>active == true</code> and that the
              deployed rules grant admin <code>list</code> access. This is an access problem, not missing data.
            </p>
          )}
        </div>
      )}

      {!loading && snap && snap.errors.length === 0 && (
        <div className="mb-4 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800">
          ✓ All {snap.loaded.length} collections read successfully with the authenticated admin session — every
          figure below reflects real Firestore data (a 0 here means 0 records).
        </div>
      )}

      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          {/* KPI grid */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {kpis.map((s) => (
              <div key={s.label} className="adm-card p-5">
                <p className="text-[12px] font-semibold text-slate-500">{s.label}</p>
                <p className="text-[24px] font-extrabold tracking-tight text-[#111827] mt-1">{s.value}</p>
                {s.sub && <p className="text-[11px] text-slate-400 mt-0.5">{s.sub}</p>}
              </div>
            ))}
          </div>

          {/* Order status breakdown */}
          <div className="adm-card p-5">
            <p className="text-[15px] font-bold text-[#111827] tracking-tight">Orders by Status</p>
            <p className="text-[11px] text-slate-400 mb-3">Live fulfilment pipeline · each order counted once</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
              {statusCards.map((c) => (
                <div key={c.label} className={`rounded-xl p-3 ${c.tone}`}>
                  <p className="text-[11px] font-bold uppercase tracking-wider opacity-70">{c.label}</p>
                  <p className="text-[22px] font-extrabold">{c.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Panel title="Revenue by Month" sub={`Last ${m.monthlyRevenue.length} active months · excludes cancelled`}>
              <Bars rows={m.monthlyRevenue} format={inr} empty="No dated orders yet." />
            </Panel>

            <Panel title="Orders by Month" sub="Order volume over time">
              <Bars rows={m.monthlyOrders} color="linear-gradient(90deg,#D6A600,#B88900)" empty="No dated orders yet." />
            </Panel>

            <Panel title="Orders by Status" sub="Distribution across all statuses">
              <Bars rows={m.statusMix} color="linear-gradient(90deg,#D6A600,#D6A600)" empty="No orders yet." />
            </Panel>

            <Panel title="Customer Signups" sub="New registered users per month">
              <Bars rows={m.signups} color="linear-gradient(90deg,#0EA5E9,#0369A1)" empty="No dated customer records yet." />
            </Panel>

            <Panel title="Products by Brand" sub="Catalog distribution">
              <Bars rows={m.brandMix.slice(0, 8)} empty="No products yet." />
            </Panel>

            <Panel title="Products by Category" sub="Catalog distribution">
              <Bars rows={m.categoryMix.slice(0, 8)} color="linear-gradient(90deg,#059669,#047857)" empty="No products yet." />
            </Panel>

            <Panel title="Enquiries by Source" sub="WhatsApp vs website demand">
              <Bars rows={m.sourceMix} color="linear-gradient(90deg,#10B981,#10B981)" empty="No enquiries yet." />
            </Panel>

            <Panel title="Catalog Health" sub="Stock & publishing status">
              <Bars
                rows={[
                  ["Published", m.totals.published],
                  ["Draft / archived", Math.max(0, m.totals.products - m.totals.published)],
                  ["Out of stock", m.totals.outOfStock],
                ]}
                color="linear-gradient(90deg,#6366F1,#4338CA)"
                empty="No products yet."
              />
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
