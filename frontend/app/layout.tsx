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

export const metadata = {
	title: "Home",
	description: "SBI Portal app for team members and clients",
};

const oldStandardTT = Old_Standard_TT({
	weight: ["400", "700"],
	subsets: ["latin"],
	display: "swap",
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
