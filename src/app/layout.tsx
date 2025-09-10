// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

// Juster import-sti om nødvendig:
import Navbar from "@/components/Navbar"; // ev. "../components/Navbar" eller "@/components/navbar"

export const metadata: Metadata = {
  title: "TreningsApp",
  description: "Oversikt over dine treningsøkter",
};

// TEMP: slå av Google Fonts for å unngå build-time fetch/timeout
// (holder CSS-variablene tomme så klassen i <body> fortsatt fungerer)
const geistSans = { variable: "" } as { variable: string };
const geistMono = { variable: "" } as { variable: string };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Navbar />
        <div className="max-w-5xl mx-auto p-6">{children}</div>
      </body>
    </html>
  );
}



