import type { Metadata } from "next";
import { Figtree, Syne, IBM_Plex_Mono } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { ToastProvider } from "@/components/Toast";
import { SelectionProvider } from "@/lib/selection";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["600", "700", "800"],
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono-google",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Palworld Server Manager",
  description: "Manage remote Palworld servers over Tailscale",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${syne.variable} ${figtree.variable} ${mono.variable}`}
        style={
          {
            ["--font-display" as string]: "var(--font-syne), sans-serif",
            ["--font-body" as string]: "var(--font-figtree), sans-serif",
            ["--font-mono" as string]: "var(--font-mono-google), monospace",
          } as React.CSSProperties
        }
      >
        <SelectionProvider>
          <ToastProvider>
            <AppShell>{children}</AppShell>
          </ToastProvider>
        </SelectionProvider>
      </body>
    </html>
  );
}
