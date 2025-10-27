import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

export default function Custom404() {
	return (
		<>
			<Navbar />
			<div className="w-full h-screen flex justify-center items-center text-2xl">
				<div className="flex flex-col justify-center items-center gap-2">
					<div className="text-9xl">404</div>
					<h1>This page does not exist :(</h1>
				</div>
			</div>
			<Footer />
		</>
	);
}
