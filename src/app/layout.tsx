import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RGDシステム",
  description: "助成金活用企業研修管理システム",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full">
      <body className="h-full antialiased">{children}</body>
    </html>
  );
}
