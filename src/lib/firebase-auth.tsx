"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { auth, AUTHORIZED_ADMIN_UID } from "./firebase";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { normalizeRole, isMasterSuperAdmin, type AdminRole } from "./permissions";
import { ensureAuthPersistence } from "./admin-session";

interface AdminAuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  role: AdminRole;
  adminName: string;
  /** Fresh Firebase ID token for calling secure server endpoints. */
  getIdToken: () => Promise<string>;
  /**
   * Resolves when Firebase Auth has finished its initial state restoration.
   * Used by admin API calls so they never fire while `loading === true` and
   * mistake a transient null for a real signed-out state.
   */
  waitForAuth: () => Promise<User | null>;
  denyReason: "" | "inactive" | "not-admin";
  logout: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextType>({
  user: null,
  loading: true,
  isAdmin: false,
  role: "staff",
  adminName: "",
  getIdToken: async () => "",
  waitForAuth: async () => null,
  denyReason: "",
  logout: async () => {},
});

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [role, setRole] = useState<AdminRole>("staff");
  const [adminName, setAdminName] = useState("");
  const [denyReason, setDenyReason] = useState<"" | "inactive" | "not-admin">("");

  // waitForAuth resolves once onAuthStateChanged has fired its first event.
  // A single stable object created once per provider instance via a lazy
  // state initializer — no refs are read or written during render.
  const [authWait] = useState(() => {
    let resolve: (u: User | null) => void = () => {};
    const promise = new Promise<User | null>((r) => {
      resolve = r;
    });
    return { promise, resolve, resolved: false };
  });
  const waitForAuth = useCallback(() => authWait.promise, [authWait]);

  // ITEM 5 — persistence across reloads. Called once on mount; failures are
  // non-fatal (session works in-memory, just won't survive a reload in this
  // browser).
  useEffect(() => {
    ensureAuthPersistence().catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      // CRITICAL: notify waitForAuth on the FIRST event only — the loading
      // flag below handles every subsequent event.
      if (!authWait.resolved) {
        authWait.resolved = true;
        authWait.resolve(currentUser);
      }

      setUser(currentUser);

      if (currentUser) {
        if (isMasterSuperAdmin(currentUser.uid)) {
          // Master UID: no Firestore lookup required, no adminUsers doc required.
          setIsAdmin(true);
          setRole("superadmin");
          setAdminName(currentUser.displayName || currentUser.email || "Owner");
          setDenyReason("");
        } else {
          try {
            const [tokenResult, adminDoc] = await Promise.all([
              currentUser.getIdTokenResult(),
              getDoc(doc(db, "adminUsers", currentUser.uid)),
            ]);
            const claimRole = tokenResult.claims?.role;
            const data = adminDoc.exists() ? adminDoc.data() : null;
            const active = data ? data.active !== false : false;
            const normalizedRole = normalizeRole(claimRole ?? data?.role);

            // DEBUG: Log the authorization decision
            console.log("[AUTH] Authorization check:", {
              uid: currentUser.uid,
              docExists: adminDoc.exists(),
              rawRole: data?.role,
              claimRole,
              activeField: data?.active,
              activeComputed: active,
              normalizedRole,
            });

            // Authorization logic:
            // 1. If doc exists AND has valid role AND not explicitly inactive → allow
            // 2. If doc exists AND explicitly inactive → deny with "inactive"
            // 3. If doc doesn't exist AND has claim role → allow (legacy)
            // 4. Otherwise → deny with "not-admin"
            if (adminDoc.exists() && active) {
              setIsAdmin(true);
              setRole(normalizeRole(claimRole ?? data?.role));
              setAdminName(
                String(data?.name || currentUser.displayName || currentUser.email || "admin")
              );
              setDenyReason("");
            } else if (adminDoc.exists() && data?.active === false) {
              setIsAdmin(false);
              setRole("staff");
              setDenyReason("inactive");
            } else if (!adminDoc.exists() && claimRole) {
              setIsAdmin(true);
              setRole(normalizeRole(claimRole));
              setAdminName(currentUser.displayName || currentUser.email || "admin");
              setDenyReason("");
            } else {
              setIsAdmin(false);
              setRole("staff");
              setDenyReason("not-admin");
            }
          } catch (e) {
            // ITEM 10 — do NOT lock the user out on a transient Firestore or
            // network failure. Keep whatever auth state we had. A subsequent
            // 401/403 from the server will surface the real cause.
            console.warn("Admin role check failed (keeping current state):", e);
            // If we previously determined the user IS an admin, keep it.
            // Otherwise fall through and show "not-admin" so the UI can prompt
            // a re-check.
            // Note: We use setIsAdmin's callback form to access the current state
            // and avoid stale closure issues.
            setIsAdmin((prevIsAdmin) => {
              if (!prevIsAdmin) {
                setDenyReason("not-admin");
              }
              return prevIsAdmin;
            });
          }
        }
      } else {
        setIsAdmin(false);
        setRole("staff");
        setAdminName("");
        setDenyReason("");
      }
      setLoading(false);
    });

    return () => unsub();
  }, [authWait]);

  const getIdToken = async () => {
    const u = auth.currentUser;
    if (!u) return "";
    return u.getIdToken(true);
  };

  const logout = async () => {
    await signOut(auth);
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch {}
  };

  const value = useMemo<AdminAuthContextType>(
    () => ({ user, loading, isAdmin, role, adminName, getIdToken, waitForAuth, denyReason, logout }),
    // waitForAuth is stable (useCallback over the stable authWait holder).
    [user, loading, isAdmin, role, adminName, denyReason, waitForAuth]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export const useAdminAuth = () => useContext(AdminAuthContext);
