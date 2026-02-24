import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shift Setting Console",
  description: "Monitor staffing, shifts, and activity in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[var(--background)] text-[var(--foreground)]`}
      >
        <div className="min-h-screen bg-[radial-gradient(120%_120%_at_20%_20%,#c5d6ff_0,transparent_55%),radial-gradient(120%_120%_at_80%_0%,#b1cbff_0,transparent_52%),var(--background)]">
          {children}
        </div>
      </body>
    </html>
  );
}
