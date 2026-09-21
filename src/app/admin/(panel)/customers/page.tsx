"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  getAllCustomers,
  getAllCustomerOrders,
  getCustomerDetail,
  orderMillis,
  orderTotal,
  toMillis,
  type CustomerDetail,
  type FirestoreCustomer,
  type UserOrder,
} from "@/lib/firestore-service";
import { displayOrderNumber } from "@/lib/order-number";
import { formatAddress } from "@/lib/address";

/* ------------------------------------------------------------------ */
/* Helpers — all values come from real Firestore documents. No mocks.  */
/* ------------------------------------------------------------------ */
/** Tolerates Firestore Timestamp | number | ISO string | Date. */
const ts = toMillis;
function fmtDate(v: any): string {
  const t = ts(v);
  return t ? new Date(t).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}
function fmtDateTime(v: any): string {
  const t = ts(v);
  return t ? new Date(t).toLocaleString("en-IN") : "—";
}
function inr(n: number): string {
  return "₹" + Number(n || 0).toLocaleString("en-IN");
}
function customerName(c: FirestoreCustomer): string {
  return (
    c.name ||
    c.displayName ||
    c.fullName ||
    (typeof c.email === "string" ? c.email.split("@")[0] : "") ||
    "Customer"
  );
}
function registeredAt(c: FirestoreCustomer): any {
  return c.createdAt ?? c.createdAtMs ?? c.registeredAt ?? c.metadata?.creationTime ?? null;
}
function lastActiveAt(c: FirestoreCustomer): any {
  return c.lastLoginAt ?? c.lastActiveAt ?? c.updatedAt ?? c.metadata?.lastSignInTime ?? null;
}
function itemOptionChips(it: any): string[] {
  return [it?.selectedRam ?? it?.ram, it?.selectedStorage ?? it?.storage, it?.selectedWarranty ?? it?.warranty]
    .map((v: any) => (v && typeof v === "object" ? v.value : v))
    .filter((v: any): v is string => typeof v === "string" && v.trim().length > 0);
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<FirestoreCustomer[]>([]);
  const [orders, setOrders] = useState<UserOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<FirestoreCustomer | null>(null);
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Both reads use the AUTHENTICATED Firebase client session.
      const [usersList, ordersList] = await Promise.all([getAllCustomers(), getAllCustomerOrders()]);
      setCustomers(usersList);
      setOrders(ordersList);
    } catch (err: any) {
      console.error("Customers error:", err);
      setError(err?.message || "Could not read customers from Firestore.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /** Orders grouped per customer UID — computed from real order documents. */
  const ordersByUser = useMemo(() => {
    const map = new Map<string, UserOrder[]>();
    for (const o of orders) {
      const uid = o.userId || "";
      if (!uid) continue;
      const list = map.get(uid) ?? [];
      list.push(o);
      map.set(uid, list);
    }
    for (const list of map.values()) list.sort((a, b) => orderMillis(b) - orderMillis(a));
    return map;
  }, [orders]);

  const spentByUser = useMemo(() => {
    const map = new Map<string, number>();
    for (const [uid, list] of ordersByUser.entries()) {
      map.set(
        uid,
        list
          .filter((o) => String(o.status || "").toLowerCase() !== "cancelled")
          .reduce((s, o) => s + orderTotal(o as any), 0)
      );
    }
    return map;
  }, [ordersByUser]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.id?.toLowerCase().includes(q) ||
        customerName(c).toLowerCase().includes(q) ||
        String(c.email || "").toLowerCase().includes(q) ||
        String(c.phone || "").toLowerCase().includes(q)
    );
  }, [customers, search]);

  const openCustomer = async (c: FirestoreCustomer) => {
    setSelected(c);
    setDetail(null);
    setDetailLoading(true);
    try {
      // Reads users/{uid} + addresses / orders / rewards / couponUsage
      setDetail(await getCustomerDetail(c.id));
    } catch (e: any) {
      setDetail({
        profile: c,
        addresses: [],
        orders: ordersByUser.get(c.id) ?? [],
        rewards: [],
        couponUsage: [],
        totalOrders: (ordersByUser.get(c.id) ?? []).length,
        totalSpent: spentByUser.get(c.id) ?? 0,
        errors: [e?.message || "Could not load customer detail"],
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const totalRegistered = customers.length;
  const totalWithOrders = [...ordersByUser.keys()].filter((uid) => customers.some((c) => c.id === uid)).length;
  const lifetimeValue = [...spentByUser.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B88900]">Granth Laptop Hub</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">Customer Management</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Live Firestore read of <code className="text-slate-700">/users</code> with subcollections{" "}
            <code className="text-slate-700">addresses</code>, <code className="text-slate-700">orders</code>,{" "}
            <code className="text-slate-700">rewards</code>, <code className="text-slate-700">couponUsage</code>.
            Passwords are never stored or displayed.
          </p>
        </div>
        <button onClick={loadData} className="adm-btn adm-btn-line text-xs py-2 px-3">
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold">
          {error}
        </div>
      )}

      {/* Summary — computed only from real documents */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Registered Customers", value: String(totalRegistered) },
          { label: "Customers with Orders", value: String(totalWithOrders) },
          { label: "Total Orders", value: String(orders.length) },
          { label: "Lifetime Value", value: inr(lifetimeValue) },
        ].map((s) => (
          <div key={s.label} className="adm-card p-4">
            <p className="text-[11px] font-semibold text-slate-500">{s.label}</p>
            <p className="text-[20px] font-extrabold tracking-tight text-[#111827] mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="adm-card p-4">
        <input
          type="text"
          placeholder="Search by customer name, email, phone, UID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="adm-input text-xs"
        />
      </div>

      <div className="adm-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Loading registered customers from Firestore...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No registered customers found in the Firestore <code>users</code> collection.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Registered</th>
                  <th className="px-4 py-3">Last Activity</th>
                  <th className="px-4 py-3">Orders</th>
                  <th className="px-4 py-3">Total Spent</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => {
                  const uOrders = ordersByUser.get(c.id) ?? [];
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{customerName(c)}</p>
                        <p className="font-mono text-[10px] text-slate-400 truncate max-w-[150px]" title={c.id}>
                          {c.id}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <p>{c.email || "—"}</p>
                        <p className="text-[10px] text-slate-400">{c.phone || "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(registeredAt(c))}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(lastActiveAt(c))}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{uOrders.length}</td>
                      <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                        {inr(spentByUser.get(c.id) ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openCustomer(c)}
                          className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                        >
                          View Profile
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------------- Customer detail drawer ---------------- */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full my-6 p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">{customerName(selected)}</h2>
                <p className="text-[11px] text-slate-400 font-mono">UID: {selected.id}</p>
              </div>
              <button
                onClick={() => {
                  setSelected(null);
                  setDetail(null);
                }}
                className="text-slate-400 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div className="p-10 text-center text-xs text-slate-400">Loading customer record from Firestore…</div>
            ) : detail ? (
              <>
                {detail.errors.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">
                    Some subcollections could not be read: {detail.errors.join(" · ")}
                  </div>
                )}

                {/* Profile + totals */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="p-3.5 bg-slate-50 rounded-xl space-y-1.5 text-xs">
                    <p className="font-bold text-slate-800 mb-1">Profile</p>
                    <p>
                      <span className="text-slate-400">Email:</span>{" "}
                      <strong>{detail.profile.email || selected.email || "—"}</strong>
                    </p>
                    <p>
                      <span className="text-slate-400">Phone:</span>{" "}
                      {detail.profile.phone || selected.phone || "—"}
                    </p>
                    <p>
                      <span className="text-slate-400">Registered:</span>{" "}
                      {fmtDateTime(registeredAt(detail.profile))}
                    </p>
                    <p>
                      <span className="text-slate-400">Last activity:</span>{" "}
                      {fmtDateTime(lastActiveAt(detail.profile))}
                    </p>
                    <p className="text-[10px] text-slate-400 pt-1">
                      Passwords are managed by Firebase Authentication and are never readable.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 bg-slate-900 text-white rounded-xl">
                      <p className="text-[10px] uppercase tracking-wider text-white/60 font-bold">Total Orders</p>
                      <p className="text-2xl font-extrabold">{detail.totalOrders}</p>
                    </div>
                    <div className="p-3.5 bg-[#D6A600] text-white rounded-xl">
                      <p className="text-[10px] uppercase tracking-wider text-white/80 font-bold">Total Spent</p>
                      <p className="text-2xl font-extrabold">{inr(detail.totalSpent)}</p>
                    </div>
                  </div>
                </div>

                {/* Addresses */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Saved Addresses ({detail.addresses.length})
                  </p>
                  {detail.addresses.length === 0 ? (
                    <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-lg">No saved addresses.</p>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-2">
                      {detail.addresses.map((a: any) => {
                        const f = formatAddress(a);
                        return (
                          <div key={a.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                            {f.name && <p className="font-bold text-slate-800">{f.name}</p>}
                            {f.phone && <p className="font-mono text-[11px] text-slate-500">{f.phone}</p>}
                            <div className="mt-1 text-slate-700 leading-relaxed">
                              {f.lines.length > 0 ? (
                                f.lines.map((l, i) => <div key={i}>{l}</div>)
                              ) : (
                                <span className="text-slate-400">No address details</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Order history */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Order History ({detail.orders.length})
                  </p>
                  {detail.orders.length === 0 ? (
                    <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-lg">No orders placed yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {detail.orders.map((o) => (
                        <div key={o.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-mono font-bold text-slate-900">{displayOrderNumber(o)}</p>
                              <p className="text-[10px] text-slate-400">{fmtDateTime(o.createdAt)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  String(o.status).toLowerCase() === "delivered"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : String(o.status).toLowerCase() === "cancelled"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-amber-100 text-amber-800"
                                }`}
                              >
                                {o.status || "Order Placed"}
                              </span>
                              <span className="font-bold text-slate-900">{inr(orderTotal(o as any))}</span>
                            </div>
                          </div>

                          {Array.isArray(o.items) && o.items.length > 0 && (
                            <div className="space-y-1 border-t border-slate-100 pt-2">
                              {o.items.map((it: any, i: number) => (
                                <div key={i} className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="font-semibold text-slate-800">{it.name || "Product"}</p>
                                    <p className="text-[10px] text-slate-400">Qty: {it.quantity || 1}</p>
                                    {itemOptionChips(it).length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-0.5">
                                        {itemOptionChips(it).map((c, k) => (
                                          <span
                                            key={k}
                                            className="px-1.5 py-0.5 rounded bg-amber-50 text-[9px] font-bold text-[#B88900]"
                                          >
                                            {c}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-slate-700 whitespace-nowrap">
                                    {inr(Number(it.price || 0))}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                            <span>Payment: {o.paymentMethod || "COD"}</span>
                            {o.couponCode && (
                              <span className="text-emerald-700">
                                Coupon {o.couponCode} (−{inr(Number(o.couponDiscount || 0))})
                              </span>
                            )}
                            {o.rewardCode && (
                              <span className="text-[#B88900]">
                                Reward {o.rewardCode} (−{inr(Number(o.rewardDiscount || 0))})
                              </span>
                            )}
                            <span>Subtotal: {inr(Number(o.subtotal || 0))}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Coupon usage + rewards */}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Coupon Usage ({detail.couponUsage.length})
                    </p>
                    {detail.couponUsage.length === 0 ? (
                      <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-lg">No coupons used.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {detail.couponUsage.map((c: any) => (
                          <div
                            key={c.id}
                            className="p-2 bg-slate-50 rounded-lg text-xs flex items-center justify-between"
                          >
                            <span className="font-mono font-bold text-[#B88900]">{c.code || c.id}</span>
                            <span className="text-slate-500 text-[11px]">
                              {c.usedCount ? `${c.usedCount}×` : ""} {fmtDate(c.usedAt ?? c.createdAt)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Rewards ({detail.rewards.length})
                    </p>
                    {detail.rewards.length === 0 ? (
                      <p className="text-xs text-slate-400 p-3 bg-slate-50 rounded-lg">No rewards unlocked.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {detail.rewards.map((r: any) => (
                          <div key={r.id} className="p-2 bg-slate-50 rounded-lg text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-[#B88900]">{r.code || r.id}</span>
                              <span className="text-slate-700 font-semibold">
                                {r.amount ? inr(Number(r.amount)) : r.type || "reward"}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400">
                              {r.used || r.redeemed ? "Redeemed" : "Available"} · {fmtDate(r.createdAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
