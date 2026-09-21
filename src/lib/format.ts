/* Pure helpers — safe to import from client components (no DB deps) */
export function inr(n: number | null | undefined) {
  return "₹" + (n ?? 0).toLocaleString("en-IN");
}
export const inrA = inr;
export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}
export function discountPct(mrp: number | null | undefined, price: number) {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}
export function waLink(number: string, message: string) {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
export function parseYouTubeId(url: string): string | null {
  if (!url) return null;
  const m =
    url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/))([\w-]{6,20})/) ||
    url.match(/^([\w-]{11})$/);
  return m ? m[1] : null;
}
