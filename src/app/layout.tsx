import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar } from "@/components/app-sidebar";
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
  title: "Relay — Hiring Execution",
  description:
    "The execution layer above your ATS: every candidate has a next action, an owner, and a due date.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background font-sans text-foreground">
        <div className="flex min-h-screen">
          <AppSidebar />
          <main className="min-w-0 flex-1 md:pl-56">
            <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">{children}</div>
          </main>
        </div>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
