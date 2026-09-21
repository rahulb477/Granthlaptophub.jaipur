import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AdminAuthProvider } from "@/lib/firebase-auth";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Granth Laptop Hub — Admin",
  description: "Granth Laptop Hub Store Management System — Admin Panel & CMS",
  icons: {
    icon: "/brand/granth-logo.png",
    apple: "/brand/granth-logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-slate-50 text-slate-800 antialiased`}>
        <AdminAuthProvider>
          {children}
        </AdminAuthProvider>
      </body>
    </html>
  );
}
