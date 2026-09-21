/**
 * Image hosting client — ImgBB via the secure server endpoint.
 *
 * Firebase Storage is NOT used anywhere in this project.
 * All uploads go:  browser → POST /api/upload-image → ImgBB API → URL → Firestore.
 * The IMGBB_API_KEY lives only on the server and is never exposed here.
 */

export interface UploadProgressCallback {
  (progress: number): void;
}

export interface UploadImageResult {
  url: string;
  display_url: string;
}

export const ACCEPTED_IMAGE_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
export const ACCEPTED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // must match /api/upload-image
export const ACCEPT_ATTR = "image/jpeg,image/jpg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

/** Client-side pre-validation (server re-validates — never trust the client alone). */
export function validateImageFile(file: File): string | null {
  if (!file || file.size === 0) return "No image selected. Please choose an image first.";
  const mime = (file.type || "").toLowerCase();
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const ok =
    ACCEPTED_IMAGE_MIME.includes(mime) ||
    (mime === "" && ACCEPTED_IMAGE_EXTENSIONS.includes(ext));
  if (!ok) return `Unsupported format "${file.type || ext || "unknown"}". Accepted: JPG, JPEG, PNG, WEBP.`;
  if (file.size > MAX_IMAGE_BYTES)
    return `Image is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 10 MB.`;
  return null;
}

function fileLabel(file: File) {
  return file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60) || "image";
}

/**
 * Uploads one image through the secure server endpoint and resolves
 * with the ImgBB hosted URL. Uses XHR so real upload progress works.
 */
export function uploadImageViaServer(
  file: File,
  onProgress?: UploadProgressCallback
): Promise<UploadImageResult> {
  return new Promise((resolve, reject) => {
    const preError = validateImageFile(file);
    if (preError) {
      reject(new Error(preError));
      return;
    }

    const fd = new FormData();
    fd.append("image", file, file.name);
    fd.append("name", fileLabel(file));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload-image");
    xhr.timeout = 90000;

    xhr.upload.onprogress = (ev) => {
      if (onProgress && ev.lengthComputable && ev.total > 0) {
        // Upload phase = 0..90%, server processing completes the rest.
        onProgress(Math.min(90, Math.round((ev.loaded / ev.total) * 90)));
      } else if (onProgress) {
        onProgress(50);
      }
    };

    xhr.onload = () => {
      let body: any = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        reject(new Error("Invalid response from the upload server. Please try again."));
        return;
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.success && (body.url || body.display_url)) {
        onProgress?.(100);
        resolve({ url: body.url || body.display_url, display_url: body.display_url || body.url });
      } else {
        reject(new Error(body?.error || `Upload failed (HTTP ${xhr.status}). Please try again.`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload. Please check your connection and try again."));
    xhr.ontimeout = () => reject(new Error("Upload timed out. Please try a smaller image or check your connection."));
    xhr.onabort = () => reject(new Error("Upload was cancelled."));
    onProgress?.(5);
    xhr.send(fd);
  });
}

/**
 * Backwards-compatible wrapper used across the Admin Panel.
 * `folder` is kept as an optional label only;
 * ImgBB hosts the bytes, Firestore stores the URL.
 */
export async function uploadMediaFile(
  _folder: string,
  file: File,
  onProgress?: UploadProgressCallback
): Promise<string> {
  const res = await uploadImageViaServer(file, onProgress);
  return res.url;
}

/** True only for real hosted URLs — never blob:, data:, or local paths. */
export function isHostedImageUrl(url: string) {
  if (!url || typeof url !== "string") return false;
  const u = url.trim().toLowerCase();
  if (!u.startsWith("http://") && !u.startsWith("https://")) return false;
  if (u.startsWith("blob:") || u.startsWith("data:")) return false;
  return true;
}

/** Detects legacy broken values (blob/data/local) that must be replaced via re-upload. */
export function isBrokenImageValue(url: string) {
  if (!url) return false;
  const u = url.trim().toLowerCase();
  return (
    u.startsWith("blob:") ||
    u.startsWith("data:") ||
    u.startsWith("file:") ||
    u.startsWith("/") && !u.startsWith("//")
  );
}

/* ---------------- Instagram Reel URL helpers (videos are links, never file uploads) ---------------- */

export function normalizeInstagramUrl(raw: string) {
  const v = (raw || "").trim();
  if (!v) return "";
  const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withProto);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "instagram.com") return withProto;
    // Normalize to https://www.instagram.com/<path> without query noise.
    const cleanPath = u.pathname.replace(/\/+$/, "");
    return `https://www.instagram.com${cleanPath}/`;
  } catch {
    return withProto;
  }
}

export function validateInstagramReelUrl(raw: string): string | null {
  const v = (raw || "").trim();
  if (!v) return "Instagram Reel URL is required.";
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  } catch {
    return "That doesn't look like a valid URL. Example: https://www.instagram.com/reel/ABC123/";
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "instagram.com") return "URL must be an instagram.com link. Example: https://www.instagram.com/reel/ABC123/";
  if (!u.pathname.toLowerCase().includes("/reel/"))
    return "URL must be an Instagram Reel link (it should contain /reel/). Example: https://www.instagram.com/reel/ABC123/";
  return null;
}
