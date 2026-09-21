"use client";
import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAdminAuth } from "@/lib/firebase-auth";
import { AdminShell, moduleForPath } from "@/admin/shell";
import { canAccess, normalizeRole, ROLE_LABEL } from "@/lib/permissions";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin, role } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace("/admin/login");
    }
  }, [user, loading, isAdmin, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Connecting to Firebase Admin...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null; // Will redirect via useEffect
  }

  /**
   * ROUTE-LEVEL PERMISSION GUARD.
   *
   * Hiding a nav item is not enough — a Staff or Manager user could type an
   * admin-only URL directly. This blocks the render. Firestore security rules
   * and the server APIs enforce the same matrix independently, so even a
   * bypassed client cannot read or write restricted data.
   */
  const mod = moduleForPath(pathname ?? "");
  if (mod && !canAccess(role, mod)) {
    return (
      <AdminShell>
        <div className="adm-card p-10 text-center">
          <p className="text-3xl mb-2">🔒</p>
          <h1 className="text-lg font-extrabold text-slate-900">Access restricted</h1>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Your role is <strong>{ROLE_LABEL[normalizeRole(role)]}</strong>, which does not include access to
            this section. This restriction is enforced by the server APIs and Firestore security rules as well,
            not only in the interface.
          </p>
          <Link href="/admin" className="adm-btn adm-btn-gold text-xs mt-5 inline-block">
            Back to Dashboard
          </Link>
        </div>
      </AdminShell>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}
