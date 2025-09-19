// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import ThemeProvider from "@/components/ThemeProvider";
import I18nProvider, { type Lang } from "@/lib/i18n/I18nProvider";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "TreningsApp",
  description: "Oversikt over dine treningsøkter",
};

// ✅ Viktig for mobil (iPhone, Android osv.)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Google Fonts via next/font
const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Les valgt språk fra cookie (fall tilbake til 'nb')
  const cookieStore = cookies();
  const lang = (cookieStore.get("lang")?.value as Lang) || "nb";

  return (
    <html lang={lang} suppressHydrationWarning>
      {/* NB: next-themes styrer 'class' på <html> for tema */}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-100`}>
        <ThemeProvider>
          <I18nProvider lang={lang}>
            <Navbar />
            <div className="max-w-5xl mx-auto p-6">{children}</div>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
