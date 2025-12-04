import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { oldStandardTT } from "@/utils/fonts";

export default function StaticLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className={`${oldStandardTT.className} scrollbar`}>
			<Navbar />
			{children}
			<Footer />
		</div>
	);
}
