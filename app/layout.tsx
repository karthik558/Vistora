import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vistora | Guest experience operations",
  description: "A premium guest feedback and service recovery workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}