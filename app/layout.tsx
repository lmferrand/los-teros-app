import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ThemeProvider from "./components/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://app.extraccionesteros.es";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Los Teros — Control financiero",
  description: "Control de ventas, cobros, facturación, IVA y márgenes — Extracciones Teros",
  icons: { icon: "/logo.png", apple: "/logo.png" },
  openGraph: {
    title: "Los Teros — Control financiero",
    description: "Control de ventas, cobros, facturación, IVA y márgenes",
    url: siteUrl,
    siteName: "Los Teros",
    images: [{ url: "/logo.png", width: 500, height: 500, alt: "Los Teros" }],
    locale: "es_ES",
    type: "website",
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
              var tema = localStorage.getItem('tema') === 'dark' ? 'dark' : 'light';
              var bg = tema === 'dark' ? '#0b1220' : '#f5f7fa';
              root.setAttribute('data-theme', tema);
              if (tema === 'dark') root.classList.add('dark');
              else root.classList.remove('dark');
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
      <body className="min-h-full">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
