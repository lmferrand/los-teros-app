import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ThemeProvider from "./components/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Los Teros — Gestion Operativa",
  description: "App de gestion para Los Teros",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var tema = localStorage.getItem('tema') || 'dark';
              var vars = tema === 'light' ? {
                '--bg': '#f1f5f9',
                '--bg-card': '#ffffff',
                '--border': '#e2e8f0',
                '--text': '#0f172a',
                '--text-muted': '#64748b',
                '--text-subtle': '#94a3b8',
              } : {
                '--bg': '#080b14',
                '--bg-card': '#0d1117',
                '--border': '#1e2d3d',
                '--text': '#e2e8f0',
                '--text-muted': '#475569',
                '--text-subtle': '#334155',
              };
              var root = document.documentElement;
              Object.keys(vars).forEach(function(key) {
                root.style.setProperty(key, vars[key]);
              });
              if (tema === 'light') root.classList.add('light');
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}