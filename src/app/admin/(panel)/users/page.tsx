"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminUsers, type FirestoreAdminUser } from "@/lib/firestore-service";
import { useAdminAuth } from "@/lib/firebase-auth";
import { FIREBASE_PROJECT_ID } from "@/lib/firebase";
import {
  authenticatedAdminFetch,
  classifyAdminError,
  getFreshAdminIdToken,
  AdminSessionError,
} from "@/lib/admin-session";
import {
  ALL_ROLES,
  MASTER_SUPER_ADMIN_UID,
  isMasterSuperAdmin,
  ROLE_LABEL,
  ROLE_DESCRIPTION,
  canManageAdmins,
  canManageAdminsFor,
  normalizeRole,
  type AdminRole,
} from "@/lib/permissions";
import { PageHead } from "@/admin/lib";

/**
 * ADMIN USER MANAGEMENT
 *
 * Passwords are handled exclusively by Firebase Authentication through the
 * secure server endpoints (/api/admin/create-user, /api/admin/reset-password,
 * /api/admin/update-user). This page never stores, reads or displays a
 * password, and adminUsers/{uid} holds only non-sensitive metadata.
 */

interface FormState {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: AdminRole;
  active: boolean;
}

const EMPTY_FORM: FormState = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  role: "staff",
  active: true,
};

export default function AdminUsersPage() {
  const { role: myRole, user, loading: authLoading, waitForAuth } = useAdminAuth();
  const maySee = canManageAdminsFor(user?.uid, myRole);

  const [rows, setRows] = useState<FirestoreAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showPw, setShowPw] = useState(false);

  const [pwTarget, setPwTarget] = useState<FirestoreAdminUser | null>(null);
  const [pwForm, setPwForm] = useState({ newPassword: "", confirmPassword: "" });
  const [resetLink, setResetLink] = useState("");

  const [editTarget, setEditTarget] = useState<FirestoreAdminUser | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", role: "staff" as AdminRole, active: true });

  /** Set when the server reports missing Firebase Admin credentials. */
  const [sdkMissing, setSdkMissing] = useState(false);
  /** Server-reported authorization diagnostics shown when a call is denied. */
  const [diag, setDiag] = useState<Record<string, unknown> | null>(null);
  const [checking, setChecking] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRows(await getAdminUsers());
    } catch (err: any) {
      setError(
        String(err?.code || "").includes("permission-denied")
          ? "Missing permissions to read /adminUsers. Only a Super Admin can view administrator accounts."
          : err?.message || "Could not load administrators."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (maySee) loadAll();
    else setLoading(false);
  }, [maySee, loadAll]);

  const flash = (m: string) => {
    setSuccess(m);
    setTimeout(() => setSuccess(""), 5000);
  };

  /**
   * Calls a secure server endpoint using the shared admin session helper.
   *
   * - Waits for Firebase Auth to finish its initial state restoration so we
   *   never mistake "still loading" for "signed out".
   * - Gets a fresh token from `auth.currentUser` (never localStorage).
   * - Classifies the server response: only a real HTTP 401 (or the server's
   *   NOT_AUTHENTICATED / AUTH_TOKEN_MISSING / AUTH_TOKEN_INVALID codes)
   *   becomes "session expired". 403/409/500 show their real message and do
   *   NOT sign the user out.
   */
  const callApi = async (url: string, init: RequestInit) => {
    // ITEM 4 — never fire an API call before Auth has reported its state.
    await waitForAuth();

    // ITEM 2 — safe diagnostics. No token, password or secret.
    try {
      await getFreshAdminIdToken();
    } catch (e) {
      if (e instanceof AdminSessionError) {
        if (e.code === "ADMIN_SESSION_EXPIRED") {
          throw new Error("Your admin session has expired. Please log in again.");
        }
        if (e.code === "ADMIN_TOKEN_UNAVAILABLE") {
          throw new Error(
            "Could not refresh your admin session token. Please check your connection and try again."
          );
        }
      }
      throw e;
    }

    const { response, body } = await authenticatedAdminFetch(url, init);

    if (body?.code === "ADMIN_SDK_UNCONFIGURED" || body?.code === "FIREBASE_PROJECT_MISMATCH") {
      setSdkMissing(true);
    }
    if (body?.diagnostics) setDiag(body.diagnostics as Record<string, unknown>);

    if (!response.ok || body?.success === false) {
      const classified = classifyAdminError(response.status, body);

      // ITEM 10 — ONLY a real 401 is treated as "session expired" here.
      // 403/409/500 surface their real server message; they must NOT trigger
      // a sign-out or pretend the session is gone.
      if (classified.kind === "session") {
        throw new Error("Your admin session has expired. Please log in again.");
      }
      throw new Error(classified.message);
    }

    return body;
  };

  const validateCreate = (): string | null => {
    if (!form.name.trim()) return "Full name is required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Enter a valid email address.";
    if (form.password.length < 8) return "Password must be at least 8 characters.";
    if (form.password !== form.confirmPassword) return "Password and confirmation do not match.";
    if (rows.some((r) => (r.email || "").toLowerCase() === form.email.trim().toLowerCase()))
      return "An administrator with this email already exists.";
    return null;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const v = validateCreate();
    if (v) {
      setError(v);
      return;
    }
    setBusy(true);
    try {
      const out = await callApi("/api/admin/create-user", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          confirmPassword: form.confirmPassword,
          role: form.role,
          active: form.active,
        }),
      });
      flash(out.message || "Administrator created.");
      setForm(EMPTY_FORM);
      setCreating(false);
      loadAll();
    } catch (err: any) {
      setError(err?.message || "Could not create the administrator.");
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (u: FirestoreAdminUser, patch: Record<string, unknown>) => {
    setError("");
    setBusy(true);
    try {
      const out = await callApi("/api/admin/update-user", {
        method: "POST",
        body: JSON.stringify({ uid: u.id, ...patch }),
      });
      flash(out.message || "Administrator updated.");
      loadAll();
    } catch (err: any) {
      setError(err?.message || "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  /** Asks the server exactly who it thinks we are (safe fields only). */
  const runWhoAmI = async () => {
    setChecking(true);
    setError("");
    setDiag(null);
    try {
      await waitForAuth();
      const token = await getFreshAdminIdToken();
      const res = await fetch("/api/admin/whoami", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => ({}));
      if (body?.code === "ADMIN_SDK_UNCONFIGURED") setSdkMissing(true);
      setDiag(body?.diagnostics ?? body);
      if (body?.success) {
        flash(
          `Server sees you as ${body.roleLabel} (UID ${String(body.uid).slice(0, 10)}…). ` +
            `Can manage admin users: ${body.canManageAdminUsers ? "YES" : "NO"}.`
        );
      } else {
        setError(body?.error || "Authorization check failed.");
      }
    } catch (e: any) {
      setError(e?.message || "Could not reach the authorization check.");
    } finally {
      setChecking(false);
    }
  };

  const openEdit = (u: FirestoreAdminUser) => {
    setEditTarget(u);
    setEditForm({
      name: u.name ?? "",
      email: u.email ?? "",
      role: normalizeRole(u.role),
      active: u.active !== false,
    });
    setError("");
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    if (!editForm.name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    await handleUpdate(editTarget, {
      name: editForm.name.trim(),
      email: editForm.email.trim().toLowerCase(),
      role: editForm.role,
      active: editForm.active,
    });
    setEditTarget(null);
  };

  const handleSendResetLink = async () => {
    if (!pwTarget) return;
    setError("");
    setResetLink("");
    setBusy(true);
    try {
      const out = await callApi("/api/admin/reset-password", {
        method: "POST",
        body: JSON.stringify({ uid: pwTarget.id, mode: "link" }),
      });
      setResetLink(out.resetLink || "");
      flash(out.message || "Reset link generated.");
    } catch (err: any) {
      setError(err?.message || "Could not generate a reset link.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (u: FirestoreAdminUser) => {
    if (!confirm(`Remove ${u.name} (${u.email})?\n\nTheir Firebase Authentication account and admin access are deleted immediately.`))
      return;
    setError("");
    setBusy(true);
    try {
      const out = await callApi(`/api/admin/update-user?uid=${encodeURIComponent(u.id || "")}`, {
        method: "DELETE",
      });
      flash(out.message || "Administrator removed.");
      loadAll();
    } catch (err: any) {
      setError(err?.message || "Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwTarget) return;
    setError("");
    if (pwForm.newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setError("Password and confirmation do not match.");
      return;
    }
    setBusy(true);
    try {
      const out = await callApi("/api/admin/reset-password", {
        method: "POST",
        body: JSON.stringify({
          uid: pwTarget.id,
          newPassword: pwForm.newPassword,
          confirmPassword: pwForm.confirmPassword,
        }),
      });
      flash(out.message || "Password updated.");
      setPwTarget(null);
      setPwForm({ newPassword: "", confirmPassword: "" });
    } catch (err: any) {
      setError(err?.message || "Password reset failed.");
    } finally {
      setBusy(false);
    }
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { superadmin: 0, manager: 0, staff: 0 };
    for (const r of rows) c[normalizeRole(r.role)] = (c[normalizeRole(r.role)] ?? 0) + 1;
    return c;
  }, [rows]);

  if (!maySee) {
    return (
      <div className="adm-card p-10 text-center">
        <p className="text-3xl mb-2">🔒</p>
        <h1 className="text-lg font-extrabold text-slate-900">Super Admin only</h1>
        <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
          Your role is <strong>{ROLE_LABEL[normalizeRole(myRole)]}</strong>. Administrator accounts can only be
          viewed and managed by a Super Admin. This restriction is also enforced by the server APIs and by
          Firestore security rules — it is not just a hidden button.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHead
        title="Admin Users"
        desc="Create and manage administrator accounts. Credentials live in Firebase Authentication — passwords are never stored in Firestore."
      >
        <button onClick={loadAll} className="adm-btn adm-btn-line text-xs">↻ Refresh</button>
        <button onClick={runWhoAmI} disabled={checking || authLoading} className="adm-btn adm-btn-line text-xs">
          {checking ? "Checking…" : "Check My Access"}
        </button>
        <button
          onClick={() => { setCreating(true); setError(""); }}
          disabled={authLoading}
          title={authLoading ? "Waiting for Firebase Auth to initialise…" : undefined}
          className="adm-btn adm-btn-gold text-xs disabled:opacity-50"
        >
          {authLoading ? "Connecting…" : "+ Create Admin User"}
        </button>
      </PageHead>

      {sdkMissing && (
        <div className="mb-4 p-3.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-[12px] space-y-1">
          <p className="font-bold">Firebase Admin credentials are not configured on the server.</p>
          <p>
            Creating administrators requires privileged server access. Add{" "}
            <code className="font-mono">FIREBASE_SERVICE_ACCOUNT</code> (the full service-account JSON) to the
            deployment environment and redeploy. Every other Admin Panel feature works without it.
          </p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
          ✓ {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold">
          {error}
        </div>
      )}

      {diag && (
        <div className="mb-4 p-3.5 bg-slate-900 text-slate-100 rounded-lg text-[11px] font-mono space-y-0.5">
          <p className="font-bold text-[#D6A600] mb-1">SERVER AUTHORIZATION CHECK</p>
          {Object.entries(diag).map(([k, v]) => (
            <p key={k}>
              <span className="text-slate-400">{k}:</span>{" "}
              <span className={v === false ? "text-red-400" : v === true ? "text-emerald-400" : ""}>
                {v === null || v === undefined ? "(none)" : String(v)}
              </span>
            </p>
          ))}
          <button
            type="button"
            onClick={() => setDiag(null)}
            className="mt-1.5 text-slate-400 underline"
          >
            dismiss
          </button>
        </div>
      )}

      {/* Signed-in identity — makes a UID mismatch obvious immediately */}
      <div
        className={`mb-4 p-3.5 rounded-xl border text-[12px] ${
          isMasterSuperAdmin(user?.uid)
            ? "bg-emerald-50 border-emerald-200 text-emerald-900"
            : "bg-amber-50 border-amber-300 text-amber-900"
        }`}
      >
        <p className="font-bold">
          {isMasterSuperAdmin(user?.uid)
            ? "✓ Signed in as the master Super Admin"
            : "⚠ You are NOT signed in as the master Super Admin"}
        </p>
        <div className="mt-1 font-mono text-[11px] space-y-0.5">
          <p>
            <span className="opacity-60">your UID:   </span>
            {user?.uid ?? "(not signed in)"}
          </p>
          <p>
            <span className="opacity-60">master UID: </span>
            {MASTER_SUPER_ADMIN_UID}
          </p>
          <p>
            <span className="opacity-60">project:    </span>
            {FIREBASE_PROJECT_ID}
          </p>
          <p>
            <span className="opacity-60">role:       </span>
            {ROLE_LABEL[normalizeRole(myRole)]}
          </p>
        </div>
        {!isMasterSuperAdmin(user?.uid) && (
          <p className="mt-1.5">
            Admin-user management still works if your account has{" "}
            <code>role: &quot;superadmin&quot;</code> and <code>active: true</code>. If creation is refused,
            press <strong>Check My Access</strong> — the server will report exactly which UID it verified.
          </p>
        )}
      </div>

      {/* Role reference */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {ALL_ROLES.map((r) => (
          <div key={r} className="adm-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-800">{ROLE_LABEL[r]}</p>
              <span className="text-[11px] font-bold text-slate-400">{counts[r] ?? 0}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{ROLE_DESCRIPTION[r]}</p>
          </div>
        ))}
      </div>

      <div className="adm-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading administrators…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">
            No administrator records yet. Use <strong>Create Admin User</strong> to add one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Administrator</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((u) => {
                  const isSelf = u.id === user?.uid;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {u.name} {isSelf && <span className="text-[10px] text-slate-400">(you)</span>}
                        </p>
                        <p className="text-[11px] text-slate-500">{u.email}</p>
                        <p className="font-mono text-[10px] text-slate-300">{u.id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          disabled={busy || isSelf}
                          value={normalizeRole(u.role)}
                          onChange={(e) => handleUpdate(u, { role: e.target.value })}
                          className="adm-input text-xs !py-1 !w-32 disabled:opacity-50"
                        >
                          {ALL_ROLES.map((r) => (
                            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          disabled={busy || isSelf}
                          onClick={() => handleUpdate(u, { active: u.active === false })}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold disabled:opacity-50 ${
                            u.active !== false ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {u.active !== false ? "ACTIVE" : "DEACTIVATED"}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex gap-1 justify-end">
                          <button
                            disabled={busy}
                            onClick={() => openEdit(u)}
                            className="px-2 py-1 rounded bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => { setPwTarget(u); setPwForm({ newPassword: "", confirmPassword: "" }); setResetLink(""); setError(""); }}
                            className="px-2 py-1 rounded bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 disabled:opacity-50"
                          >
                            Reset Password
                          </button>
                          {!isSelf && (
                            <button
                              disabled={busy}
                              onClick={() => handleDelete(u)}
                              className="px-2 py-1 rounded bg-red-50 text-red-600 font-semibold hover:bg-red-100 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-400 mt-3">
        Passwords are stored only by Firebase Authentication. This panel cannot read an existing password —
        it can only set a new one through the secure server endpoint.
      </p>

      {/* ---------- Create admin modal ---------- */}
      {creating && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">Create Admin User</h2>
              <button type="button" onClick={() => setCreating(false)} className="text-slate-400 font-bold text-lg">✕</button>
            </div>

            {error && <div className="p-2.5 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">{error}</div>}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name <span className="text-red-500">*</span></label>
              <input type="text" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="adm-input text-xs" placeholder="Rahul Bhati" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email <span className="text-red-500">*</span></label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="adm-input text-xs" placeholder="manager@granthlaptophub.com" autoComplete="off" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password <span className="text-red-500">*</span></label>
                <input type={showPw ? "text" : "password"} required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="adm-input text-xs" placeholder="min. 8 characters" autoComplete="new-password" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm <span className="text-red-500">*</span></label>
                <input type={showPw ? "text" : "password"} required minLength={8} value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} className="adm-input text-xs" placeholder="repeat password" autoComplete="new-password" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600">
              <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} />
              Show password
            </label>
            {form.password && form.confirmPassword && form.password !== form.confirmPassword && (
              <p className="text-[11px] text-red-600 font-semibold">Passwords do not match.</p>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Role <span className="text-red-500">*</span></label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })} className="adm-input text-xs">
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">{ROLE_DESCRIPTION[form.role]}</p>
            </div>

            <label className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-50">
              <span className="text-xs font-semibold text-slate-700">Account Active</span>
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="w-4 h-4" />
            </label>

            <p className="text-[10px] text-slate-400 leading-relaxed">
              A real Firebase Authentication account is created on the server. The password is sent once over
              HTTPS, stored only by Firebase Auth, and is never written to Firestore or returned to this page.
            </p>

            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => setCreating(false)} className="adm-btn adm-btn-line text-xs flex-1">Cancel</button>
              <button type="submit" disabled={busy} className="adm-btn adm-btn-gold text-xs flex-1">
                {busy ? "Creating…" : "Create Administrator"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------- Edit admin modal ---------- */}
      {editTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleEditSave} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Edit Administrator</h2>
                <p className="font-mono text-[10px] text-slate-400">{editTarget.id}</p>
              </div>
              <button type="button" onClick={() => setEditTarget(null)} className="text-slate-400 font-bold text-lg">✕</button>
            </div>

            {error && <div className="p-2.5 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">{error}</div>}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
              <input type="text" required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="adm-input text-xs" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Admin Email</label>
              <input type="email" required value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="adm-input text-xs" />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Changing this updates the Firebase Authentication sign-in email too.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
              <select
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as AdminRole })}
                className="adm-input text-xs"
                disabled={editTarget.id === user?.uid}
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">{ROLE_DESCRIPTION[editForm.role]}</p>
            </div>

            <label className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-slate-50">
              <span className="text-xs font-semibold text-slate-700">
                Account Active
                <span className="block text-[10px] font-normal text-slate-400">
                  Turning this off disables the Firebase Auth account — they cannot sign in.
                </span>
              </span>
              <input
                type="checkbox"
                checked={editForm.active}
                onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                className="w-4 h-4"
                disabled={editTarget.id === user?.uid}
              />
            </label>

            <p className="text-[10px] text-slate-400">
              Passwords cannot be viewed or edited here — use <strong>Reset Password</strong> instead.
            </p>

            <div className="flex gap-2">
              <button type="button" onClick={() => setEditTarget(null)} className="adm-btn adm-btn-line text-xs flex-1">Cancel</button>
              <button type="submit" disabled={busy} className="adm-btn adm-btn-gold text-xs flex-1">
                {busy ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------- Reset password modal ---------- */}
      {pwTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleResetPassword} className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Reset Password</h2>
                <p className="text-[11px] text-slate-500">{pwTarget.name} · {pwTarget.email}</p>
              </div>
              <button type="button" onClick={() => setPwTarget(null)} className="text-slate-400 font-bold text-lg">✕</button>
            </div>

            {error && <div className="p-2.5 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">{error}</div>}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
              <input type="password" required minLength={8} value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} className="adm-input text-xs" placeholder="min. 8 characters" autoComplete="new-password" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm New Password</label>
              <input type="password" required minLength={8} value={pwForm.confirmPassword} onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })} className="adm-input text-xs" autoComplete="new-password" />
            </div>

            <p className="text-[10px] text-slate-400">
              The current password is never shown — Firebase stores only a hash. Setting a new password revokes
              all existing sessions for this administrator.
            </p>

            <div className="rounded-lg border border-slate-200 p-3 space-y-2">
              <p className="text-[11px] font-bold text-slate-700">Or use Firebase&apos;s secure reset flow</p>
              <button
                type="button"
                disabled={busy}
                onClick={handleSendResetLink}
                className="adm-btn adm-btn-line text-[11px] w-full"
              >
                {busy ? "Working…" : "Generate Password Reset Link"}
              </button>
              {resetLink && (
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500">
                    Share this privately with the administrator — it expires automatically:
                  </p>
                  <textarea
                    readOnly
                    rows={3}
                    value={resetLink}
                    onFocus={(e) => e.currentTarget.select()}
                    className="adm-input text-[10px] font-mono"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button type="button" onClick={() => setPwTarget(null)} className="adm-btn adm-btn-line text-xs flex-1">Cancel</button>
              <button type="submit" disabled={busy} className="adm-btn adm-btn-gold text-xs flex-1">
                {busy ? "Updating…" : "Update Password"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
