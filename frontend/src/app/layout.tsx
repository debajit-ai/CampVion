import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "../context/ThemeContext";
import { AuthProvider } from "../context/AuthContext";

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
  icons: {
    icon: "/brand/campvion-symbol.png",
    shortcut: "/brand/campvion-symbol.png",
    apple: "/brand/campvion-symbol.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-cv-canvas text-cv-fg flex flex-col selection:bg-cv-accent selection:text-cv-on-accent overflow-x-hidden max-w-full"
      >
        <Script id="campvion-theme-init" strategy="beforeInteractive">
          {`
            (function() {
              try {
                var savedTheme = localStorage.getItem('campvion_theme') || 'system';
                var isDark = savedTheme === 'dark' || (savedTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                var root = document.documentElement;
                root.setAttribute('data-theme', isDark ? 'dark' : 'light');
                if (isDark) {
                  root.classList.add('dark');
                } else {
                  root.classList.remove('dark');
                }
                var savedMotion = localStorage.getItem('campvion_reduced_motion');
                if (savedMotion === 'true') {
                  root.setAttribute('data-reduced-motion', 'true');
                }
                var savedContrast = localStorage.getItem('campvion_high_contrast');
                if (savedContrast === 'true') {
                  root.setAttribute('data-high-contrast', 'true');
                }
              } catch(e) {}
            })();
          `}
        </Script>
        <ThemeProvider>
          <AuthProvider>
            <div className="flex-1 flex flex-col overflow-x-hidden max-w-full">{children}</div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
