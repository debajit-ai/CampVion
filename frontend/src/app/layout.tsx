import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "../context/ThemeContext";
import { AuthProvider } from "../context/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://campvion.ai"
  ),
  title: "CampVion AI — Autonomous Campus Operations Platform",
  description:
    "Autonomous campus operations platform uniting natural language intent parsing, deterministic DAG planning, policy verification, and Dean/Warden governance.",
  icons: {
    icon: [
      { url: "/brand/campvion-favicon.svg", type: "image/svg+xml" },
      { url: "/brand/campvion-symbol.png", type: "image/png" },
    ],
    shortcut: "/brand/campvion-favicon.svg",
    apple: "/brand/campvion-symbol.png",
  },
  openGraph: {
    title: "CampVion AI — Autonomous Campus Operations Platform",
    description:
      "Connect students to institutional authorities with natural language intent parsing, deterministic DAG execution, and zero-hallucination policy checks.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CampVion AI — Autonomous Campus Operations Platform",
    description:
      "Deterministic campus workflows with real-time policy verification and human-in-the-loop authority gates.",
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
      className={`${geistSans.variable} ${jetbrainsMono.variable} antialiased`}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-cv-canvas text-cv-fg flex flex-col selection:bg-cv-accent selection:text-cv-on-accent overflow-x-hidden max-w-full"
      >
        <Script id="campvion-theme-init" strategy="beforeInteractive">
          {`
            (function() {
              try {
                var savedTheme = localStorage.getItem('campvion_theme') || localStorage.getItem('campvion_landing_theme') || 'dark';
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
