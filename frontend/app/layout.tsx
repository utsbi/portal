import "@/app/globals.css";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { JetBrains_Mono, Urbanist } from "next/font/google";
import { Toaster } from "sonner";
import faviconLight from "@/assets/favicons/favicon.ico";
import faviconDark from "@/assets/favicons/favicon-light.ico";
import { ThemeProvider } from "@/components/theme-provider";

const urbanist = Urbanist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-urbanist",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://utsbi.org"),
  title: {
    default: "Sustainable Building Initiative",
    template: "%s | SBI",
  },
  description:
    "Sustainable Building Initiative - Research Driven, Professionally Inspired, and Student Powered. A student-led consultancy at UT Austin delivering professional-grade sustainable building projects.",
  keywords: [
    "sustainable building",
    "green construction",
    "UT Austin",
    "student consultancy",
    "sustainable architecture",
    "eco-friendly design",
    "SBI",
  ],
  authors: [{ name: "Sustainable Building Initiative" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://utsbi.org",
    siteName: "Sustainable Building Initiative",
    title: "Sustainable Building Initiative",
    description:
      "Research Driven. Professionally Inspired. Student Powered. A student-led consultancy delivering professional-grade sustainable building projects.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Sustainable Building Initiative",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Sustainable Building Initiative",
    description:
      "Research Driven. Professionally Inspired. Student Powered. A student-led consultancy at UT Austin.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      {
        url: faviconLight.src,
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: faviconDark.src,
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${urbanist.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/*
          crypto.randomUUID polyfill. The Web Crypto API's randomUUID() is only
          exposed in secure contexts (HTTPS or localhost), so phones hitting
          the dev server over http://<lan-ip> throw "crypto.randomUUID is not a
          function". getRandomValues() has no such restriction — patch the
          missing method with it so every caller (this app and its deps) works.
        */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted inline polyfill, must run before hydration
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var c=window.crypto;if(c&&typeof c.randomUUID!=='function'&&typeof c.getRandomValues==='function'){c.randomUUID=function(){var b=new Uint8Array(16);c.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;var h='';for(var i=0;i<16;i++){h+=(b[i]<16?'0':'')+b[i].toString(16);}return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20,32);};}}catch(e){}})();",
          }}
        />
      </head>
      <body className="scrollbar font-urbanist">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <Toaster
          position="bottom-right"
          expand
          gap={10}
          offset={20}
          visibleToasts={4}
          className="font-urbanist"
          toastOptions={{ unstyled: true, className: "font-urbanist" }}
        />
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
