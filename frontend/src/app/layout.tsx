import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "../context/ThemeContext";

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
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
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
            `,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[#F5F2EB] text-[#26231F] flex flex-col selection:bg-[#F5E7DE] selection:text-[#C66A43]"
      >
        <ThemeProvider>
          <div className="flex-1 flex flex-col">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}
