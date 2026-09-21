"use client";
import { ProductsEditor } from "@/admin/products-editor";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductsEditor id={id} />;
}
