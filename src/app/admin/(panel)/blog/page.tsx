"use client";
import React, { useEffect, useState } from "react";
import {
  getBlogPosts,
  saveBlogPost,
  deleteBlogPost,
  FirestoreBlogPost,
} from "@/lib/firestore-service";
import { ImageUploader } from "@/admin/image-uploader";
import { logAdminAction } from "@/lib/activity";

export default function BlogAdminPage() {
  const [posts, setPosts] = useState<FirestoreBlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FirestoreBlogPost | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const loadAll = async () => {
    setLoading(true);
    try {
      const data = await getBlogPosts();
      setPosts(data);
    } catch (err: any) {
      setError("Load error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Mount-time load: only starts the module-level Firestore read; state is
  // updated inside the promise callbacks (the pattern accepted by
  // react-hooks/set-state-in-effect). The save/delete handlers use loadAll.
  useEffect(() => {
    let on = true;
    getBlogPosts()
      .then((data) => {
        if (on) setPosts(data);
      })
      .catch((err: any) => {
        if (on) setError("Load error: " + err.message);
      })
      .finally(() => {
        if (on) setLoading(false);
      });
    return () => {
      on = false;
    };
  }, []);

  const openNew = () => {
    setEditing({
      title: "",
      slug: "",
      category: "BUYING GUIDE",
      categoryColor: "green",
      excerpt: "",
      body: "",
      date: new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric" }).toUpperCase(),
      gradient: "from-emerald-100 to-teal-50",
      published: true,
    });
    setIsNew(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.title.trim()) {
      setError("Post title is required.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      const slug =
        editing.slug ||
        editing.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      const bodyContent = typeof editing.body === "string" ? editing.body : Array.isArray(editing.body) ? editing.body.join("\n\n") : "";

      const payload = {
        ...editing,
        slug,
        body: bodyContent,
        published: editing.published !== false,
      };

      const saved = await saveBlogPost(payload, isNew ? undefined : editing.id);
      void logAdminAction({
        action: isNew ? "CREATE" : "UPDATE",
        entity: "Blog Post",
        entityId: saved.id,
        description: `${isNew ? "Published" : "Updated"} blog post "${editing.title}"`,
      });
      setSuccess(`Post "${editing.title}" saved to Firestore.`);
      setTimeout(() => setSuccess(""), 3000);
      setEditing(null);
      loadAll();
    } catch (err: any) {
      setError("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (b: FirestoreBlogPost) => {
    if (!b.id) return;
    if (!confirm(`Delete blog post "${b.title}" from Firestore?`)) return;
    try {
      await deleteBlogPost(b.id);
      void logAdminAction({
        action: "DELETE",
        entity: "Blog Post",
        entityId: b.id,
        description: `Deleted blog post "${b.title}"`,
      });
      setPosts((prev) => prev.filter((x) => x.id !== b.id));
      setSuccess(`Post "${b.title}" deleted.`);
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
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111827]">Tech Tips & Guides (Blog CMS)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manages documents in Firestore <code className="text-slate-700">/blogPosts</code> · Customer website reads with <code className="text-slate-700">where(&quot;published&quot;, &quot;==&quot;, true)</code>
          </p>
        </div>

        <button onClick={openNew} className="adm-btn adm-btn-gold text-xs py-2 px-3.5 shadow-sm">
          + Add New Article
        </button>
      </div>

      {success && <div className="p-3 bg-emerald-50 text-emerald-800 rounded-lg text-xs font-semibold">✓ {success}</div>}
      {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-xs font-semibold">{error}</div>}

      <div className="adm-card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading blog posts from Firestore...</div>
        ) : posts.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400">No blog posts found in Firestore.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {posts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-2.5">
                      <p className="font-bold text-slate-900 max-w-[340px] truncate">{p.title}</p>
                      <p className="text-[11px] text-slate-400 max-w-[340px] truncate">{p.excerpt || "—"}</p>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-slate-700">{p.category}</td>
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-[11px]">{p.date || "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${p.published !== false ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                        {p.published !== false ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => { setEditing({ ...p }); setIsNew(false); }} className="px-2.5 py-1 rounded bg-slate-100 hover:bg-amber-100 text-slate-700 font-semibold">
                          Edit
                        </button>
                        <button onClick={() => handleDelete(p)} className="px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-700 font-semibold">
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">{isNew ? "Write New Article" : `Edit Article`}</h2>
              <button onClick={() => setEditing(null)} className="text-slate-400 font-bold text-lg">✕</button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Title <span className="text-red-500">*</span></label>
                <input type="text" required value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="adm-input text-xs font-bold" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category Label</label>
                  <input type="text" value={editing.category || ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="BUYING GUIDE / HARDWARE" className="adm-input text-xs" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Date Label</label>
                  <input type="text" value={editing.date || ""} onChange={(e) => setEditing({ ...editing, date: e.target.value })} placeholder="e.g. MAR 2025" className="adm-input text-xs" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Excerpt / Summary</label>
                <textarea rows={2} value={editing.excerpt || ""} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} className="adm-input text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Article Body Content</label>
                <textarea rows={6} value={typeof editing.body === "string" ? editing.body : Array.isArray(editing.body) ? editing.body.join("\n\n") : ""} onChange={(e) => setEditing({ ...editing, body: e.target.value })} className="adm-input text-xs" />
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <ImageUploader value={editing.image || ""} onChange={(url) => setEditing({ ...editing, image: url })} folder="blog" label="Article Featured Image" />
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
                <input type="checkbox" checked={editing.published !== false} onChange={(e) => setEditing({ ...editing, published: e.target.checked })} className="rounded text-amber-600 focus:ring-amber-500" />
                <span>Publish Article Live on Customer Website</span>
              </label>
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setEditing(null)} className="adm-btn adm-btn-line text-xs py-2 px-3">Cancel</button>
                <button type="submit" disabled={saving} className="adm-btn adm-btn-gold text-xs py-2 px-4 font-bold">{saving ? "Saving..." : "Save Article"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
