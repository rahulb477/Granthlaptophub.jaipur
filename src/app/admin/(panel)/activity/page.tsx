"use client";
import React, { useEffect, useState } from "react";
import { Card, Empty, Loading, PageHead, useDebounce } from "@/admin/lib";
import { getActivityLog, subscribeCollection, toMillis } from "@/lib/firestore-service";

/** Tolerates Timestamp | number | ISO string | Date. */
function fmtDateTime(row: any) {
  const ms = toMillis(row?.createdAt) || toMillis(row?.createdAtMs);
  return ms ? new Date(ms).toLocaleString("en-IN") : "—";
}

/** Canonical description, falling back to the legacy `summary` field. */
function descOf(r: any) {
  return r?.description || r?.summary || `${r?.action ?? ""} ${r?.entity ?? ""}`.trim() || "—";
}

/** Canonical admin label: name → email → uid. */
function adminOf(r: any) {
  return r?.adminName || r?.adminEmail || r?.adminUid || r?.adminId || "admin";
}

function actionTone(action: string) {
  const a = String(action || "").toUpperCase();
  if (a === "DELETE") return "bg-red-50 text-red-600";
  if (a === "CREATE") return "bg-emerald-50 text-emerald-700";
  if (a === "STATUS") return "bg-amber-50 text-amber-700";
  if (a === "SETTINGS") return "bg-violet-50 text-violet-700";
  if (a === "UPLOAD") return "bg-teal-50 text-teal-700";
  return "bg-sky-50 text-sky-700";
}

export default function ActivityPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [q, setQ] = useState("");
  const [entity, setEntity] = useState("");
  const dq = useDebounce(q);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        const data = await getActivityLog(200);
        setRows(data);
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
      unsub = subscribeCollection(
        "activityLog",
        (liveRows) => {
          setLive(true);
          setRows(
            [...liveRows].sort((a: any, b: any) => {
              // createdAtMs keeps ordering stable before serverTimestamp() resolves.
              const ta = toMillis(a.createdAt) || toMillis(a.createdAtMs);
              const tb = toMillis(b.createdAt) || toMillis(b.createdAtMs);
              return tb - ta;
            })
          );
        },
        () => setLive(false)
      );
    })();
    return () => unsub();
  }, []);

  const filtered = rows.filter(
    (r) =>
      (!entity || r.entity === entity) &&
      (!dq ||
        `${descOf(r)} ${r.entity} ${adminOf(r)} ${r.adminEmail ?? ""} ${r.entityId ?? ""} ${r.action}`
          .toLowerCase()
          .includes(dq.toLowerCase()))
  );
  const entities = [...new Set(rows.map((r) => r.entity))];

  return (
    <div>
      <PageHead title="Activity Log" desc="Live from Firestore /activityLog — every admin change, synced with the customer website project.">
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full ${live ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${live ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
          {live ? "LIVE SYNC" : "LOADING…"}
        </span>
      </PageHead>
      <Card>
        <div className="flex flex-wrap gap-2.5 mb-4">
          <input className="adm-input !w-64" placeholder="Search activity…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="adm-input !w-44" value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="">All entities</option>
            {entities.map((e) => <option key={e}>{e}</option>)}
          </select>
        </div>
        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <Empty title="No activity recorded" sub="Actions you take in this panel are logged here automatically." />
        ) : (
          <div className="space-y-2">
            {filtered.map((r) => (
              <div key={r.id} className="rounded-lg border border-slate-100 px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${actionTone(r.action)}`}>{String(r.action || "update").toUpperCase()}</span>
                  <span className="text-[12px] font-bold text-slate-500">{r.entity}{r.entityId ? ` #${r.entityId}` : ""}</span>
                  <span className="text-[12px] text-slate-400 ml-auto">{fmtDateTime(r)}</span>
                </div>
                <p className="text-[13px] font-semibold mt-1.5">{descOf(r)}</p>
                <p className="text-[12px] text-slate-500">
                  by <strong>{adminOf(r)}</strong>
                  {r.adminEmail && r.adminName !== r.adminEmail ? (
                    <span className="text-slate-400"> · {r.adminEmail}</span>
                  ) : null}
                  {r.adminUid ? <span className="text-slate-300 font-mono"> · {String(r.adminUid).slice(0, 8)}</span> : null}
                </p>
                {r.diff && (
                  <div className="mt-2 rounded-lg bg-slate-50 p-2.5 max-h-36 overflow-y-auto">
                    {Object.entries(r.diff).map(([k, v]: any) => (
                      <p key={k} className="text-[11px] font-mono leading-relaxed">
                        <span className="font-bold text-slate-500">{k}:</span>{" "}
                        <span className="text-red-600 line-through">{v.from || "∅"}</span> → <span className="text-emerald-700">{v.to || "∅"}</span>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
