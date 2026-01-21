import {
  ColorSchemeScript,
  createTheme,
  MantineProvider,
  mantineHtmlProps,
} from "@mantine/core";
import "@/app/globals.css";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Old_Standard_TT, Urbanist } from "next/font/google";
import faviconLight from "@/assets/favicons/favicon.ico";
import faviconDark from "@/assets/favicons/favicon-light.ico";
import { ThemeProvider } from "@/components/theme-provider";

const oldStandardTT = Old_Standard_TT({
  weight: ["400", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-old-standard",
});

const urbanist = Urbanist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-urbanist",
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

const theme = createTheme({
  primaryColor: "green",
});

// Temporary fix for something trying to access localStorage during SSR
// if (!globalThis.localStorage.getItem)
// 	globalThis.localStorage = undefined as never;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      {...mantineHtmlProps}
      suppressHydrationWarning
      className={`${urbanist.variable} ${oldStandardTT.variable}`}
    >
      <head>
        <ColorSchemeScript />
      </head>
      <body className="scrollbar font-urbanist">
        <MantineProvider theme={theme}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </MantineProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
