import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ThemeProvider from "./components/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://los-teros-app.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Los Teros S.L - Gestion Operativa",
  description: "App de gestion operativa para Los Teros S.L",
  openGraph: {
    title: "Los Teros S.L - Gestion Operativa",
    description: "App de gestion operativa para Los Teros S.L",
    url: siteUrl,
    siteName: "Los Teros S.L",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 1200,
        alt: "Logo Los Teros S.L",
      },
    ],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Los Teros S.L - Gestion Operativa",
    description: "App de gestion operativa para Los Teros S.L",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className={`${inter.variable} h-full antialiased`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
          (function() {
            try {
              var root = document.documentElement;
              root.classList.add('no-theme-transition');
              var tema = localStorage.getItem('tema') === 'light' ? 'light' : 'dark';
              var bg = tema === 'light' ? '#f1f5f9' : '#080b14';
              root.setAttribute('data-theme', tema);
              if (tema === 'light') root.classList.add('light');
              else root.classList.remove('light');
              root.style.backgroundColor = bg;
              if (document.body) {
                document.body.style.backgroundColor = bg;
              } else {
                document.addEventListener('DOMContentLoaded', function() {
                  document.body.style.backgroundColor = bg;
                }, { once: true });
              }
              requestAnimationFrame(function() {
                root.classList.remove('no-theme-transition');
              });
            } catch(e) {}
          })();
        `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
