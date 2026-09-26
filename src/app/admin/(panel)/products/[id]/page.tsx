import { ProductsEditor } from "@/admin/products-editor";

// Server component: awaits `params` (client components may not be async)
// and hands the id to the client-side editor.
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductsEditor id={id} />;
}
