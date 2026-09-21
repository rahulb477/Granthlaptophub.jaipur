"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Empty, Loading, PageHead, useConfirm } from "@/admin/lib";
import {
  getEnquiries,
  updateEnquiryStatus,
  deleteEnquiry,
  getProducts,
  subscribeCollection,
  logActivity,
  type FirestoreEnquiry,
} from "@/lib/firestore-service";
import { useAdminAuth } from "@/lib/firebase-auth";

const STATUSES = ["new", "contacted", "interested", "converted", "closed"];
const tone: Record<string, string> = {
  new: "bg-sky-50 text-sky-700",
  contacted: "bg-indigo-50 text-indigo-700",
  interested: "bg-violet-50 text-violet-700",
  converted: "bg-emerald-50 text-emerald-700",
  closed: "bg-slate-100 text-slate-600",
};

function fmtDate(v: any) {
  try {
    if (!v) return "—";
    if (typeof v?.toDate === "function") return v.toDate().toLocaleDateString("en-IN");
    if (typeof v === "number") return new Date(v).toLocaleDateString("en-IN");
    return new Date(v).toLocaleDateString("en-IN");
  } catch {
    return "—";
  }
}

export default function EnquiriesPage() {
  const { user } = useAdminAuth();
  const [rows, setRows] = useState<FirestoreEnquiry[]>([]);
  const [prods, setProds] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [err, setErr] = useState("");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const { ask, node } = useConfirm();

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        const [e, p] = await Promise.all([getEnquiries(), getProducts()]);
        setRows(e);
        const m: Record<string, string> = {};
        for (const x of p) if (x.id) m[x.id] = x.name;
        setProds(m);
      } catch (e: any) {
        console.error(e);
        setErr(e?.message || "Could not read enquiries from Firestore.");
      } finally {
        setLoading(false);
      }
      // Live sync — same collection the customer website writes to
      unsub = subscribeCollection(
        "enquiries",
        (liveRows) => {
          setLive(true);
          setRows(
            (liveRows as FirestoreEnquiry[]).sort((a, b) => {
              const ta = (a.createdAt as any)?.toMillis?.() ?? 0;
              const tb = (b.createdAt as any)?.toMillis?.() ?? 0;
              return tb - ta;
            })
          );
        },
        () => setLive(false)
      );
    })();
    return () => unsub();
  }, []);

  async function put(id: string, s: string) {
    try {
      await updateEnquiryStatus(id, s);
      setRows((prev) => prev.map((x) => (x.id === id ? { ...x, status: s as any } : x)));
      logActivity({
        adminId: user?.uid,
        adminName: user?.email ?? "admin",
        action: "update",
        entity: "enquiries",
        entityId: id,
        summary: `Enquiry ${id} → ${s}`,
      });
    } catch (e: any) {
      alert("Status update failed: " + (e?.message || e));
    }
  }
  function remove(id: string) {
    ask("Delete this enquiry permanently from Firestore?", async () => {
      try {
        await deleteEnquiry(id);
        setRows((prev) => prev.filter((x) => x.id !== id));
      } catch (e: any) {
        alert("Delete failed: " + (e?.message || e));
      }
    });
  }

  const filtered = rows.filter((e) => !status || e.status === status);

  return (
    <div>
      <PageHead
        title="Enquiries"
        desc="Live from Firestore /enquiries — the same collection the customer website writes to. Status changes sync instantly."
      >
        <span
          className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${
            live ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${live ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
          {live ? "LIVE SYNC" : "LOADING…"}
        </span>
      </PageHead>
      {err && <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{err}</div>}
      <Card>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-4">
          <button onClick={() => setStatus("")} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold whitespace-nowrap ${!status ? "bg-[#16233a] text-white" : "bg-slate-100 text-slate-600"}`}>All ({rows.length})</button>
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatus(status === s ? "" : s)} className={`px-3 py-1.5 rounded-lg text-[12px] font-bold whitespace-nowrap capitalize ${status === s ? "bg-[#16233a] text-white" : "bg-slate-100 text-slate-600"}`}>
              {s} ({rows.filter((x) => x.status === s).length})
            </button>
          ))}
        </div>
        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <Empty title="No enquiries in this view" sub="Website contact-form submissions appear here in real time." />
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="th">Name</th><th className="th">Contact</th><th className="th">Product</th><th className="th">Source</th><th className="th">Status</th><th className="th">Date</th><th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50 last:border-0 hover:bg-amber-50/30 cursor-pointer" onClick={() => setOpen(open === e.id ? null : (e.id as string))}>
                    <td className="td font-semibold">{e.name}</td>
                    <td className="td text-[12px]">{e.phone || "—"}{e.email && <span className="block text-slate-400">{e.email}</span>}</td>
                    <td className="td text-[13px]">
                      {e.productName ? (
                        e.productId && prods[e.productId] ? <Link href={`/admin/products/${e.productId}`} className="text-[#B88900] font-semibold hover:underline" onClick={(ev) => ev.stopPropagation()}>{e.productName}</Link> : e.productName
                      ) : (
                        <span className="text-slate-400">General</span>
                      )}
                    </td>
                    <td className="td"><span className="text-[11px] font-bold uppercase tracking-wide bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{e.source || "website"}</span></td>
                    <td className="td" onClick={(ev) => ev.stopPropagation()}>
                      <select className={`text-[11px] font-bold rounded-md px-2 py-1 border-0 outline-none cursor-pointer ${tone[e.status || "new"]}`} value={e.status || "new"} onChange={(ev) => e.id && put(e.id, ev.target.value)}>
                        {STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="td text-[12px] text-slate-400">{fmtDate(e.createdAt)}</td>
                    <td className="td" onClick={(ev) => ev.stopPropagation()}>
                      <div className="flex justify-end gap-1 text-[12px] font-semibold">
                        {e.phone && (
                          <a
                            className="px-2 py-1 rounded-md hover:bg-emerald-50 text-emerald-700"
                            target="_blank"
                            rel="noreferrer"
                            href={`https://wa.me/91${(e.phone || "").replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent("Hi " + e.name + ", regarding your enquiry" + (e.productName ? " about " + e.productName : "") + " at Granth Laptop Hub.")}`}
                          >
                            WhatsApp
                          </a>
                        )}
                        <button className="px-2 py-1 rounded-md hover:bg-red-50 text-red-600" onClick={() => e.id && remove(e.id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {open !== null &&
                  (() => {
                    const e = filtered.find((x) => x.id === open);
                    if (!e) return null;
                    return (
                      <tr className="bg-amber-50/40">
                        <td colSpan={7} className="px-4 py-3 text-[13px]">
                          <strong>Message:</strong> {e.message || "—"}
                        </td>
                      </tr>
                    );
                  })()}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {node}
    </div>
  );
}
