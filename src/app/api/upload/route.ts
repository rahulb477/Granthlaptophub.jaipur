/**
 * DEPRECATED — local disk uploads were removed.
 * All CMS images must use POST /api/upload-image (ImgBB) so the customer
 * website receives real hosted URLs instead of local /uploads/* paths.
 */
export const dynamic = "force-dynamic";

export async function POST() {
  return Response.json(
    {
      success: false,
      error:
        "This upload endpoint is deprecated. Images must be uploaded via POST /api/upload-image (ImgBB).",
      code: "DEPRECATED",
    },
    { status: 410 }
  );
}
