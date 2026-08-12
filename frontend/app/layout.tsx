import "@/app/globals.css";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { JetBrains_Mono, Urbanist } from "next/font/google";
import { headers } from "next/headers";
import { connection } from "next/server";
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
        type: "image/x-icon",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: faviconDark.src,
        type: "image/x-icon",
        media: "(prefers-color-scheme: dark)",
      },
    ],
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // A request-specific CSP nonce is attached by proxy.ts. Waiting for the
  // request opts every route into dynamic rendering so Next can apply it.
  await connection();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${urbanist.variable} ${jetbrainsMono.variable}`}
    >
      <body className="scrollbar font-urbanist">
        <ThemeProvider
          nonce={nonce}
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
