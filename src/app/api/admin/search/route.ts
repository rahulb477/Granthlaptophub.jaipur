import { getSessionUser } from "@/lib/auth";
import { adminGlobalSearch } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = await getSessionUser();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) return Response.json({ results: {} });
  const results = await adminGlobalSearch(q);
  return Response.json({ results });
}
