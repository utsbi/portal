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
    default: "Home",
    template: "%s",
  },
  description:
    "Sustainable Building Initiative - Research Driven, Professionally Inspired, and Student Powered",
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
