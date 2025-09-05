import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProviderClient } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fullstack OrderBook",
  description: "A fast, smooth, and readable order book UI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProviderClient>
          <div className="min-h-dvh grid grid-rows-[auto_1fr]">
            <header className="border-b border-border bg-panel backdrop-blur supports-[backdrop-filter]:bg-panel">
              <div className="mx-auto w-full max-w-6xl px-4 py-3 flex items-center justify-between">
                <h1 className="text-sm sm:text-base font-medium tracking-tight">
                  Fullstack OrderBook
                </h1>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-foreground">Theme</span>
                  <ThemeToggle />
                </div>
              </div>
            </header>
            <main className="mx-auto w-full max-w-6xl px-4 py-6">
              {children}
            </main>
          </div>
        </ThemeProviderClient>
      </body>
    </html>
  );
}
