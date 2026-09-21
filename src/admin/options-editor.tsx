"use client";
import React from "react";
import type { ProductOption } from "@/lib/product-specs";

/**
 * Fully configurable RAM / Storage / Warranty option editor.
 *
 * Every option carries its own price adjustment defined by the admin for THIS
 * product — there is no fixed ₹5000 (or any other hardcoded) upgrade amount
 * anywhere in the Admin Panel or in the saved Firestore document.
 */
export function OptionsEditor({
  title,
  description,
  addLabel,
  valuePlaceholder,
  options,
  onChange,
  basePrice,
  suggestions = [],
}: {
  title: string;
  description: string;
  addLabel: string;
  valuePlaceholder: string;
  options: ProductOption[];
  onChange: (next: ProductOption[]) => void;
  basePrice: number;
  suggestions?: string[];
}) {
  const update = (idx: number, patch: Partial<ProductOption>) => {
    onChange(options.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
  };

  const add = (value = "") => {
    onChange([
      ...options,
      { value, priceAdjustment: 0, active: true, isDefault: options.length === 0 },
    ]);
  };

  const remove = (idx: number) => {
    const next = options.filter((_, i) => i !== idx);
    if (next.length > 0 && !next.some((o) => o.isDefault)) next[0].isDefault = true;
    onChange(next);
  };

  const setDefault = (idx: number) => {
    onChange(options.map((o, i) => ({ ...o, isDefault: i === idx })));
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-800">{title}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => add()}
          className="shrink-0 px-2.5 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold hover:bg-slate-800"
        >
          + {addLabel}
        </button>
      </div>

      {suggestions.length > 0 && options.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] text-slate-400 self-center">Quick add:</span>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="px-2 py-0.5 rounded-full bg-slate-100 hover:bg-amber-100 text-[10px] font-semibold text-slate-600"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {options.length === 0 ? (
        <p className="text-[11px] text-slate-400 bg-slate-50 rounded-lg p-3">
          No options configured. The customer website will show only the base configuration and no
          upgrade pricing for this product.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="hidden sm:grid grid-cols-[1fr_130px_92px_84px_60px_34px] gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Option value</span>
            <span>Price adjustment ₹</span>
            <span>Final price</span>
            <span>Stock (opt.)</span>
            <span>Active</span>
            <span />
          </div>

          {options.map((opt, idx) => (
            <div
              key={idx}
              className="grid grid-cols-1 sm:grid-cols-[1fr_130px_92px_84px_60px_34px] gap-2 items-center rounded-lg bg-slate-50 p-2"
            >
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  title="Set as default selection on the customer website"
                  onClick={() => setDefault(idx)}
                  className={`w-4 h-4 rounded-full border-2 shrink-0 ${
                    opt.isDefault ? "bg-[#D6A600] border-[#D6A600]" : "border-slate-300 bg-white"
                  }`}
                />
                <input
                  type="text"
                  value={opt.value}
                  onChange={(e) => update(idx, { value: e.target.value })}
                  placeholder={valuePlaceholder}
                  className="adm-input text-xs !py-1.5"
                />
              </div>

              <input
                type="number"
                value={Number.isFinite(opt.priceAdjustment) ? opt.priceAdjustment : 0}
                onChange={(e) => update(idx, { priceAdjustment: Number(e.target.value) || 0 })}
                placeholder="0"
                className="adm-input text-xs !py-1.5"
              />

              <div className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
                ₹{(Number(basePrice || 0) + Number(opt.priceAdjustment || 0)).toLocaleString("en-IN")}
              </div>

              <input
                type="number"
                value={opt.stock ?? ""}
                onChange={(e) =>
                  update(idx, {
                    stock: e.target.value === "" ? undefined : Number(e.target.value) || 0,
                  })
                }
                placeholder="—"
                className="adm-input text-xs !py-1.5"
              />

              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={opt.active !== false}
                  onChange={(e) => update(idx, { active: e.target.checked })}
                />
                On
              </label>

              <button
                type="button"
                onClick={() => remove(idx)}
                className="w-7 h-7 rounded-lg bg-red-50 text-red-600 font-bold hover:bg-red-100"
                title="Remove option"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
