"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export { inrA } from "@/lib/format";

export async function api(path: string, opts: RequestInit = {}) {
  const r = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? `Request failed (${r.status})`);
  return d;
}

export function useFetch<T = any>(url: string | null, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!url);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!url) return;
    let on = true;
    setLoading(true);
    setError("");
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => on && setData(d))
      .catch((e) => on && setError(e.message))
      .finally(() => on && setLoading(false));
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}

export function useSetting<T = any>(key: string) {
  const { data, loading, error, reload } = useFetch<{ value: T }>(`/api/settings/${key}`);
  const [v, setV] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    if (data) setV(data.value);
  }, [data]);
  const save = useCallback(
    async (val: T) => {
      setSaving(true);
      setErr("");
      setSaved(false);
      try {
        await api(`/api/settings/${key}`, { method: "PUT", body: JSON.stringify(val) });
        setV(val);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch (e: any) {
        setErr(e.message);
      } finally {
        setSaving(false);
      }
    },
    [key]
  );
  return { v: v ?? (null as any), set: setV, loading, error: error || err, save, saving, saved, reload };
}

/* ---------- page header (reference style) ---------- */
export function PageHead({ title, desc, children }: { title: string; desc?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-[26px] leading-tight font-extrabold tracking-tight text-[#111827]">{title}</h1>
        {desc && <p className="text-[13px] text-slate-500 mt-1 max-w-2xl">{desc}</p>}
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = "" }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`adm-card ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100">
          <p className="text-[15px] font-bold text-[#111827] tracking-tight">{title}</p>
          {action}
        </div>
      )}
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  );
}

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-400 mt-1.5">{hint}</p>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 disabled:opacity-50 cursor-pointer"
      role="switch"
      aria-checked={checked}
    >
      <span
        className={`w-10 h-[22px] rounded-full p-[3px] transition-colors shrink-0 ${checked ? "bg-emerald-500" : "bg-slate-300"}`}
      >
        <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[18px]" : ""}`} />
      </span>
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
    </button>
  );
}

export function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    published: "pill pill-green",
    active: "pill pill-green",
    approved: "pill pill-green",
    delivered: "pill pill-green",
    confirmed: "pill pill-blue",
    new: "pill pill-blue",
    pending: "pill pill-amber",
    processing: "pill pill-blue",
    shipped: "pill pill-violet",
    contacted: "pill pill-blue",
    interested: "pill pill-violet",
    converted: "pill pill-green",
    hidden: "pill pill-slate",
    draft: "pill pill-slate",
    archived: "pill pill-slate",
    cancelled: "pill pill-red",
    returned: "pill pill-amber",
    closed: "pill pill-slate",
    inactive: "pill pill-slate",
  };
  return <span className={map[status] ?? "pill pill-slate"}>{status}</span>;
}

export function Empty({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="text-center py-14 px-4">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 grid place-items-center mb-3">
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2 3 7v10l9 5 9-5V7Z" /><path d="M3 7l9 5 9-5" /><path d="M12 12v10" />
        </svg>
      </div>
      <p className="text-sm font-bold text-slate-700">{title}</p>
      {sub && <p className="text-[13px] text-slate-400 mt-1 max-w-sm mx-auto">{sub}</p>}
    </div>
  );
}

export function Spinner() {
  return <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-[#D6A600] rounded-full animate-spin" aria-hidden />;
}

export function Loading() {
  return (
    <div className="space-y-3 py-4" role="status" aria-label="Loading">
      <div className="adm-skeleton h-10 w-full" />
      <div className="adm-skeleton h-10 w-full" />
      <div className="adm-skeleton h-10 w-2/3" />
    </div>
  );
}

export function LoadingInline({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-10 text-slate-400 gap-2.5">
      <Spinner /> <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

export function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-[13px] px-4 py-3 font-medium flex items-start gap-2.5 adm-toast" role="alert">
      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5 w-[18px] h-[18px] shrink-0 mt-[1px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
      </svg>
      <span>{msg}</span>
    </div>
  );
}

export function SuccessBox({ msg }: { msg: string }) {
  return (
    <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] px-4 py-3 font-medium flex items-start gap-2.5 adm-toast" role="status">
      <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] shrink-0 mt-[1px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="m8.5 12.2 2.4 2.4 4.6-4.8" />
      </svg>
      <span>{msg}</span>
    </div>
  );
}

export function SaveBar({ saving, saved, error, onReset, canReset }: { saving: boolean; saved: boolean; error: string; onReset?: () => void; canReset?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {saving && (
        <span className="flex items-center gap-2 text-sm text-slate-500 font-medium">
          <Spinner /> Saving…
        </span>
      )}
      {!saving && saved && (
        <span className="text-sm font-semibold text-emerald-600 adm-toast inline-flex items-center gap-1.5">
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m4 12.5 5 5L20 6.5" /></svg>
          Saved
        </span>
      )}
      {!saving && error && <span className="text-sm font-semibold text-red-600">{error}</span>}
      {canReset && onReset && !saving && (
        <button type="button" onClick={onReset} className="adm-btn adm-btn-line text-xs px-3 py-1.5">
          Reset
        </button>
      )}
    </div>
  );
}

export function useConfirm() {
  const [state, setState] = useState<{ msg: string; onYes: () => void } | null>(null);
  const ask = (msg: string, onYes: () => void) => setState({ msg, onYes });
  const node = state ? (
    <div className="fixed inset-0 z-[80] grid place-items-center p-4" role="alertdialog" aria-modal="true" aria-label="Confirm action">
      <div className="absolute inset-0 bg-[#0F172A]/55 backdrop-blur-[2px] adm-overlay" onClick={() => setState(null)} />
      <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm adm-modal-card">
        <div className="w-11 h-11 rounded-xl bg-red-50 grid place-items-center mb-3">
          <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="m6.5 7 .8 13h9.4l.8-13" />
          </svg>
        </div>
        <p className="font-bold text-[#111827] text-[15px]">Are you sure?</p>
        <p className="text-[13px] text-slate-500 mt-1.5 leading-relaxed">{state.msg}</p>
        <div className="flex justify-end gap-2 mt-5">
          <button className="adm-btn adm-btn-line" onClick={() => setState(null)}>Cancel</button>
          <button
            className="adm-btn bg-red-600 text-white hover:bg-red-700"
            onClick={() => {
              state.onYes();
              setState(null);
            }}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  ) : null;
  return { ask, node };
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto" role="dialog" aria-modal="true" aria-label={title}>
      <div className="fixed inset-0 bg-[#0F172A]/55 backdrop-blur-[2px] adm-overlay" onClick={onClose} />
      <div className="relative min-h-full flex items-start justify-center p-4 sm:p-8">
        <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-3xl" : "max-w-lg"} my-4 adm-modal-card`}>
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
            <p className="font-bold text-[#111827] text-[15px]">{title}</p>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition" aria-label="Close">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="p-5 sm:p-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function UpDown({ canUp, canDown, onUp, onDown }: { canUp: boolean; canDown: boolean; onUp: () => void; onDown: () => void }) {
  return (
    <span className="inline-flex rounded-lg border border-slate-200 overflow-hidden bg-white">
      <button type="button" disabled={!canUp} onClick={onUp} className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition" aria-label="Move up">▲</button>
      <button type="button" disabled={!canDown} onClick={onDown} className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-50 disabled:opacity-30 border-l border-slate-200 transition" aria-label="Move down">▼</button>
    </span>
  );
}

export const ICON_CHOICES = ["badge", "shield", "wallet", "truck", "star", "wrench", "headset", "store", "refresh", "chat", "phone", "pin", "clock", "laptop"];

export function ImgField({ value, onChange, label = "Image URL" }: { value: string; onChange: (v: string) => void; label?: string }) {
  // Legacy wrapper — delegates to the universal ImgBB uploader.
  // (Local /api/upload disk writes were removed; all hosting is ImgBB.)
  return <LazyImgBBField value={value} onChange={onChange} label={label} />;
}

function LazyImgBBField({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [Comp, setComp] = useState<any>(null);
  useEffect(() => {
    import("./image-uploader").then((m) => setComp(() => m.ImageUploader));
  }, []);
  if (!Comp) return <div className="adm-input opacity-60 text-xs">Loading uploader…</div>;
  return <Comp value={value} onChange={onChange} label={label} />;
}

export function ChipInput({ value, onChange, presets = [] }: { value: string[]; onChange: (v: string[]) => void; presets?: string[] }) {
  const [draft, setDraft] = useState("");
  const add = (t: string) => {
    const s = t.trim();
    if (s && !value.includes(s)) onChange([...value, s]);
    setDraft("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 bg-[#FFF9E8] text-[#7d5f1e] text-[11px] font-bold px-2 py-1 rounded-lg">
            {t}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} className="hover:text-red-600" aria-label={`Remove ${t}`}>✕</button>
          </span>
        ))}
        {value.length === 0 && <span className="text-[12px] text-slate-400">No tags yet</span>}
      </div>
      <div className="flex gap-2">
        <input
          className="adm-input flex-1"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            }
          }}
          placeholder="Type a tag and press Enter"
        />
        <button type="button" className="adm-btn adm-btn-line text-xs" onClick={() => add(draft)}>Add</button>
      </div>
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {presets.filter((p) => !value.includes(p)).map((p) => (
            <button key={p} type="button" onClick={() => add(p)} className="text-[11px] font-semibold text-slate-500 bg-slate-100 hover:bg-[#FFF9E8] hover:text-[#7d5f1e] px-2 py-1 rounded-lg transition">
              + {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function toLocalInput(d: string | null | undefined) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function useDebounce(value: string, ms = 350) {
  const [out, setOut] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setOut(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return out;
}

export function useFlash() {
  const [msg, setMsg] = useState("");
  const flash = useCallback((m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 2500);
  }, []);
  return { msg, flash };
}

/* ---------- reference-style table helpers (presentational only) ---------- */
export function TableCard({ title, viewAllHref, viewAllLabel = "View All", children }: { title: string; viewAllHref?: string; viewAllLabel?: string; children: React.ReactNode }) {
  return (
    <div className="adm-card overflow-hidden">
      <div className="flex items-center justify-between px-5 sm:px-6 py-4">
        <p className="text-[15px] font-bold text-[#111827] tracking-tight">{title}</p>
        {viewAllHref && (
          <a href={viewAllHref} className="text-[12px] font-bold text-[#1c4fd6] hover:underline inline-flex items-center gap-1">
            {viewAllLabel}
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16" /><path d="m14 6 6 6-6 6" /></svg>
          </a>
        )}
      </div>
      <div className="px-3 sm:px-4 pb-4">{children}</div>
    </div>
  );
}

export function RowMenu({ actions }: { actions: { label: string; href?: string; onClick?: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
        aria-label="Row actions"
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="currentColor"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg>
      </button>
      {open && (
        <div className="adm-pop right-0 top-full mt-1 w-40 py-1 text-[13px]">
          {actions.map((a, i) =>
            a.href ? (
              <a key={i} href={a.href} onClick={() => setOpen(false)} className={`block px-3.5 py-2 font-medium transition ${a.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"}`}>
                {a.label}
              </a>
            ) : (
              <button key={i} onClick={() => { setOpen(false); a.onClick?.(); }} className={`w-full text-left block px-3.5 py-2 font-medium transition ${a.danger ? "text-red-600 hover:bg-red-50" : "text-slate-700 hover:bg-slate-50"}`}>
                {a.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
