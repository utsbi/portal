// Import styles of packages that you've installed.
// All packages except `@mantine/hooks` require styles imports
import "@mantine/core/styles.css";
import "./globals.css";

import { Old_Standard_TT } from "next/font/google";

import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

import {
  ColorSchemeScript,
  createTheme,
  mantineHtmlProps,
  MantineProvider,
} from "@mantine/core";

export const metadata = {
  title: "Home",
  description: "SBI Portal app for team members and clients",
};

const oldStandardTT = Old_Standard_TT({
  weight: ["400", "700"],
  subsets: ["latin"],
});

const theme = createTheme({
  primaryColor: "green",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript />
      </head>
      <body className={`${oldStandardTT.className} scrollbar`}>
        <Navbar />
        <MantineProvider theme={theme}>{children}</MantineProvider>
        <Footer />
      </body>
    </html>
  );
}
