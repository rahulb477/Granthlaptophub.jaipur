"use client";
import React, { useEffect, useState } from "react";
import { PageHead, Card, Loading } from "@/admin/lib";
import {
  CUSTOMER_WEBSITE_URL,
  FIREBASE_PROJECT_ID,
  firebaseConfig,
} from "@/lib/firebase";
import { getProducts, getCategories, getDocData } from "@/lib/firestore-service";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface StatusState {
  loading: boolean;
  data: any;
  error: string;
}

const ADMIN_COLLECTIONS = ["users", "orders", "enquiries", "coupons", "adminUsers", "activityLog"];

export default function ConnectionPage() {
  const [status, setStatus] = useState<StatusState>({ loading: true, data: null, error: "" });
  const [clientCheck, setClientCheck] = useState({ products: -1, categories: -1, siteSettings: false, homepage: false, error: "" });
  /** Admin-only collections verified through the AUTHENTICATED Firebase session. */
  const [adminCheck, setAdminCheck] = useState<{ name: string; ok: boolean; detail: string }[]>([]);
  const [testing, setTesting] = useState(false);
  const [imgbb, setImgbb] = useState<{ state: "checking" | "ready" | "missing" | "error"; detail: string }>({ state: "checking", detail: "Checking…" });

  // Probes /api/upload-image with an empty payload: NO_FILE = key configured,
  // IMGBB_KEY_MISSING = server env var absent. Key itself is never returned.
  async function runImgbbCheck() {
    setImgbb({ state: "checking", detail: "Checking…" });
    try {
      const r = await fetch("/api/upload-image", { method: "POST", body: new FormData() });
      const j = await r.json().catch(() => ({}));
      if (j?.code === "IMGBB_KEY_MISSING") {
        setImgbb({ state: "missing", detail: "IMGBB_API_KEY is not set on the server — uploads will fail until the developer adds it." });
      } else if (j?.code === "NO_FILE" || r.status === 400) {
        setImgbb({ state: "ready", detail: "Upload endpoint ready — key configured server-side (never exposed to the browser)." });
      } else {
        setImgbb({ state: "error", detail: j?.error || `Endpoint responded with HTTP ${r.status}.` });
      }
    } catch (e: any) {
      setImgbb({ state: "error", detail: e?.message || "Could not reach the upload endpoint." });
    }
  }

  async function runServerCheck() {
    setStatus({ loading: true, data: null, error: "" });
    try {
      const r = await fetch("/api/firebase-status", { cache: "no-store" });
      const j = await r.json();
      setStatus({ loading: false, data: j, error: "" });
    } catch (e: any) {
      setStatus({ loading: false, data: null, error: e?.message || "Status check failed" });
    }
  }

  /**
   * Admin collections are checked with the signed-in Firebase client SDK —
   * NOT with public REST. A public REST 403 on these collections is the
   * CORRECT behaviour and does not mean Firebase is broken.
   */
  async function runAdminCheck() {
    const results = await Promise.all(
      ADMIN_COLLECTIONS.map(async (name) => {
        try {
          const snap = await getDocs(query(collection(db, name), limit(1)));
          return { name, ok: true, detail: snap.empty ? "readable (empty)" : "readable" };
        } catch (e: any) {
          const code = String(e?.code || "");
          return {
            name,
            ok: false,
            detail: code.includes("permission-denied")
              ? "permission denied for this signed-in account"
              : e?.message || "unreadable",
          };
        }
      })
    );
    setAdminCheck(results);
  }

  async function runClientCheck() {
    setTesting(true);
    setClientCheck({ products: -1, categories: -1, siteSettings: false, homepage: false, error: "" });
    try {
      const [prods, cats, site, home] = await Promise.all([
        getProducts(),
        getCategories(),
        getDocData("siteSettings", "main").catch(() => null),
        getDocData("homepage", "content").catch(() => null),
      ]);
      setClientCheck({
        products: prods.length,
        categories: cats.length,
        siteSettings: !!site,
        homepage: !!home,
        error: "",
      });
    } catch (e: any) {
      console.error(e);
      setClientCheck({ products: -1, categories: -1, siteSettings: false, homepage: false, error: e?.message || "Client Firestore read failed — check Firestore rules / login." });
    } finally {
      setTesting(false);
    }
  }

  useEffect(() => {
    runServerCheck();
    runClientCheck();
    runAdminCheck();
  }, []);

  const d = status.data;

  return (
    <div>
      <PageHead
        title="Website Connection"
        desc="This Admin Panel is connected to the SAME Firebase project as your live customer website. Every save here appears on the storefront."
      >
        <a href={CUSTOMER_WEBSITE_URL} target="_blank" rel="noreferrer" className="adm-btn adm-btn-gold text-xs">
          Open Customer Website ↗
        </a>
        <button onClick={() => { runServerCheck(); runClientCheck(); runAdminCheck(); runImgbbCheck(); }} className="adm-btn adm-btn-line text-xs">
          ↻ Re-run checks
        </button>
      </PageHead>

      {/* Architecture diagram */}
      <Card title="Live architecture">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-center text-[12px] font-bold">
          <div className="flex-1 rounded-xl bg-[#16233a] text-white px-4 py-3">ADMIN PANEL<br /><span className="font-mono font-normal text-[11px] text-white/70">this app</span></div>
          <div className="text-amber-600 text-lg">↓↑</div>
          <div className="flex-1 rounded-xl bg-[#FFF9E8] border border-amber-300 text-amber-900 px-4 py-3">
            FIREBASE · {FIREBASE_PROJECT_ID}<br />
            <span className="font-mono font-normal text-[11px]">Firestore + Auth · Images: ImgBB</span>
          </div>
          <div className="text-amber-600 text-lg">↓↑</div>
          <div className="flex-1 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3">
            CUSTOMER WEBSITE<br />
            <a href={CUSTOMER_WEBSITE_URL} target="_blank" rel="noreferrer" className="font-mono font-normal text-[11px] underline break-all">{CUSTOMER_WEBSITE_URL}</a>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        {/* Firebase config */}
        <Card title="Firebase project (owner-provided)">
          <div className="space-y-2 text-[13px] font-mono break-all">
            <p><span className="text-slate-400 font-sans font-semibold text-[11px] uppercase">Project ID</span><br /><strong>{firebaseConfig.projectId}</strong></p>
            <p><span className="text-slate-400 font-sans font-semibold text-[11px] uppercase">Auth Domain</span><br />{firebaseConfig.authDomain}</p>
            <p><span className="text-slate-400 font-sans font-semibold text-[11px] uppercase">Image Hosting</span><br />ImgBB via <code>/api/upload-image</code> (Firebase Storage not used)</p>
            <p><span className="text-slate-400 font-sans font-semibold text-[11px] uppercase">App ID</span><br />{firebaseConfig.appId}</p>
            <p><span className="text-slate-400 font-sans font-semibold text-[11px] uppercase">Customer site</span><br />{CUSTOMER_WEBSITE_URL}</p>
          </div>
          <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-[12px] text-slate-600">
            Config source: <code>NEXT_PUBLIC_FIREBASE_*</code> in <code>.env</code> (fallback = your pasted <code>firebaseConfig</code>).
            Both Admin and customer site must show project <code>laptop-database-24873</code>.
          </div>
        </Card>

        {/* Client SDK check */}
        <Card title="Browser SDK check (signed-in admin)">
          {testing ? (
            <Loading />
          ) : clientCheck.error ? (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-[13px] p-3">{clientCheck.error}</div>
          ) : (
            <div className="space-y-2 text-[13px]">
              <Row label="/products readable" value={clientCheck.products >= 0 ? `${clientCheck.products} docs` : "—"} ok={clientCheck.products >= 0} />
              <Row label="/categories readable" value={clientCheck.categories >= 0 ? `${clientCheck.categories} docs` : "—"} ok={clientCheck.categories >= 0} />
              <Row label="/siteSettings/main exists" value={clientCheck.siteSettings ? "yes" : "missing (will be created on save)"} ok warn={!clientCheck.siteSettings} />
              <Row label="/homepage/content exists" value={clientCheck.homepage ? "yes" : "missing (will be created on save)"} ok warn={!clientCheck.homepage} />
            </div>
          )}
          <p className="text-[11px] text-slate-400 mt-3">Uses your logged-in Firebase session — proves reads work with your current rules + UID.</p>
        </Card>
      </div>

      {/* Admin-only collections — authenticated session, never public REST */}
      <Card title="Admin collection access (authenticated Firebase session)" className="mt-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {adminCheck.length === 0 ? (
            <p className="text-[13px] text-slate-400">Checking…</p>
          ) : (
            adminCheck.map((c) => (
              <div
                key={c.name}
                className={`rounded-lg border p-2.5 text-[12px] ${
                  c.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-red-50 border-red-200 text-red-700"
                }`}
              >
                <p className="font-mono font-bold">/{c.name}</p>
                <p className="text-[11px]">{c.ok ? "✓ " : "✕ "}{c.detail}</p>
              </div>
            ))
          )}
        </div>
        <p className="text-[11px] text-slate-500 mt-3">
          These collections are <strong>private by design</strong>. The Admin Panel reads them with the signed-in
          admin session (Firebase client SDK + security rules), never through public REST. A 403 from the public
          REST probe below is expected and must <strong>not</strong> be fixed by making the data public.
        </p>
      </Card>

      {/* ImgBB upload endpoint check */}
      <Card title="Image hosting check (ImgBB via secure server endpoint)" className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <span
            className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
              imgbb.state === "ready"
                ? "bg-emerald-50 text-emerald-700"
                : imgbb.state === "missing"
                ? "bg-red-50 text-red-700"
                : imgbb.state === "error"
                ? "bg-[#FFF9E8] text-[#B88900]"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {imgbb.state === "ready"
              ? "● IMGBB UPLOAD READY"
              : imgbb.state === "missing"
              ? "● IMGBB KEY MISSING"
              : imgbb.state === "error"
              ? "● UPLOAD ENDPOINT ISSUE"
              : "● CHECKING…"}
          </span>
          <p className="text-[13px] text-slate-600 flex-1 min-w-[220px]">{imgbb.detail}</p>
        </div>
        <p className="text-[11px] text-slate-400 mt-3">
          Flow: Admin selects image → <code>POST /api/upload-image</code> (server holds <code>IMGBB_API_KEY</code>) → ImgBB URL → Firestore → customer website.
          Firebase Storage is not used.
        </p>
      </Card>

      {/* Server REST check */}
      <Card title="Server reachability check (PUBLIC Firestore REST — public catalog only)" className="mt-4">
        {status.loading ? (
          <Loading />
        ) : status.error ? (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-[13px] p-3">{status.error}</div>
        ) : d ? (
          <div>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${d.firestoreOk ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {d.firestoreOk ? "● FIRESTORE REACHABLE" : "● FIRESTORE BLOCKED — check rules / API key"}
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${d.customerSite?.ok ? "bg-emerald-50 text-emerald-700" : "bg-[#FFF9E8] text-[#B88900]"}`}>
                Customer site HTTP {d.customerSite?.status ?? "?"} {d.customerSite?.mentionsProject ? "· same project ✓" : ""}
              </span>
            </div>
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="th">Collection</th><th className="th">Readable</th><th className="th">Docs (≤100)</th><th className="th">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(d.collections || {}).map(([col, v]: any) => (
                    <tr key={col} className="border-b border-slate-50 last:border-0">
                      <td className="td font-mono font-bold">/{col}</td>
                      <td className="td">{v.ok ? <span className="text-emerald-600 font-bold">✓ yes</span> : <span className="text-red-600 font-bold">✕ {v.status}</span>}</td>
                      <td className="td">{v.ok ? v.count : "—"}</td>
                      <td className="td text-[12px] text-slate-400">{!v.ok && v.status === 403 ? "Rules deny public read — admin SDK reads still work when signed in." : !v.ok ? (v.error || "").slice(0, 80) : ""}</td>
                    </tr>
                  ))}
                  <tr className="border-b border-slate-50">
                    <td className="td font-mono font-bold">/siteSettings/main</td>
                    <td className="td">{d.siteSettingsMain?.exists ? <span className="text-emerald-600 font-bold">✓ exists</span> : <span className="text-amber-600 font-bold">○ not yet</span>}</td>
                    <td className="td">—</td>
                    <td className="td text-[12px] text-slate-400">Created on first Settings save</td>
                  </tr>
                  <tr>
                    <td className="td font-mono font-bold">/homepage/content</td>
                    <td className="td">{d.homepageContent?.exists ? <span className="text-emerald-600 font-bold">✓ exists</span> : <span className="text-amber-600 font-bold">○ not yet</span>}</td>
                    <td className="td">—</td>
                    <td className="td text-[12px] text-slate-400">Created on first Homepage save</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">Checked at {d.checkedAt} · Project {d.projectId}</p>
          </div>
        ) : null}
      </Card>

      {/* Rules help */}
      <Card title="If reads fail — Firestore rules checklist" className="mt-4">
        <ol className="text-[13px] text-slate-600 space-y-1.5 list-decimal pl-5">
          <li>Firebase Console → Firestore → Rules must allow <code>read</code> on catalog collections for the customer site, and <code>write</code> only for your admin UID <code>qdVg8nA0dVaA7SxE9QrIRzOXiz23</code>.</li>
          <li>Image uploads need the server env var <code>IMGBB_API_KEY</code> (never in the browser). Firebase Storage is not used — no Storage upgrade needed.</li>
          <li>Authentication → Sign-in method → Email/Password must be <strong>enabled</strong>, and your owner account must exist.</li>
          <li>After changing rules, click <strong>Publish</strong>, then press “Re-run checks”.</li>
        </ol>
      </Card>
    </div>
  );
}

function Row({ label, value, ok, warn }: { label: string; value: string; ok?: boolean; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
      <span className="font-semibold text-slate-700">{label}</span>
      <span className={`text-[12px] font-bold ${ok && !warn ? "text-emerald-600" : warn ? "text-amber-600" : "text-slate-400"}`}>
        {ok && !warn ? "✓ " : ""}{value}
      </span>
    </div>
  );
}
