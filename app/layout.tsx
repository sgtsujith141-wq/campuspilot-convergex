import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "CampusPilot — Student Mission Control",
  description: "Controlled demo: a permission-scoped student decision agent with deterministic academic projections.",
};

export const viewport: Viewport = { themeColor: "#F7F8FC", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
