import {
	ColorSchemeScript,
	createTheme,
	MantineProvider,
	mantineHtmlProps,
} from "@mantine/core";
import { oldStandardTT } from "@/utils/fonts";
import "@/app/globals.css";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";

import faviconLight from "@/assets/favicons/favicon.ico";
import faviconDark from "@/assets/favicons/favicon-light.ico";

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
		<html lang="en" {...mantineHtmlProps}>
			<head>
				<ColorSchemeScript />
			</head>
			<body className={`${oldStandardTT.className} scrollbar`}>
				<MantineProvider theme={theme}>{children}</MantineProvider>
				<SpeedInsights />
				<Analytics />
			</body>
		</html>
	);
}
