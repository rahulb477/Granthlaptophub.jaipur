"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CUSTOMER_WEBSITE_URL, FIREBASE_PROJECT_ID } from "@/lib/firebase";
import { BRAND } from "@/lib/brand";
import { useAdminAuth } from "@/lib/firebase-auth";
import { getProducts, getAllCustomerOrders, getCategories, getAllCustomers } from "@/lib/firestore-service";
import { canAccess, ROLE_LABEL, normalizeRole, type Module } from "@/lib/permissions";

/* Flat nav in reference order. Labels match the reference image; every href
   points at an EXISTING working route — no functionality removed. */
const NAV: { label: string; href: string; icon: string; module: Module; badge?: string }[] = [
  { label: "Dashboard", href: "/admin", icon: "grid", module: "dashboard" },
  { label: "Products", href: "/admin/products", icon: "box", module: "products" },
  { label: "Categories", href: "/admin/categories", icon: "folder", module: "categories" },
  { label: "Brands", href: "/admin/brands", icon: "tag", module: "brands" },
  { label: "Orders", href: "/admin/orders", icon: "cart", module: "orders" },
  { label: "Customers", href: "/admin/customers", icon: "users", module: "customers" },
  { label: "Enquiries (WhatsApp)", href: "/admin/enquiries", icon: "whatsapp", module: "enquiries" },
  { label: "Homepage CMS", href: "/admin/homepage", icon: "home", module: "homepage" },
  { label: "Videos", href: "/admin/videos", icon: "play", module: "videos" },
  { label: "Pages", href: "/admin/footer", icon: "layout", module: "pages" },
  { label: "Blog", href: "/admin/blog", icon: "doc", module: "blog" },
  { label: "Offers & Coupons", href: "/admin/offers", icon: "percent", module: "offers" },
  { label: "First Order Reward", href: "/admin/rewards", icon: "percent", module: "rewards" },
  { label: "Testimonials", href: "/admin/reviews", icon: "chat", module: "reviews" },
  { label: "Appearance", href: "/admin/appearance", icon: "brush", module: "appearance" },
  { label: "SEO Settings", href: "/admin/seo", icon: "search", module: "seo" },
  { label: "Site Settings", href: "/admin/settings", icon: "gear", module: "settings" },
  { label: "Analytics", href: "/admin/analytics", icon: "chart", module: "analytics" },
  { label: "Admin Users", href: "/admin/users", icon: "shield", module: "adminUsers" },
  { label: "Backup & Export", href: "/admin/backup", icon: "download", module: "backup" },
  { label: "Activity Log", href: "/admin/activity", icon: "clock", module: "activity" },
  { label: "Website Connection", href: "/admin/connection", icon: "external", module: "connection" },
];

/** Maps a pathname to the module that guards it. */
export function moduleForPath(pathname: string): Module | null {
  const match = [...NAV]
    .sort((a, b) => b.href.length - a.href.length)
    .find((n) => pathname === n.href || pathname.startsWith(n.href + "/"));
  return match?.module ?? null;
}

function AIcon({ name, className = "w-[18px] h-[18px]" }: { name: string; className?: string }) {
  const p: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    home: <><path d="m3 10.5 9-7.5 9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></>,
    box: <><path d="M12 2 3 7v10l9 5 9-5V7Z" /><path d="M3 7l9 5 9-5" /><path d="M12 12v10" /></>,
    folder: <><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M3 11h18" /></>,
    tag: <><path d="M2 12V4a2 2 0 0 1 2-2h8l10 10-10 10Z" /><circle cx="7.5" cy="7.5" r="1" /></>,
    play: <><circle cx="12" cy="12" r="9" /><path d="M10 8.5v7l6-3.5Z" /></>,
    doc: <><path d="M6 2h8l4 4v16H6Z" /><path d="M14 2v4h4" /><path d="M9 12h6M9 16h6" /></>,
    percent: <><path d="m19 5-14 14" /><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /></>,
    star: <path d="m12 2.8 2.9 5.9 6.5 1-4.7 4.5 1.1 6.5L12 17.6l-5.8 3.1 1.1-6.5-4.7-4.5 6.5-1Z" />,
    cart: <><circle cx="9" cy="20" r="1.5" /><circle cx="18" cy="20" r="1.5" /><path d="M2.5 3.5h3l2.6 12h10.4l2-8.5H6.6" /></>,
    users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1.2-3.2 3.7-5 6.5-5s5.3 1.8 6.5 5" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M17.8 15.4c1.8.6 3.2 2 4 4.6" /></>,
    chat: <path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12Z" />,
    whatsapp: <><path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3Z" /><path d="M9 8.8c.3 2.8 1.4 4 4.2 4.3l.9-1 1.6 1-1 1.6c-3.4-.3-5.4-2.3-5.7-5.7l1.6-1Z" /></>,
    layout: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>,
    brush: <><path d="m14 5 5 5L8 21H3v-5Z" /><path d="m12 7 5 5" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 9" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
    gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></>,
    shield: <path d="M12 2 4 5.5V11c0 5 3.4 9.3 8 10.5 4.6-1.2 8-5.5 8-10.5V5.5Z" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M4 21h16" /></>,
    chart: <><path d="M3 21h18" /><path d="M6 17v-6M11 17V7M16 17v-9M21 17V4" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></>,
    bell: <><path d="M18 9a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 15 18 9Z" /><path d="M10 20a2.2 2.2 0 0 0 4 0" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    chevron: <path d="m9 6 6 6-6 6" />,
    chevronDown: <path d="m6 9 6 6 6-6" />,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none" /></>,
    facebook: <><path d="M14 8h2.5V4.5H14a4.5 4.5 0 0 0-4.5 4.5V12H7v3.5h2.5V21h3.5v-5.5h2.5l.5-3.5h-3V9a1 1 0 0 1 1-1Z" /></>,
    external: <><path d="M14 4h6v6" /><path d="M10 14 20 4" /><path d="M20 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h6" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {p[name] ?? p.box}
    </svg>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, role, logout } = useAdminAuth();
  const [drawer, setDrawer] = useState(false);
  const [q, setQ] = useState("");
  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  // Notifications counts from real Firestore (unchanged logic)
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  useEffect(() => {
    getAllCustomerOrders()
      .then((orders) => {
        const pending = orders.filter((o) => o.status === "Order Placed" || o.status === "pending").length;
        setPendingOrdersCount(pending);
      })
      .catch(() => {});
  }, [pathname]);

  // Keep tree-shaken reference so data layer import stays intact
  void getProducts;
  void getCategories;
  void getAllCustomers;
  void isAdmin;

  const handleLogout = async () => {
    await logout();
    router.push("/admin/login");
  };

  const sidebar = (
    <aside className="flex flex-col h-full" style={{ background: "#0F172A" }}>
      {/* Official Granth Laptop Hub logo in white rounded container */}
      <div className="px-4 pt-4 pb-3">
        <div className="bg-white rounded-xl px-3 py-3 shadow-sm">
          <img
            src={BRAND.logo}
            alt="Granth Laptop Hub — official logo"
            className="w-full h-[86px] object-contain"
            draggable={false}
          />
          <p className="text-center font-extrabold tracking-tight leading-none text-[#111827] text-[15px] mt-2">
            GRANTH LAPTOP HUB
          </p>
          <p className="text-center text-[9px] font-bold tracking-[0.32em] text-[#B88900] mt-1 pt-1.5 border-t border-slate-100">
            — JAIPUR, RAJASTHAN —
          </p>
        </div>
      </div>

      {/* Navigation (flat, reference order) */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-[2px] no-scrollbar" aria-label="Admin navigation">
        {NAV.filter((it) => canAccess(role, it.module)).map((it) => {
          const active = isActive(pathname, it.href);
          return (
            <Link
              key={it.href + it.label}
              href={it.href}
              onClick={() => setDrawer(false)}
              aria-current={active ? "page" : undefined}
              className={`adm-nav-item ${active ? "adm-nav-active" : ""}`}
            >
              <AIcon name={it.icon} />
              <span className="flex-1 truncate">{it.label}</span>
              {it.href === "/admin/orders" && pendingOrdersCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full grid place-items-center">
                  {pendingOrdersCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Brand socials + Logout */}
      <div className="p-3 border-t border-white/10 space-y-2">
        <div className="flex items-center justify-center gap-2 px-1">
          <a
            href={BRAND.instagram}
            target="_blank"
            rel="noopener noreferrer"
            title="Granth Laptop Hub on Instagram"
            aria-label="Granth Laptop Hub on Instagram"
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
          >
            <AIcon name="instagram" className="w-[18px] h-[18px]" />
          </a>
          <a
            href={BRAND.facebook}
            target="_blank"
            rel="noopener noreferrer"
            title="Granth Laptop Hub on Facebook"
            aria-label="Granth Laptop Hub on Facebook"
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
          >
            <AIcon name="facebook" className="w-[18px] h-[18px]" />
          </a>
          <a
            href={BRAND.whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            title={`WhatsApp ${BRAND.whatsapp}`}
            aria-label={`WhatsApp ${BRAND.whatsapp}`}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
          >
            <AIcon name="whatsapp" className="w-[18px] h-[18px]" />
          </a>
        </div>
        <button
          onClick={handleLogout}
          className="adm-nav-item w-full !text-[#ff8f8f] hover:!bg-red-500/10 hover:!text-red-300"
        >
          <AIcon name="logout" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen text-slate-800 flex" style={{ background: "#F7F8FA" }}>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-[248px] shrink-0 sticky top-0 h-screen">{sidebar}</div>

      {/* Mobile Drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[60] lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <div className="absolute inset-0 bg-[#0F172A]/60 backdrop-blur-sm adm-overlay" onClick={() => setDrawer(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[270px] max-w-[85vw] shadow-2xl adm-drawer" style={{ background: "#0F172A" }}>
            <button
              onClick={() => setDrawer(false)}
              aria-label="Close menu"
              className="absolute top-4 right-3 z-10 p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10"
            >
              <AIcon name="x" className="w-5 h-5" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-40 bg-white border-b border-[#E8EDF5] px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
          >
            <AIcon name="menu" className="w-5 h-5" />
          </button>

          {/* Search */}
          <div className="relative flex-1 max-w-xl">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <AIcon name="search" className="w-[18px] h-[18px]" />
            </span>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search orders, products, customers..."
              aria-label="Search orders, products, customers"
              className="w-full bg-[#F1F4FA] border border-transparent rounded-xl pl-10 pr-3 py-2.5 text-sm outline-none focus:bg-white focus:border-[#D6A600] focus:ring-2 focus:ring-[#D6A600]/20 transition"
            />
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <Link
              href="/admin/connection"
              title={`Firebase project: ${FIREBASE_PROJECT_ID}`}
              className="hidden xl:inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Firebase Live
            </Link>
            {/* View Website — SAME URL, Granth gold branding */}
            <a
              href={CUSTOMER_WEBSITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="adm-btn adm-btn-gold text-[13px] py-2 px-3 sm:px-4 inline-flex items-center gap-1.5 !rounded-xl font-bold"
              title="Open client-approved customer website in new tab"
            >
              <span className="hidden sm:inline">View Website</span>
              <span className="sm:hidden">Website</span>
              <AIcon name="external" className="w-4 h-4" />
            </a>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => { setBellOpen(!bellOpen); setUserOpen(false); }}
                className="relative p-2.5 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition"
                aria-label="Notifications"
                aria-expanded={bellOpen}
              >
                <AIcon name="bell" className="w-5 h-5" />
                {pendingOrdersCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold grid place-items-center">
                    {pendingOrdersCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div className="adm-pop right-0 top-full mt-2 w-72 text-xs">
                  <div className="px-4 py-3 border-b border-slate-100 font-bold text-slate-800 flex items-center justify-between">
                    <span>Notifications</span>
                    <span className="text-[11px] text-slate-400 font-normal">Firestore Live</span>
                  </div>
                  <div className="p-2 space-y-1">
                    <Link
                      href="/admin/orders"
                      onClick={() => setBellOpen(false)}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50 transition"
                    >
                      <span className="text-slate-700 font-medium">Pending Customer Orders</span>
                      <span className="font-bold text-[#B88900]">{pendingOrdersCount}</span>
                    </Link>
                    <Link
                      href="/admin/products"
                      onClick={() => setBellOpen(false)}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-50 transition"
                    >
                      <span className="text-slate-700 font-medium">Firestore Products Live</span>
                      <span className="text-emerald-600 font-bold">✓ Connected</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="relative">
              <button
                onClick={() => { setUserOpen(!userOpen); setBellOpen(false); }}
                className="flex items-center gap-2 py-1 pl-1 pr-1.5 rounded-full hover:bg-slate-100 transition"
                aria-label="Admin account menu"
                aria-expanded={userOpen}
              >
                <span
                  className="w-8 h-8 rounded-full grid place-items-center text-white text-xs font-bold shadow-sm overflow-hidden"
                  style={{ background: "linear-gradient(135deg,#0F172A,#1F2937)" }}
                >
                  {(user?.email?.[0] || "A").toUpperCase()}
                </span>
                <span className="hidden md:block text-sm font-semibold text-slate-800 truncate max-w-[110px]">
                  {user?.displayName || user?.email?.split("@")[0] || "Admin"}
                </span>
                <AIcon name="chevronDown" className="w-4 h-4 text-slate-400 hidden md:block" />
              </button>

              {userOpen && (
                <div className="adm-pop right-0 top-full mt-2 w-56 text-sm">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="font-bold truncate text-slate-800 text-[13px]">{user?.email || "Admin"}</p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">UID: {user?.uid}</p>
                    <span className="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wider bg-[#FFF9E8] text-[#B88900] px-2 py-0.5 rounded-full">
                      {ROLE_LABEL[normalizeRole(role)]}
                    </span>
                  </div>
                  {canAccess(role, "adminUsers") && (
                  <Link
                    href="/admin/users"
                    onClick={() => setUserOpen(false)}
                    className="block px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 font-medium transition"
                  >
                    Admin Users
                  </Link>
                  )}
                  <a
                    href={CUSTOMER_WEBSITE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-4 py-2.5 text-[13px] text-slate-700 hover:bg-slate-50 font-medium transition"
                  >
                    Open Customer Website ↗
                  </a>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-[13px] text-red-600 hover:bg-red-50 font-medium border-t border-slate-100 transition"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-6 xl:p-8 w-full mx-auto" style={{ maxWidth: 1400 }}>{children}</main>
      </div>
    </div>
  );
}
