/**
 * POST /api/upload-image
 *
 * Secure server-side image upload endpoint.
 * The Admin Panel sends the selected image here; this route forwards it
 * to the ImgBB API using the server-only IMGBB_API_KEY and returns the
 * hosted image URLs. The API key is NEVER exposed to the browser.
 *
 * Request: multipart/form-data with field "image" (File) + optional "name".
 * Response: { success: true, url, display_url } on success.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

// 10 MB server-side cap (ImgBB supports up to 32 MB, but large uploads
// risk timeouts on serverless platforms).
const MAX_BYTES = 10 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const apiKey = process.env.IMGBB_API_KEY;

  if (!apiKey || !apiKey.trim()) {
    return json(
      {
        success: false,
        error:
          "Image hosting is not configured on the server (missing IMGBB_API_KEY). Please ask the developer to set the IMGBB_API_KEY environment variable, then try again.",
        code: "IMGBB_KEY_MISSING",
      },
      500
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ success: false, error: "No image received. Please select a file and try again.", code: "NO_FILE" }, 400);
  }

  const file = form.get("image");
  const nameHint = String(form.get("name") || "").slice(0, 80);

  if (!file || !(file instanceof File) || file.size === 0) {
    return json({ success: false, error: "No image selected. Please choose an image first.", code: "NO_FILE" }, 400);
  }

  const mime = (file.type || "").toLowerCase();
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const mimeOk = ALLOWED_MIME.has(mime) || (mime === "" && ["jpg", "jpeg", "png", "webp"].includes(ext));
  if (!mimeOk) {
    return json(
      {
        success: false,
        error: `Unsupported image format "${file.type || ext || "unknown"}". Accepted formats: JPG, JPEG, PNG, WEBP.`,
        code: "INVALID_TYPE",
      },
      400
    );
  }

  if (file.size > MAX_BYTES) {
    return json(
      {
        success: false,
        error: `Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 10 MB.`,
        code: "FILE_TOO_LARGE",
      },
      400
    );
  }

  // Convert to base64 for the ImgBB API (server-side only).
  let base64: string;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    base64 = buf.toString("base64");
  } catch (e: any) {
    return json({ success: false, error: "Could not read the image file. Please try a different file.", code: "READ_FAILED" }, 400);
  }

  // Forward to ImgBB. Key stays on the server.
  const params = new URLSearchParams();
  params.set("key", apiKey.trim());
  params.set("image", base64);
  if (nameHint) params.set("name", nameHint);

  let imgbbRes: Response;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 60000);
    imgbbRes = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
  } catch (e: any) {
    const timedOut = e?.name === "AbortError";
    return json(
      {
        success: false,
        error: timedOut
          ? "Image upload timed out. Please check your connection and try again."
          : "Network error while contacting the image host. Please try again.",
        code: "NETWORK_ERROR",
      },
      502
    );
  }

  let payload: any = null;
  try {
    payload = await imgbbRes.json();
  } catch {
    // fall through to error handling below
  }

  if (!imgbbRes.ok || !payload?.success || !payload?.data?.url) {
    const msg =
      payload?.error?.message ||
      (imgbbRes.status === 400
        ? "ImgBB rejected the image (it may be corrupt or an unsupported variant)."
        : imgbbRes.status === 401 || imgbbRes.status === 403
        ? "ImgBB API key was rejected. Please ask the developer to verify IMGBB_API_KEY."
        : `ImgBB upload failed (HTTP ${imgbbRes.status}). Please try again.`);
    return json({ success: false, error: msg, code: "IMGBB_ERROR" }, 502);
  }

  const data = payload.data;
  return json({
    success: true,
    url: data.display_url || data.url,
    display_url: data.display_url || data.url,
    // NOTE: delete_url is intentionally NOT returned to the browser.
    // ImgBB delete links stay server-side so hosted images can't be
    // removed by anyone holding a Firestore read — references stay valid.
  });
}
