"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { updateReviewStatus, deleteReview, toMillis } from "@/lib/firestore-service";
import { getNormalizedReviews, type NormalizedReview } from "@/lib/review-normalize";
import { logAdminAction } from "@/lib/activity";
import { useAdminAuth } from "@/lib/firebase-auth";
import { can } from "@/lib/permissions";

function fmtDate(v: unknown) {
  const ms = toMillis(v);
  return ms ? new Date(ms).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

function Stars({ n }: { n: number }) {
  return (
    <span className="text-[#D6A600] tracking-tight" title={`${n} / 5`}>
      {"★".repeat(Math.max(0, Math.min(5, n)))}
      <span className="text-slate-300">{"★".repeat(Math.max(0, 5 - n))}</span>
    </span>
  );
}

export default function ReviewsAdminPage() {
  const { role } = useAdminAuth();
  const [reviews, setReviews] = useState<NormalizedReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [success, setSuccess] = useState("");
  const [filter, setFilter] = useState<"all" | "approved" | "pending" | "hidden" | "featured">("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState("");

  const mayModerate = can(role, "reviews", "update");
  const mayDelete = can(role, "reviews", "delete");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    setWarning("");
    try {
      const { reviews: rows, lookupWarning } = await getNormalizedReviews();
      rows.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      setReviews(rows);
      if (lookupWarning) setWarning(lookupWarning);
    } catch (err: any) {
      setError(
        String(err?.code || "").includes("permission-denied")
          ? "Missing permissions to read /reviews. Sign in with an admin account."
          : err?.message || "Could not load reviews from Firestore."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const flash = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleStatus = async (r: NormalizedReview, status: "approved" | "pending" | "hidden") => {
    if (!mayModerate) return;
    setBusy(r.id);
    try {
      await updateReviewStatus(r.id, status);
      setReviews((prev) => prev.map((x) => (x.id === r.id ? { ...x, status } : x)));
      void logAdminAction({
        action: "STATUS",
        entity: "Review",
        entityId: r.id,
        description: `Review by ${r.customerName} ${
          status === "approved" ? "approved" : status === "hidden" ? "hidden" : "set to pending"
        }`,
        changes: { from: r.status, to: status },
      });
      flash(`Review ${status}.`);
    } catch (err: any) {
      alert("Status update failed: " + (err?.message || "unknown error"));
    } finally {
      setBusy("");
    }
  };

  const handleFeature = async (r: NormalizedReview, featured: boolean) => {
    if (!mayModerate) return;
    setBusy(r.id);
    try {
      await updateReviewStatus(r.id, r.status, featured);
      setReviews((prev) => prev.map((x) => (x.id === r.id ? { ...x, featured } : x)));
      void logAdminAction({
        action: "UPDATE",
        entity: "Review",
        entityId: r.id,
        description: `Review by ${r.customerName} ${featured ? "featured" : "unfeatured"}`,
        changes: { featured },
      });
      flash(featured ? "Review featured." : "Review unfeatured.");
    } catch (err: any) {
      alert("Feature update failed: " + (err?.message || "unknown error"));
    } finally {
      setBusy("");
    }
  };

  const handleDelete = async (r: NormalizedReview) => {
    if (!mayDelete) return;
    if (!confirm(`Permanently delete the review by ${r.customerName}?`)) return;
    setBusy(r.id);
    try {
      await deleteReview(r.id);
      setReviews((prev) => prev.filter((x) => x.id !== r.id));
      void logAdminAction({
        action: "DELETE",
        entity: "Review",
        entityId: r.id,
        description: `Deleted review by ${r.customerName}`,
      });
      flash("Review deleted.");
    } catch (err: any) {
      alert("Delete failed: " + (err?.message || "unknown error"));
    } finally {
      setBusy("");
    }
  };

  const counts = useMemo(
    () => ({
      all: reviews.length,
      approved: reviews.filter((r) => r.status === "approved").length,
      pending: reviews.filter((r) => r.status === "pending").length,
      hidden: reviews.filter((r) => r.status === "hidden").length,
      featured: reviews.filter((r) => r.featured).length,
    }),
    [reviews]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews.filter((r) => {
      const matchFilter =
        filter === "all" ? true : filter === "featured" ? r.featured : r.status === filter;
      const matchSearch =
        !q ||
        r.customerName.toLowerCase().includes(q) ||
        r.feedback.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.productName.toLowerCase().includes(q) ||
        r.productId.toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
  }, [reviews, filter, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B88900]">Granth Laptop Hub</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">Testimonials &amp; Reviews</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Live read of <code className="text-slate-700">/reviews</code>. Mixed legacy schemas are normalised
            (<code>userName</code>/<code>name</code>, <code>comment</code>/<code>review</code>/<code>feedback</code>)
            and reviewer names are resolved from <code>users/&#123;uid&#125;</code> when the review has none.
          </p>
        </div>
        <button onClick={loadAll} className="adm-btn adm-btn-line text-xs py-2 px-3">
          ↻ Refresh
        </button>
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
          ✓ {success}
        </div>
      )}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold">{error}</div>
      )}
      {warning && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-[11px]">{warning}</div>
      )}
      {!mayModerate && !loading && (
        <div className="p-3 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[11px]">
          Your role (<strong>{role}</strong>) has read-only access to reviews. Moderation actions are disabled.
        </div>
      )}

      <div className="adm-card p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {([
            ["all", "All"],
            ["pending", "Pending"],
            ["approved", "Approved"],
            ["hidden", "Hidden"],
            ["featured", "Featured"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                filter === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {label} ({counts[key]})
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Search by customer, feedback, email or product…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="adm-input text-xs"
        />
      </div>

      <div className="adm-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading reviews from Firestore…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No reviews in this view.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Rating</th>
                  <th className="px-4 py-3 min-w-[240px]">Feedback</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{r.customerName}</p>
                      {r.email && <p className="text-[10px] text-slate-400">{r.email}</p>}
                      {!r.hasRealName && (
                        <p className="text-[10px] text-amber-600">no name stored on review</p>
                      )}
                      {r.verifiedPurchase && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-emerald-50 text-[9px] font-bold text-emerald-700">
                          ✓ VERIFIED PURCHASE
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Stars n={r.rating} />
                      <p className="text-[10px] text-slate-400">{r.rating}/5</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {r.title && <p className="font-semibold text-slate-900">{r.title}</p>}
                      {r.feedback ? (
                        <p className="whitespace-pre-line">{r.feedback}</p>
                      ) : (
                        <span className="text-slate-400 italic">No written feedback</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.productName || (
                        <span className="font-mono text-[10px] text-slate-400">{r.productId || "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === "approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : r.status === "hidden"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {r.status.toUpperCase()}
                      </span>
                      {r.featured && (
                        <span className="block mt-1 px-2 py-0.5 rounded-full bg-[#FFF9E8] text-[10px] font-bold text-[#B88900] text-center">
                          ★ FEATURED
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex flex-wrap gap-1 justify-end">
                        {mayModerate && r.status !== "approved" && (
                          <button
                            disabled={busy === r.id}
                            onClick={() => handleStatus(r, "approved")}
                            className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-semibold hover:bg-emerald-100 disabled:opacity-50"
                          >
                            Approve
                          </button>
                        )}
                        {mayModerate && r.status !== "hidden" && (
                          <button
                            disabled={busy === r.id}
                            onClick={() => handleStatus(r, "hidden")}
                            className="px-2 py-1 rounded bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 disabled:opacity-50"
                          >
                            Hide
                          </button>
                        )}
                        {mayModerate && (
                          <button
                            disabled={busy === r.id}
                            onClick={() => handleFeature(r, !r.featured)}
                            className="px-2 py-1 rounded bg-[#FFF9E8] text-[#B88900] font-semibold hover:brightness-95 disabled:opacity-50"
                          >
                            {r.featured ? "Unfeature" : "Feature"}
                          </button>
                        )}
                        {mayDelete && (
                          <button
                            disabled={busy === r.id}
                            onClick={() => handleDelete(r)}
                            className="px-2 py-1 rounded bg-red-50 text-red-600 font-semibold hover:bg-red-100 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
