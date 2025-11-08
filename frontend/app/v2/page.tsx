import Image from "next/image";
import collage from "@/assets/images/collage.png";
import { urbanist } from "@/utils/fonts";

export default function V2Page() {
	return (
		<div className={`${urbanist.className}`}>
			<div
				className="absolute text-white top-1/2 left-1/2 sm:left-[40%] -translate-x-1/2 -translate-y-1/2 animate-title z-10"
				style={{ pointerEvents: "none" }}
			>
				<div className="text-6xl sm:text-7xl" style={{ pointerEvents: "auto" }}>
					<span className="text-green-500">S</span>ustainable
				</div>
				<div className="text-6xl sm:text-7xl" style={{ pointerEvents: "auto" }}>
					<span className="text-green-500">B</span>uilding
				</div>
				<div className="text-6xl sm:text-7xl" style={{ pointerEvents: "auto" }}>
					<span className="text-green-500">I</span>nitiative
				</div>
				<div
					className="pl-1 text-base sm:text-lg"
					style={{ pointerEvents: "auto" }}
				>
					Research Driven, Professionally Inspired, and Student Powered
				</div>
				<div
					className="pl-1 pt-6 flex flex-col sm:flex-row sm:space-x-4"
					style={{ pointerEvents: "auto" }}
				>
					<a
						href="https://"
						className="mb-3 sm:mb-0"
						target="_blank"
						rel="noopener"
					>
						<button
							type="button"
							className="bg-green-500 hover:bg-transparent text-white-700 hover:text-white transition duration-300 pt-3 pb-2 px-6 border border-green-500 hover:border-green-500 rounded"
						>
							Join Us
						</button>
					</a>
					<a href="/about">
						<button
							type="button"
							className="bg-transparent hover:bg-green-500 text-white-700 hover:text-white transition duration-300 pt-3 pb-2 px-6 border border-green-500 hover:border-transparent rounded"
						>
							What We're About
						</button>
					</a>
				</div>
			</div>
			<Image
				src={collage}
				loading="eager"
				alt="Background"
				className="brightness-55 block object-cover h-screen w-full"
				priority
				sizes="100vw"
				style={{ zIndex: 0 }}
			/>
			<div className="block pt-60">content</div>
		</div>
	);
}
