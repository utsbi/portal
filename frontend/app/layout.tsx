import {
	ColorSchemeScript,
	createTheme,
	MantineProvider,
	mantineHtmlProps,
} from "@mantine/core";
import { Old_Standard_TT } from "next/font/google";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import "./globals.css";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";

import faviconLight from "@/assets/favicons/favicon.ico";
import faviconDark from "@/assets/favicons/favicon-light.ico";

export const metadata: Metadata = {
	title: "Home",
	description: "SBI Portal app for team members and clients",
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

const oldStandardTT = Old_Standard_TT({
	weight: ["400", "700"],
	subsets: ["latin"],
	display: "swap",
});

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
		<html lang="en" {...mantineHtmlProps}>
			<head>
				<ColorSchemeScript />
			</head>
			<body className={`${oldStandardTT.className} scrollbar`}>
				<MantineProvider theme={theme}>
					<Navbar />
					{children}
					<Footer />
				</MantineProvider>
				<SpeedInsights />
				<Analytics />
			</body>
		</html>
	);
}
