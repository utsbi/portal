import Image from "next/image";
import Link from "next/link";
import group from "@/assets/images/group.jpg";
import Background from "@/components/v2/background";
import { urbanist } from "@/utils/fonts";

export default function V2Page() {
	return (
		<div className={`${urbanist.className}`}>
			{/* Main section */}
			<section className="relative h-screen w-full">
				<div
					className="absolute text-white top-1/2 left-1/2 sm:left-[40%] -translate-x-1/2 -translate-y-1/2 animate-title z-10"
					style={{ pointerEvents: "none" }}
				>
					<div
						className="text-6xl sm:text-7xl"
						style={{ pointerEvents: "auto" }}
					>
						<span className="text-green-500">S</span>ustainable
					</div>
					<div
						className="text-6xl sm:text-7xl"
						style={{ pointerEvents: "auto" }}
					>
						<span className="text-green-500">B</span>uilding
					</div>
					<div
						className="text-6xl sm:text-7xl"
						style={{ pointerEvents: "auto" }}
					>
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
						<Link
							href="https://utsbi.org"
							className="mb-3 sm:mb-0"
							target="_blank"
							rel="noopener"
						>
							<button
								type="button"
								className="bg-green-500 hover:bg-transparent text-white-700 hover:text-white transition duration-300 py-2 px-6 border border-green-500 hover:border-green-500 rounded"
							>
								Join Us
							</button>
						</Link>
						<Link href="/about">
							<button
								type="button"
								className="bg-transparent hover:bg-green-500 text-white-700 hover:text-white transition duration-300 py-2 px-6 border border-green-500 hover:border-transparent rounded"
							>
								What We're About
							</button>
						</Link>
					</div>
				</div>
				<div className="brightness-50">
					<Background />
				</div>
			</section>

			{/* Departments section */}
			<section className="relative z-20 bg-white min-h-screen">
				<div className="max-w-7xl mx-auto flex flex-row gap-4 min-h-screen">
					<div className="w-1/3 bg-gray-100 p-4">hi</div>
					<div className="w-2/3 bg-gray-100 p-4">hi</div>
				</div>
			</section>
		</div>
	);
}
