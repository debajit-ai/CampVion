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
  title: "CampVion | Intelligent Campus Operations",
  description:
    "CampVion — Intelligent Campus Operations & Autonomous Agentic AI Assistant for Multi-Step Campus Service Workflows",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen bg-[#F5F2EB] text-[#26231F] flex flex-col selection:bg-[#F5E7DE] selection:text-[#C66A43]">
        <div className="flex-1 flex flex-col">{children}</div>
      </body>
    </html>
  );
}
