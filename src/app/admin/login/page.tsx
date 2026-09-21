"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ensureAuthPersistence } from "@/lib/admin-session";
import { auth, AUTHORIZED_ADMIN_UID, CUSTOMER_WEBSITE_URL } from "@/lib/firebase";
import { useAdminAuth } from "@/lib/firebase-auth";
import { BRAND } from "@/lib/brand";
import { Icon } from "@/admin/icons";

export default function AdminLoginPage() {
  const router = useRouter();
  const { denyReason, logout } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);

    try {
      // ITEM 5 — persist the session across reloads (browserLocalPersistence).
      await ensureAuthPersistence();
      // Direct Firebase Authentication
      const userCred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const user = userCred.user;

      // Authorization itself is resolved by AdminAuthProvider against
      // adminUsers/{uid} (active == true) / the primary admin UID, and is
      // enforced by firestore.rules on every read & write.
      if (!user) throw new Error("Authentication failed.");
      router.push("/admin");
    } catch (err: any) {
      console.error("Firebase Auth Error:", err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        setError("Invalid email or password. Please verify your admin credentials.");
      } else if (err.code === "auth/user-disabled") {
        setError("Your admin account is inactive. Contact a Super Admin to reactivate it.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please wait a few moments and try again.");
      } else if (err.code === "auth/invalid-email") {
        setError("That email address is not valid.");
      } else {
        setError(err.message || "Failed to authenticate with Firebase.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2" style={{ background: "#F7F8FA" }}>
      {/* Brand Side */}
      <div
        className="hidden lg:flex flex-col justify-between p-12 text-white"
        style={{ background: "#0F172A" }}
      >
        <div className="bg-white rounded-2xl px-5 py-4 shadow-sm max-w-[300px]">
          <img
            src={BRAND.logo}
            alt="Granth Laptop Hub — official logo"
            className="w-full h-[110px] object-contain"
            draggable={false}
          />
          <div className="mt-2 text-center">
            <p className="font-extrabold tracking-tight text-[#111827] leading-tight">GRANTH LAPTOP HUB</p>
            <p className="text-[9px] font-bold tracking-[0.3em] text-[#B88900]">JAIPUR · ADMIN PANEL</p>
          </div>
        </div>

        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#D6A600]">
            Granth Laptop Hub · Store Management System
          </p>
          <h1 className="text-[40px] font-extrabold tracking-tight leading-[1.1] mt-3 max-w-md">
            Directly control the live customer website.
          </h1>

          <div className="mt-6 p-4 rounded-2xl bg-white/10 border border-white/15 text-xs text-white/80 space-y-2">
            <p className="font-semibold text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Connected to Customer Website:
            </p>
            <a
              href={CUSTOMER_WEBSITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#D6A600] hover:underline font-mono text-[11px] break-all block"
            >
              {CUSTOMER_WEBSITE_URL} ↗
            </a>
            <p className="text-[11px] text-white/60">
              Firebase Project: <code className="text-white">laptop-database-24873</code>
            </p>
          </div>

          <ul className="mt-8 space-y-3 text-white/70 text-sm">
            {[
              "Firestore live sync to customer storefront",
              "Secure ImgBB image uploads (no manual URLs, no Firebase Storage)",
              "Live pricing, stock, sections & spotlight deals",
              "Customer orders & first-order scratch reward tracking",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#D6A600]/20 grid place-items-center text-[#D6A600] shrink-0">
                  <Icon name="check" className="w-3 h-3" />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-center justify-between text-xs text-white/40">
          <span>Authorized Admin UID: {AUTHORIZED_ADMIN_UID.slice(0, 10)}...</span>
          <a
            href={CUSTOMER_WEBSITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/60 hover:text-white underline"
          >
            Visit Customer Site ↗
          </a>
        </div>
      </div>

      {/* Form Side */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-white rounded-2xl border border-[#E8EDF5] shadow-[0_8px_30px_rgba(17,26,56,0.08)] p-6 sm:p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <img
              src={BRAND.logo}
              alt="Granth Laptop Hub — official logo"
              className="w-40 h-28 object-contain"
              draggable={false}
            />
            <p className="font-extrabold text-[#111827] leading-tight tracking-tight mt-2">GRANTH LAPTOP HUB</p>
            <p className="text-[10px] text-[#B88900] font-bold tracking-[0.25em] mt-1">ADMIN PANEL · JAIPUR, RAJASTHAN</p>
          </div>

          <h2 className="text-[24px] font-extrabold tracking-tight text-[#111827]">Admin Sign In</h2>
          <p className="text-[13px] text-slate-500 mt-1">Firebase Authentication for website owner.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Admin Email</label>
              <input
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="adm-input !py-2.5"
                placeholder="admin@granthlaptophub.com"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="adm-input !py-2.5 !pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label="Toggle password visibility"
                >
                  {show ? (
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M9.9 5.1A9.8 9.8 0 0 1 12 4.8c6.5 0 10 7.2 10 7.2a17 17 0 0 1-3.2 4M6.1 6.2A16.8 16.8 0 0 0 2 12s3.5 7.2 10 7.2a10 10 0 0 0 3.9-.8" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {!error && denyReason === "inactive" && (
              <div className="rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium px-3 py-2.5 space-y-1.5">
                <p className="font-bold">Your admin account is inactive.</p>
                <p>A Super Admin has deactivated this account. Contact them to regain access.</p>
                <button type="button" onClick={() => logout()} className="underline font-bold">
                  Sign out
                </button>
              </div>
            )}

            {!error && denyReason === "not-admin" && (
              <div className="rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium px-3 py-2.5 space-y-1.5">
                <p className="font-bold">This account has no Admin Panel access.</p>
                <p>Sign in with an administrator account, or ask a Super Admin to create one for you.</p>
                <button type="button" onClick={() => logout()} className="underline font-bold">
                  Sign out
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium px-3.5 py-2.5 leading-relaxed adm-toast" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="adm-btn adm-btn-gold w-full !py-2.5 !text-sm !font-bold"
            >
              {busy ? "Signing in to Firebase..." : "Sign In to Admin Panel"}
            </button>
          </form>

          <div className="mt-4 pt-4 border-t border-slate-200 text-center space-y-1">
            <p className="text-[11px] text-slate-400">
              Admin access is granted by an <code className="text-slate-600">adminUsers/&#123;uid&#125;</code>{" "}
              document with <code className="text-slate-600">active == true</code>, and enforced by Firestore
              security rules.
            </p>
            <p className="text-[11px] text-slate-400">
              Primary admin UID: <code className="text-slate-600">{AUTHORIZED_ADMIN_UID.slice(0, 14)}...</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
