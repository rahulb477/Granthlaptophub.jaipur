"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CUSTOMER_WEBSITE_URL } from "@/lib/firebase";
import {
  getProducts,
  getCategories,
  getBrands,
  getAllCustomerOrders,
  getAllCustomers,
  getBlogPosts,
  getOffers,
  getVideos,
  getEnquiries,
  FirestoreProduct,
  UserOrder,
} from "@/lib/firestore-service";
import { TableCard, RowMenu } from "@/admin/lib";

/* ---------- helpers (pure presentation over real data) ---------- */
function toMs(v: any): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v?.seconds === "number") return v.seconds * 1000;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}
function inr(n: number) {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}
function fmtDay(ms: number) {
  return new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
function orderStatusTone(status: string) {
  const s = (status || "").toLowerCase();
  if (s.includes("deliver")) return "pill pill-green";
  if (s.includes("cancel")) return "pill pill-red";
  if (s.includes("confirm")) return "pill pill-green";
  if (s.includes("process")) return "pill pill-blue";
  if (s.includes("ship")) return "pill pill-violet";
  return "pill pill-amber";
}

/* ---------- stat card ---------- */
function StatCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  tone: string;
}) {
  return (
    <div className="adm-stat">
      <span className={`adm-stat-icon ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        <p className="text-[26px] leading-tight font-extrabold tracking-tight text-[#111827] truncate">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

/* ---------- sales chart (pure SVG over real order buckets) ---------- */
function SalesChart({ orders }: { orders: UserOrder[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const buckets = useMemo(() => {
    const days = 14;
    const out: { label: string; revenue: number; count: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const start = today.getTime() - i * 86400000;
      const end = start + 86400000;
      let revenue = 0;
      let count = 0;
      for (const o of orders) {
        const t = toMs(o.createdAt);
        if (t >= start && t < end) {
          count += 1;
          if ((o.status || "").toLowerCase() !== "cancelled") revenue += Number(o.total) || 0;
        }
      }
      out.push({ label: fmtDay(start), revenue, count });
    }
    return out;
  }, [orders]);

  const hasData = buckets.some((b) => b.count > 0);
  if (!hasData) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm font-bold text-slate-600">Not enough order history yet</p>
        <p className="text-[12px] text-slate-400 mt-1">The sales chart appears automatically once dated orders exist in Firestore.</p>
      </div>
    );
  }

  const W = 720, H = 240, P = { l: 56, r: 12, t: 12, b: 30 };
  const maxRev = Math.max(...buckets.map((b) => b.revenue), 1);
  const maxCnt = Math.max(...buckets.map((b) => b.count), 1);
  const x = (i: number) => P.l + (i / (buckets.length - 1)) * (W - P.l - P.r);
  const yRev = (v: number) => P.t + (1 - v / maxRev) * (H - P.t - P.b);
  const yCnt = (v: number) => P.t + (1 - v / maxCnt) * (H - P.t - P.b);
  const line = (pts: [number, number][]) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const revPts = buckets.map((b, i) => [x(i), yRev(b.revenue)] as [number, number]);
  const cntPts = buckets.map((b, i) => [x(i), yCnt(b.count)] as [number, number]);
  const area = (pts: [number, number][]) =>
    `${line(pts)}L${x(buckets.length - 1).toFixed(1)},${(H - P.b).toFixed(1)}L${x(0).toFixed(1)},${(H - P.b).toFixed(1)}Z`;

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxRev * f));

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Sales overview chart">
        {ticks.map((t, i) => {
          const y = P.t + (1 - i / 4) * (H - P.t - P.b);
          return (
            <g key={i}>
              <line x1={P.l} x2={W - P.r} y1={y} y2={y} className="adm-chart-grid" />
              <text x={P.l - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8" fontWeight="600">
                {t >= 1000 ? `₹${(t / 1000).toFixed(t >= 100000 ? 0 : 1)}k` : `₹${t}`}
              </text>
            </g>
          );
        })}
        <path d={area(revPts)} className="adm-chart-area-rev" />
        <path d={area(cntPts)} className="adm-chart-area-ord" />
        <path d={line(revPts)} className="adm-chart-line-rev" />
        <path d={line(cntPts)} className="adm-chart-line-ord" />
        {revPts.map((p, i) => (
          <circle key={"r" + i} cx={p[0]} cy={p[1]} r={hover === i ? 5 : 3.5} className="adm-chart-dot-rev" />
        ))}
        {cntPts.map((p, i) => (
          <circle key={"c" + i} cx={p[0]} cy={p[1]} r={hover === i ? 5 : 3.5} className="adm-chart-dot-ord" />
        ))}
        {buckets.map((b, i) =>
          i % 2 === 0 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8" fontWeight="600">
              {b.label}
            </text>
          ) : null
        )}
        {buckets.map((b, i) => (
          <rect
            key={"h" + i}
            x={x(i) - (W / buckets.length) / 2}
            y={P.t}
            width={W / buckets.length}
            height={H - P.t - P.b}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>
      {hover !== null && (
        <div
          className="absolute z-10 bg-white border border-slate-200 rounded-xl shadow-xl px-3 py-2 text-xs pointer-events-none"
          style={{
            left: `min(max(${(x(hover) / W) * 100}%, 70px), calc(100% - 70px))`,
            top: 0,
            transform: "translate(-50%, -6px)",
          }}
        >
          <p className="font-bold text-slate-800">{buckets[hover].label}</p>
          <p className="text-slate-500">Revenue: <span className="font-bold text-[#0F172A]">{inr(buckets[hover].revenue)}</span></p>
          <p className="text-slate-500">Orders: <span className="font-bold text-[#B88900]">{buckets[hover].count}</span></p>
        </div>
      )}
    </div>
  );
}

const QA_ICON: Record<string, React.ReactNode> = {
  box: <path d="M12 2 3 7v10l9 5 9-5V7Z" />,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  tag: <><path d="M2 12V4a2 2 0 0 1 2-2h8l10 10-10 10Z" /><circle cx="7.5" cy="7.5" r="1" /></>,
  percent: <><path d="m19 5-14 14" /><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /></>,
  doc: <><path d="M6 2h8l4 4v16H6Z" /><path d="M14 2v4h4" /><path d="M9 12h6M9 16h6" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></>,
};
function QaIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 text-[#0F172A]" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {QA_ICON[name]}
    </svg>
  );
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<FirestoreProduct[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [videos, setVideos] = useState<any[]>([]);
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [error, setError] = useState("");

  /* SAME data layer as before — only added getEnquiries (existing fn) for the stat card */
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      setError("");
      try {
        const [p, c, b, o, cu, bl, of, v, e] = await Promise.all([
          getProducts(),
          getCategories(),
          getBrands(),
          getAllCustomerOrders(),
          getAllCustomers(),
          getBlogPosts(),
          getOffers(),
          getVideos(),
          getEnquiries(),
        ]);
        setProducts(p);
        setCategories(c);
        setBrands(b);
        setOrders(o);
        setCustomers(cu);
        setBlogPosts(bl);
        setOffers(of);
        setVideos(v);
        setEnquiries(e);
      } catch (err: any) {
        console.error("Dashboard data load error:", err);
        setError("Could not load fresh data from Firestore. Check permissions or network.");
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  const totalRevenue = useMemo(
    () => orders.filter((o) => (o.status || "").toLowerCase() !== "cancelled").reduce((s, o) => s + (Number(o.total) || 0), 0),
    [orders]
  );

  /* Top sellers from REAL order items */
  const topSellers = useMemo(() => {
    const agg = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of orders) {
      if ((o.status || "").toLowerCase() === "cancelled") continue;
      const items = Array.isArray(o.items) ? o.items : [];
      for (const it of items) {
        const key = String(it.productId || it.id || it.name || "unknown");
        const cur = agg.get(key) ?? { name: it.name || it.title || "Product", qty: 0, revenue: 0 };
        const q = Number(it.qty ?? it.quantity ?? 1) || 1;
        const price = Number(it.price ?? it.unitPrice ?? 0) || 0;
        cur.qty += q;
        cur.revenue += q * price;
        agg.set(key, cur);
      }
    }
    const imgOf = (name: string) => products.find((p) => p.name === name)?.image || products.find((p) => p.name === name)?.images?.[0] || "";
    return [...agg.entries()]
      .map(([id, v]) => ({ id, ...v, image: imgOf(v.name) }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 4);
  }, [orders, products]);

  /* Popular categories from REAL product counts */
  const popularCats = useMemo(() => {
    return categories
      .map((c: any) => {
        const list = products.filter((p: any) => p.categoryId === c.id || p.category === c.id || p.category === c.name || p.categoryName === c.name);
        const active = list.filter((p: any) => (p.status || "published") === "published").length;
        return { id: c.id, name: c.name || "Category", total: list.length, active };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 4);
  }, [categories, products]);

  const featuredOffer = useMemo(() => offers.find((o: any) => o.active !== false) ?? offers[0], [offers]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B88900]">Granth Laptop Hub · Jaipur, Rajasthan</p>
          <h1 className="text-[26px] font-extrabold tracking-tight text-[#111827]">Dashboard</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Welcome back! Here&apos;s what&apos;s happening with your store.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-xl bg-white border border-[#E8EDF5] text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live · Firestore
          </span>
          <a
            href={CUSTOMER_WEBSITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="adm-btn adm-btn-line text-[13px] !rounded-xl font-semibold hidden sm:inline-flex"
          >
            View Website
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h6v6" /><path d="M10 14 20 4" /><path d="M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6" /></svg>
          </a>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-[13px] font-medium p-3.5" role="alert">
          {error}
        </div>
      )}

      {/* Stat cards — real counts only, no fabricated trends */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Total Orders"
          value={loading ? "…" : orders.length}
          sub={loading ? undefined : `${orders.filter((o) => (o.status || "").toLowerCase().includes("place") || (o.status || "").toLowerCase() === "pending").length} awaiting fulfillment`}
          tone="bg-sky-50 text-sky-600"
          icon={<svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2.5 3.5h3l2.6 12h10.4l2-8.5H6.6" /></svg>}
        />
        <StatCard
          label="Total Revenue"
          value={loading ? "…" : inr(totalRevenue)}
          sub="Excludes cancelled orders"
          tone="bg-emerald-50 text-emerald-600"
          icon={<span className="text-[22px] font-extrabold">₹</span>}
        />
        <StatCard
          label="Total Customers"
          value={loading ? "…" : customers.length}
          sub={loading ? undefined : `${products.length} products live`}
          tone="bg-violet-50 text-violet-600"
          icon={<svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1.2-3.2 3.7-5 6.5-5s5.3 1.8 6.5 5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M17.8 15.4c1.8.6 3.2 2 4 4.6" /></svg>}
        />
        <StatCard
          label="Total Enquiries"
          value={loading ? "…" : enquiries.length}
          sub={loading ? undefined : `${enquiries.filter((e: any) => (e.status || "new") === "new").length} new enquiries`}
          tone="bg-emerald-50 text-emerald-600"
          icon={<svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3Z" /><path d="M9 8.8c.3 2.8 1.4 4 4.2 4.3l.9-1 1.6 1-1 1.6c-3.4-.3-5.4-2.3-5.7-5.7l1.6-1Z" /></svg>}
        />
      </div>

      {/* Sales overview + quick actions */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="adm-card p-5 sm:p-6 xl:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[15px] font-bold text-[#111827] tracking-tight">Sales Overview</p>
            <div className="flex items-center gap-4 text-[12px] font-semibold text-slate-500">
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#0F172A]" />Revenue</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#D6A600]" />Orders</span>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 mb-3">Last 14 days · computed from real Firestore orders</p>
          {loading ? (
            <div className="space-y-3 py-6"><div className="adm-skeleton h-40 w-full" /></div>
          ) : (
            <SalesChart orders={orders} />
          )}
        </div>

        <div className="adm-card p-5 sm:p-6">
          <p className="text-[15px] font-bold text-[#111827] tracking-tight mb-4">Quick Actions</p>
          <div className="grid grid-cols-3 xl:grid-cols-3 sm:grid-cols-6 gap-2.5">
            {[
              { label: "Add Product", href: "/admin/products/new", icon: "box" },
              { label: "Add Category", href: "/admin/categories", icon: "grid" },
              { label: "Add Brand", href: "/admin/brands", icon: "tag" },
              { label: "Create Offer", href: "/admin/offers", icon: "percent" },
              { label: "Add Blog Post", href: "/admin/blog", icon: "doc" },
            ].map((a) => (
              <Link key={a.label} href={a.href} className="adm-qa">
                <QaIcon name={a.icon} />
                <span className="text-[11px] font-semibold text-slate-700 leading-tight">{a.label}</span>
              </Link>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 border border-slate-100 p-3 text-[11px] text-slate-500">
            {blogPosts.length} posts · {videos.length} videos · {offers.length} offers · {brands.length} brands live in Firestore.
          </div>
        </div>
      </div>

      {/* Recent orders + enquiries */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <TableCard title="Recent Orders" viewAllHref="/admin/orders">
          {loading ? (
            <div className="space-y-2 py-2"><div className="adm-skeleton h-9 w-full" /><div className="adm-skeleton h-9 w-full" /><div className="adm-skeleton h-9 w-full" /></div>
          ) : orders.length === 0 ? (
            <p className="text-[13px] text-slate-400 text-center py-8">No orders in Firestore yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="adm-table min-w-[560px]">
                <thead><tr><th>#</th><th>Customer</th><th>Items</th><th>Amount</th><th>Status</th><th>Date</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {orders.slice(0, 5).map((o, i) => (
                    <tr key={o.id}>
                      <td className="font-mono font-bold text-[12px]">#{(o.id || "").slice(0, 6).toUpperCase() || i + 1}</td>
                      <td className="font-semibold">{o.customerName || "Customer"}</td>
                      <td>{Array.isArray(o.items) ? o.items.length : 1}</td>
                      <td className="font-bold">{inr(Number(o.total) || 0)}</td>
                      <td><span className={orderStatusTone(o.status)}>{o.status || "Placed"}</span></td>
                      <td className="text-slate-500 text-[12px]">{toMs(o.createdAt) ? fmtDay(toMs(o.createdAt)) : "—"}</td>
                      <td className="text-right"><RowMenu actions={[{ label: "View Orders", href: "/admin/orders" }]} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TableCard>

        <TableCard title="Recent Enquiries" viewAllHref="/admin/enquiries">
          {loading ? (
            <div className="space-y-2 py-2"><div className="adm-skeleton h-9 w-full" /><div className="adm-skeleton h-9 w-full" /><div className="adm-skeleton h-9 w-full" /></div>
          ) : enquiries.length === 0 ? (
            <p className="text-[13px] text-slate-400 text-center py-8">No enquiries in Firestore yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="adm-table min-w-[520px]">
                <thead><tr><th>Name</th><th>Product</th><th>Source</th><th>Date</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>
                  {enquiries.slice(0, 5).map((e: any) => {
                    const src = String(e.source || "website").toLowerCase();
                    const wa = src.includes("whatsapp");
                    return (
                      <tr key={e.id}>
                        <td className="font-semibold">{e.name || "—"}</td>
                        <td className="text-slate-500 max-w-[140px] truncate">{e.productName || e.product || "—"}</td>
                        <td>
                          <span className={wa ? "pill pill-whatsapp" : "pill pill-blue"}>
                            {wa ? "WhatsApp" : e.source || "Website"}
                          </span>
                        </td>
                        <td className="text-slate-500 text-[12px]">{toMs(e.createdAt) ? fmtDay(toMs(e.createdAt)) : "—"}</td>
                        <td className="text-right"><RowMenu actions={[{ label: "View Enquiries", href: "/admin/enquiries" }]} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TableCard>
      </div>

      {/* Top sellers + popular categories + promo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TableCard title="Top Selling Products" viewAllHref="/admin/products">
          {loading ? (
            <div className="space-y-2 py-2"><div className="adm-skeleton h-9 w-full" /><div className="adm-skeleton h-9 w-full" /></div>
          ) : topSellers.length === 0 ? (
            <p className="text-[13px] text-slate-400 text-center py-8">Sales ranking appears once orders with items exist.</p>
          ) : (
            <table className="adm-table">
              <thead><tr><th>#</th><th>Product</th><th>Sold</th><th>Revenue</th></tr></thead>
              <tbody>
                {topSellers.map((t, i) => (
                  <tr key={t.id}>
                    <td className="text-slate-400 font-bold">{i + 1}</td>
                    <td>
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="w-9 h-9 rounded-lg bg-slate-100 overflow-hidden shrink-0 grid place-items-center">
                          {t.image ? <img src={t.image} alt="" className="w-full h-full object-cover" loading="lazy" /> : <span className="text-slate-300 text-xs">▦</span>}
                        </span>
                        <span className="font-semibold truncate max-w-[140px]" title={t.name}>{t.name}</span>
                      </span>
                    </td>
                    <td className="font-bold">{t.qty}</td>
                    <td className="font-bold">{inr(t.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableCard>

        <TableCard title="Popular Categories" viewAllHref="/admin/categories">
          {loading ? (
            <div className="space-y-2 py-2"><div className="adm-skeleton h-9 w-full" /><div className="adm-skeleton h-9 w-full" /></div>
          ) : popularCats.length === 0 ? (
            <p className="text-[13px] text-slate-400 text-center py-8">No categories in Firestore yet.</p>
          ) : (
            <table className="adm-table">
              <thead><tr><th>#</th><th>Category</th><th>Products</th><th>Listed</th></tr></thead>
              <tbody>
                {popularCats.map((c, i) => (
                  <tr key={c.id}>
                    <td className="text-slate-400 font-bold">{i + 1}</td>
                    <td className="font-semibold">{c.name}</td>
                    <td className="font-bold">{c.total}</td>
                    <td><span className="pill pill-green">{c.active} live</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableCard>

        <div className="rounded-2xl overflow-hidden relative min-h-[240px] flex flex-col justify-between p-6 text-white" style={{ background: "linear-gradient(140deg,#0F172A 0%,#1F2937 70%)" }}>
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{ background: "repeating-conic-gradient(from 0deg at 85% 30%, rgba(214,166,0,.35) 0deg 8deg, transparent 8deg 16deg)" }}
            aria-hidden
          />
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#D6A600]">
              {featuredOffer ? (featuredOffer.badge || featuredOffer.title || "Featured Offer") : "CMS Spotlight"}
            </p>
            <p className="text-[22px] font-extrabold leading-snug mt-2 max-w-[220px]">
              {featuredOffer ? (featuredOffer.title || featuredOffer.name || "Grow Your Computer Business with Digital Power") : "Grow Your Computer Business with Digital Power"}
            </p>
            {featuredOffer?.description && (
              <p className="text-[12px] text-white/70 mt-1.5 line-clamp-2 max-w-[240px]">{featuredOffer.description}</p>
            )}
          </div>
          <div className="relative mt-5">
            <Link
              href="/admin/homepage"
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold text-[#111827] transition hover:brightness-105"
              style={{ background: "linear-gradient(135deg,#D6A600,#D6A600)" }}
            >
              Manage Homepage
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16" /><path d="m14 6 6 6-6 6" /></svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
