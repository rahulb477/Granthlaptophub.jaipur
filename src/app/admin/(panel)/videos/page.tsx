"use client";
import React, { useEffect, useState } from "react";
import {
  getVideos,
  saveVideo,
  deleteVideo,
  logActivity,
  FirestoreVideo,
} from "@/lib/firestore-service";
import { ImageUploader } from "@/admin/image-uploader";
import { normalizeInstagramUrl, validateInstagramReelUrl } from "@/lib/storage";
import { useAdminAuth } from "@/lib/firebase-auth";

export default function VideosAdminPage() {
  const { user } = useAdminAuth();
  const [videos, setVideos] = useState<FirestoreVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<(FirestoreVideo & { reelUrl: string }) | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const loadAll = async () => {
    setLoading(true);
    try {
      const data = await getVideos();
      setVideos(data);
    } catch (err: any) {
      setError("Load error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const openNew = () => {
    setEditing({
      title: "",
      description: "",
      reelUrl: "",
      thumbnail: "",
      category: "Reels",
      displayOrder: videos.length + 1,
      active: true,
      published: true,
    });
    setIsNew(true);
    setError("");
    setSuccess("");
  };

  const openEdit = (v: FirestoreVideo) => {
    setEditing({
      ...v,
      reelUrl: v.url || v.videoUrl || v.youtubeUrl || "",
      active: v.active !== false && v.published !== false,
      published: v.published !== false && v.active !== false,
    });
    setIsNew(false);
    setError("");
    setSuccess("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editing.title.trim()) {
      setError("Title is required.");
      return;
    }
    const reelErr = validateInstagramReelUrl(editing.reelUrl);
    if (reelErr) {
      setError(reelErr);
      return;
    }
    if (!editing.thumbnail || !editing.thumbnail.startsWith("http")) {
      setError("Please upload a thumbnail image via the Upload button first — Reel cards need an ImgBB-hosted thumbnail.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const url = normalizeInstagramUrl(editing.reelUrl);
      const payload: Partial<FirestoreVideo> = {
        title: editing.title.trim(),
        description: editing.description || "",
        url,
        videoUrl: url,
        platform: "instagram",
        thumbnail: editing.thumbnail,
        category: editing.category || "Reels",
        displayOrder: Number(editing.displayOrder) || 0,
        active: editing.active !== false,
        published: editing.published !== false,
      };
      const savedDoc = await saveVideo(payload, isNew ? undefined : editing.id);
      logActivity({
        adminId: user?.uid,
        adminName: user?.email ?? "admin",
        action: isNew ? "create" : "update",
        entity: "videos",
        entityId: savedDoc.id,
        summary: `Instagram Reel ${isNew ? "added" : "updated"}: ${payload.title}`,
      });
      setSuccess(`Reel "${editing.title}" saved successfully to Firestore.`);
      setTimeout(() => setSuccess(""), 3500);
      setEditing(null);
      loadAll();
    } catch (err: any) {
      console.error("Save video error:", err);
      setError("Failed to save Reel: " + (err?.message || "unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (v: FirestoreVideo) => {
    if (!v.id) return;
    if (!confirm(`Delete Reel "${v.title}" from Firestore? (The ImgBB thumbnail stays hosted; only this card is removed.)`)) return;
    try {
      await deleteVideo(v.id);
      setVideos((prev) => prev.filter((x) => x.id !== v.id));
      setSuccess(`Reel "${v.title}" deleted.`);
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B88900]">Granth Laptop Hub</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">Instagram Reels & Videos</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Firestore <code className="text-slate-700">/videos</code> · Each card = Instagram Reel link + ImgBB-hosted thumbnail. No video files are uploaded.
          </p>
        </div>

        <button onClick={openNew} className="adm-btn adm-btn-gold text-xs py-2 px-3.5 shadow-sm">
          + Add Instagram Reel
        </button>
      </div>

      {success && <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold">✓ {success}</div>}
      {error && !editing && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">{error}</div>}

      <div className="adm-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading Reels from Firestore...</div>
        ) : videos.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No Reels found. Click “+ Add Instagram Reel” to create the first card.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Thumbnail</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Instagram Reel URL</th>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {videos.map((v) => {
                  const link = v.url || v.videoUrl || v.youtubeUrl || "";
                  const active = v.active !== false && v.published !== false;
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5">
                        <div className="w-16 h-10 rounded bg-slate-900 overflow-hidden border border-slate-200">
                          {v.thumbnail ? <img src={v.thumbnail} alt="" className="w-full h-full object-cover" /> : null}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-bold text-slate-900">{v.title}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-pink-700 truncate max-w-[220px]">
                        {link ? (
                          <a href={link} target="_blank" rel="noreferrer" className="hover:underline" title={link}>
                            {link.replace("https://www.", "").slice(0, 42)}…
                          </a>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{v.displayOrder ?? 0}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${active ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                          {active ? "Published" : "Hidden"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => openEdit(v)} className="px-2.5 py-1 rounded bg-slate-100 hover:bg-amber-100 text-slate-700 font-semibold">
                            Edit
                          </button>
                          <button onClick={() => handleDelete(v)} className="px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 font-semibold">
                            Delete
                          </button>
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

      <div className="adm-card p-4 text-[12px] text-slate-500">
        <strong>How Reel cards work on the customer website:</strong> thumbnail + title render from this Firestore document;
        tapping the card opens the stored Instagram Reel URL in a new tab. Thumbnails are hosted on ImgBB — Instagram videos are never downloaded or re-hosted.
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">{isNew ? "Add Instagram Reel" : "Edit Reel"}</h2>
              <button onClick={() => setEditing(null)} className="text-slate-400 font-bold text-lg">✕</button>
            </div>
            {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">{error}</div>}
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Title <span className="text-red-500">*</span></label>
                <input type="text" required value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="e.g. Gaming Laptop Unboxing" className="adm-input text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Instagram Reel URL <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={editing.reelUrl}
                  onChange={(e) => setEditing({ ...editing, reelUrl: e.target.value })}
                  placeholder="https://www.instagram.com/reel/XXXXXXXX/"
                  className="adm-input text-xs font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">Paste the Reel link from Instagram → Share → Copy link. Must contain <code>/reel/</code>. Never a video file.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description (optional)</label>
                <textarea rows={2} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Short caption shown under the card…" className="adm-input text-xs" />
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <ImageUploader
                  value={editing.thumbnail || ""}
                  onChange={(url) => setEditing({ ...editing, thumbnail: url })}
                  folder="videos"
                  label="Reel Thumbnail (ImgBB upload)"
                  hint="Select → preview → Upload to ImgBB. This thumbnail is what customers see on the website."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Display Order</label>
                  <input type="number" value={editing.displayOrder || 0} onChange={(e) => setEditing({ ...editing, displayOrder: Number(e.target.value) })} className="adm-input text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category Label</label>
                  <input type="text" value={editing.category || "Reels"} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="adm-input text-xs" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={editing.active !== false && editing.published !== false}
                  onChange={(e) => setEditing({ ...editing, active: e.target.checked, published: e.target.checked })}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>Active / Published on customer website</span>
              </label>
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setEditing(null)} className="adm-btn adm-btn-line text-xs py-2 px-3">Cancel</button>
                <button type="submit" disabled={saving} className="adm-btn adm-btn-gold text-xs py-2 px-4 font-bold">{saving ? "Saving…" : "Save Reel"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
