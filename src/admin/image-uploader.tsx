"use client";
import React, { useEffect, useRef, useState } from "react";
import {
  ACCEPT_ATTR,
  isBrokenImageValue,
  uploadImageViaServer,
  validateImageFile,
} from "@/lib/storage";

interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  folder?: string; // optional grouping label for logs (hosting is always ImgBB)
  label?: string;
  hint?: string;
  required?: boolean;
}

const BROKEN_PLACEHOLDER =
  "https://images.placeholders.dev/?width=400&height=225&text=Invalid+Image";

/**
 * Universal single-image uploader.
 * Flow: select → local preview → Upload (ImgBB via /api/upload-image) → hosted URL.
 * Existing values are kept until Replace succeeds; Remove clears the field.
 */
export function ImageUploader({
  value,
  onChange,
  folder = "uploads",
  label = "Image",
  hint,
  required = false,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [pending, setPending] = useState<{ file: File; preview: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (pending?.preview) URL.revokeObjectURL(pending.preview);
    };
  }, [pending]);

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validateImageFile(file);
    if (err) {
      setError(err);
      setSuccess("");
      return;
    }
    setError("");
    setSuccess("");
    if (pending?.preview) URL.revokeObjectURL(pending.preview);
    setPending({ file, preview: URL.createObjectURL(file) });
  };

  const cancelPending = () => {
    if (pending?.preview) URL.revokeObjectURL(pending.preview);
    setPending(null);
    setError("");
  };

  const doUpload = async () => {
    if (!pending) return;
    setError("");
    setSuccess("");
    setUploading(true);
    setProgress(0);
    try {
      const res = await uploadImageViaServer(pending.file, (p) => setProgress(p));
      onChange(res.url);
      setSuccess("Image uploaded to ImgBB ✓ URL ready — press Save to store it in Firestore.");
      if (pending.preview) URL.revokeObjectURL(pending.preview);
      setPending(null);
    } catch (err: any) {
      console.error("ImgBB upload error:", err);
      setError(err?.message || "Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const broken = isBrokenImageValue(value);

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      <div className="flex flex-col gap-2">
        {/* Current saved image */}
        {value && !pending ? (
          <div className="relative inline-block w-full max-w-xs group">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-sm">
              <img
                src={broken ? BROKEN_PLACEHOLDER : value}
                alt="Current image"
                className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = BROKEN_PLACEHOLDER;
                }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500 gap-2">
              <span className="truncate max-w-[200px]" title={value}>
                {broken
                  ? "⚠ Broken reference — replace via upload"
                  : value.includes("i.ibb.co")
                  ? "ImgBB hosted image ✓"
                  : "Saved image"}
              </span>
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setSuccess("");
                  setError("");
                }}
                className="text-red-600 hover:text-red-700 font-semibold shrink-0"
              >
                Remove
              </button>
            </div>
          </div>
        ) : null}

        {/* Pending local preview (before upload) */}
        {pending ? (
          <div className="w-full max-w-xs rounded-xl border-2 border-amber-400 bg-amber-50/40 p-2.5 space-y-2">
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-amber-200 bg-white">
              <img src={pending.preview} alt="Preview before upload" className="h-full w-full object-cover" />
            </div>
            <p className="text-[11px] text-slate-600 truncate" title={pending.file.name}>
              <span className="font-semibold">Selected:</span> {pending.file.name} (
              {(pending.file.size / 1024).toFixed(0)} KB) — not uploaded yet
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={doUpload}
                disabled={uploading}
                className="adm-btn adm-btn-gold text-xs py-1.5 px-3 flex-1 disabled:opacity-60"
              >
                {uploading ? `Uploading ${progress}%…` : "⬆ Upload to ImgBB"}
              </button>
              <button
                type="button"
                onClick={cancelPending}
                disabled={uploading}
                className="adm-btn adm-btn-line text-xs py-1.5 px-3"
              >
                Cancel
              </button>
            </div>
            {uploading && (
              <div className="w-full bg-white rounded-full h-1.5 overflow-hidden border border-amber-200">
                <div className="bg-amber-500 h-1.5 transition-all duration-200" style={{ width: `${progress}%` }} />
              </div>
            )}
          </div>
        ) : null}

        {/* Empty state */}
        {!value && !pending ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl hover:border-amber-500 bg-white hover:bg-amber-50/20 cursor-pointer transition"
          >
            <svg className="w-8 h-8 text-slate-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-xs font-semibold text-slate-700">Click to select from device / camera</p>
            <p className="text-[11px] text-slate-400 mt-0.5">JPG, JPEG, PNG, WEBP · up to 10 MB · hosted on ImgBB</p>
          </div>
        ) : null}

        {/* Picker buttons */}
        {!pending && (
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_ATTR}
              className="hidden"
              onChange={pickFile}
              disabled={uploading}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="adm-btn adm-btn-line text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {value ? "Replace Image" : "Select Image"}
            </button>
            {value && <span className="text-[11px] text-slate-400">Current URL is kept until a new upload succeeds.</span>}
          </div>
        )}

        {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        {success && <p className="text-xs font-medium text-emerald-700">{success}</p>}
        {hint ? (
          <p className="text-[11px] text-slate-400">{hint}</p>
        ) : (
          <p className="text-[11px] text-slate-400">
            Group: <code className="font-mono">/{folder}</code> · Uploads to ImgBB, URL saves to Firestore on Save.
          </p>
        )}
      </div>
    </div>
  );
}

interface MultiImageUploaderProps {
  values: string[];
  onChange: (urls: string[]) => void;
  folder?: string;
  label?: string;
}

/**
 * Multi-image gallery uploader (products).
 * Pending files preview locally first; "Upload N to ImgBB" uploads them
 * one-by-one with progress, then appends the hosted URLs.
 */
export function MultiImageUploader({
  values,
  onChange,
  folder = "products",
  label = "Gallery Images",
}: MultiImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState<{ file: File; preview: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setError("");
    setSuccess("");
    const next: { file: File; preview: string }[] = [];
    for (const file of files) {
      const err = validateImageFile(file);
      if (err) {
        setError(`${file.name}: ${err}`);
        continue;
      }
      next.push({ file, preview: URL.createObjectURL(file) });
    }
    if (next.length) setPending((prev) => [...prev, ...next]);
  };

  const removePending = (idx: number) => {
    setPending((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const uploadAll = async () => {
    if (!pending.length) return;
    setError("");
    setSuccess("");
    setUploading(true);
    setProgress(0);
    const uploadedUrls: string[] = [];
    try {
      for (let i = 0; i < pending.length; i++) {
        const { file } = pending[i];
        const res = await uploadImageViaServer(file, (p) => {
          setProgress(Math.round(((i + p / 100) / pending.length) * 100));
        });
        uploadedUrls.push(res.url);
      }
      pending.forEach((p) => URL.revokeObjectURL(p.preview));
      setPending([]);
      onChange([...values, ...uploadedUrls]);
      setSuccess(`${uploadedUrls.length} image(s) uploaded to ImgBB ✓ — press Save to store them in Firestore.`);
    } catch (err: any) {
      console.error("ImgBB multi upload error:", err);
      // Keep already-uploaded URLs so nothing is lost.
      if (uploadedUrls.length) {
        pending.slice(uploadedUrls.length).forEach((p) => URL.revokeObjectURL(p.preview));
        setPending((prev) => prev.slice(uploadedUrls.length));
        onChange([...values, ...uploadedUrls]);
        setError(`Uploaded ${uploadedUrls.length}, then failed: ${err?.message || "upload error"}. Remaining files kept below — retry.`);
      } else {
        setError(err?.message || "Failed to upload images. Please try again.");
      }
    } finally {
      setUploading(false);
    }
  };

  const removeAt = (idx: number) => {
    onChange(values.filter((_, i) => i !== idx));
  };

  const setPrimary = (idx: number) => {
    if (idx === 0) return;
    const target = values[idx];
    const rest = values.filter((_, i) => i !== idx);
    onChange([target, ...rest]);
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...values];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700">{label}</label>
        <span className="text-xs text-slate-400">{values.length} saved · First image is Primary</span>
      </div>

      {/* Saved gallery */}
      {values.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {values.map((url, idx) => {
            const broken = isBrokenImageValue(url);
            return (
              <div
                key={`${url}-${idx}`}
                className={`relative group rounded-lg overflow-hidden border bg-white shadow-sm flex flex-col ${
                  idx === 0 ? "border-amber-500 ring-2 ring-amber-500/20" : "border-slate-200"
                }`}
              >
                <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
                  <img
                    src={broken ? BROKEN_PLACEHOLDER : url}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = BROKEN_PLACEHOLDER;
                    }}
                  />
                  {idx === 0 && (
                    <span className="absolute top-1 left-1 bg-amber-500 text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shadow">
                      Primary
                    </span>
                  )}
                  {broken && (
                    <span className="absolute bottom-1 left-1 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                      Broken — replace
                    </span>
                  )}
                </div>
                <div className="p-1.5 flex items-center justify-between bg-slate-50 border-t border-slate-100 text-xs">
                  <div className="flex items-center gap-1">
                    <button type="button" disabled={idx === 0} onClick={() => move(idx, -1)} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20" title="Move left">◀</button>
                    <button type="button" disabled={idx === values.length - 1} onClick={() => move(idx, 1)} className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-20" title="Move right">▶</button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {idx !== 0 && (
                      <button type="button" onClick={() => setPrimary(idx)} className="text-[10px] text-[#B88900] font-semibold hover:underline" title="Make Primary">Main</button>
                    )}
                    <button type="button" onClick={() => removeAt(idx)} className="text-red-500 hover:text-red-700 p-0.5" title="Remove image">✕</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pending selection */}
      {pending.length > 0 && (
        <div className="rounded-xl border-2 border-amber-400 bg-amber-50/40 p-3 space-y-2.5">
          <p className="text-xs font-semibold text-amber-900">
            {pending.length} file(s) selected — preview below, not uploaded yet.
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {pending.map((p, idx) => (
              <div key={idx} className="relative rounded-lg overflow-hidden border border-amber-200 bg-white">
                <div className="aspect-[4/3]"><img src={p.preview} alt="" className="w-full h-full object-cover" /></div>
                <button type="button" onClick={() => removePending(idx)} disabled={uploading} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] grid place-items-center" title="Remove">✕</button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={uploadAll} disabled={uploading} className="adm-btn adm-btn-gold text-xs py-1.5 px-3 flex-1 disabled:opacity-60">
              {uploading ? `Uploading ${progress}%…` : `⬆ Upload ${pending.length} to ImgBB`}
            </button>
            <button type="button" onClick={() => { pending.forEach((p) => URL.revokeObjectURL(p.preview)); setPending([]); }} disabled={uploading} className="adm-btn adm-btn-line text-xs py-1.5 px-3">Clear</button>
          </div>
          {uploading && (
            <div className="w-full bg-white rounded-full h-1.5 overflow-hidden border border-amber-200">
              <div className="bg-amber-500 h-1.5 transition-all duration-200" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
      )}

      {/* Add box */}
      <div
        onClick={() => inputRef.current?.click()}
        className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg hover:border-amber-500 bg-white hover:bg-amber-50/20 cursor-pointer transition p-3 text-center"
      >
        <input ref={inputRef} type="file" multiple accept={ACCEPT_ATTR} className="hidden" onChange={pickFiles} disabled={uploading} />
        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className="text-xs font-semibold text-slate-700">Select images from device / camera</span>
        <span className="text-[11px] text-slate-400">JPG · JPEG · PNG · WEBP · ≤10 MB each</span>
      </div>

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      {success && <p className="text-xs font-medium text-emerald-700">{success}</p>}
      <p className="text-[11px] text-slate-400">Group: <code className="font-mono">/{folder}</code> · Hosted on ImgBB · URLs save to Firestore when you press Save.</p>
    </div>
  );
}
