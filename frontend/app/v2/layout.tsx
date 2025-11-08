// import Footer from "@/components/Footer";

import Navbar from "@/components/v2/navbar";
import { urbanist } from "@/utils/fonts";

export default function StaticLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className={`${urbanist.className} scrollbar`}>
			<Navbar />
			{children}
			{/* <Footer /> */}
		</div>
	);
}
