import type { Metadata } from "next";
import Script from "next/script";
import { Fira_Code, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const fira = Fira_Code({
  variable: "--font-sfmono",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "SPPK Mitigasi Banjir & Longsor Jawa Timur",
  description:
    "Sistem pendukung keputusan AHP-TOPSIS untuk prioritas wilayah mitigasi banjir dan tanah longsor di Jawa Timur.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/logo.png", type: "image/png" },
    ],
    apple: { url: "/logo.png" },
  },
};

const themeScript = `(function(){try{var t=localStorage.getItem("sppk-theme");if(t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${inter.variable} ${jetbrains.variable} ${fira.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-cloud-canvas font-sans text-slate-ink">
        <Script id="sppk-theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
