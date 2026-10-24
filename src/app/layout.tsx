import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Movie Time · Cartelera de Costa Rica",
  description: "Películas, cines y horarios de Costa Rica en un solo lugar.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#101113", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}