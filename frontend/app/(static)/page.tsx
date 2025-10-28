import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import background from "@/assets/images/background.png";
import group from "@/assets/images/group.jpg";

const FORMS_LINK = "https://forms.gle/KWJjaXGYt2dv3bY68";

export const metadata: Metadata = {
	title: "Home",
};

export default function HomePage() {
	return (
		<>
			{/* Front page */}
			<section>
				<div className="relative inline-block w-full">
					<div
						className="absolute text-white font-OldStandardTT top-1/2 left-1/2 sm:left-[40%] -translate-x-1/2 -translate-y-1/2 animate-title z-10"
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
							<a href={FORMS_LINK} className="mb-3 sm:mb-0" target="_blank">
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
						src={background}
						loading="eager"
						alt="Background"
						className="block object-cover h-screen w-full"
						priority
						sizes="100vw"
						style={{ zIndex: 0 }}
					/>
				</div>
			</section>
			{/* Mission Statement */}
			<section className="px-6 py-10 md:px-32 2xl:px-80 relative font-OldStandardTT">
				<div className="text-left">
					<div className="text-2xl sm:text-3xl">Our Mission Statement</div>
					<div className="pt-3 italic text-lg">
						"We are committed to transforming ambitious ideas into tangible
						realities by uniting talented students from across all disciplines.
						Our mission is to execute professional-grade sustainable building
						projects that address the specific needs of our clients and
						community. We cultivate an environment of intense collaboration and
						real-world problem-solving, developing our members into skilled,
						confident leaders."
					</div>
				</div>
				<hr className="h-px mt-20 bg-gray-200 border-0" />
			</section>
			{/* Strategy */}
			<section className="px-6 py-10 md:px-32 2xl:px-80 relative font-OldStandardTT">
				<div className="text-2xl sm:text-3xl pb-2">Our Strategy</div>
				<div className="flex flex-col md:flex-row justify-between space-y-4 md:space-y-0 md:space-x-8">
					<div className="flex-1 mb-3 sm:mb-0">
						<div className="text-xl">Identify the Opportunity</div>
						<div>
							We assess infrastructure challenges to find opportunities where
							sustainable design can deliver the greatest impact for our clients
							and community.
						</div>
					</div>
					<div className="flex-1 mb-3 sm:mb-0">
						<div className="text-xl">Architect the Solution</div>
						<div>
							Our teams fuse client vision with cutting-edge, sustainable
							practices to design practical, personalized solutions and
							construct an actionable plan.
						</div>
					</div>
					<div className="flex-1 mb-3 sm:mb-0">
						<div className="text-xl">Execute the Solution</div>
						<div>
							We take a hands-on approach to implementation, navigating
							challenges to deliver projects on time and to the highest
							professional standard.
						</div>
					</div>
				</div>
			</section>
			{/* Statistics */}
			<section className="px-6 py-10 md:px-32 2xl:px-80 relative font-OldStandardTT">
				<div className="text-2xl sm:text-3xl pb-2">Our Stats</div>
				<div className="flex flex-col md:flex-row justify-between space-y-4 md:space-y-0 md:space-x-8">
					<div className="flex-1 mb-3 sm:mb-0">
						<div className="text-xl">
							$25M<span className="text-sm">+</span> Project Portfolio
						</div>
						<div>
							The total value of a diverse portfolio of projects we have
							consulted on, delivering professional-grade sustainable solutions.
						</div>
					</div>
					<div className="flex-1 mb-3 sm:mb-0">
						<div className="text-xl">
							50<span className="text-sm">+</span> Student Members
						</div>
						<div>
							A multidisciplinary team from business, engineering, liberal arts,
							and technology, operating as a single, innovative consultancy.
						</div>
					</div>
					<div className="flex-1 mb-3 sm:mb-0">
						<div className="text-xl">
							1,000<span className="text-sm">+</span> Hours Volunteered
						</div>
						<div>
							Our members dedicate their expertise to craft innovative designs
							that serve our community and push the boundaries of
							sustainability.
						</div>
					</div>
				</div>
				<hr className="h-px mt-20 bg-gray-200 border-0" />
			</section>
			{/* Call to action */}
			<section className="px-6 py-10 md:px-32 2xl:px-80 relative">
				<div className="flex justify-center items-center">
					<div className="absolute inset-0 flex flex-col justify-center items-center text-white font-OldStandardTT z-10 text-center p-5 md:p-32">
						<div className="text-2xl sm:text-4xl py-3">Join Our Team</div>
						<div className="text-base sm:text-xl text-center px-4">
							Your Journey to Sustainable Impact Begins Here -{" "}
							<span className="italic">Learn, Build, Lead</span>
						</div>
						<div className="pt-8">
							<Link href={FORMS_LINK} target="_blank">
								<button
									type="button"
									className="bg-green-500 hover:bg-transparent text-white-700 hover:text-white transition duration-300 text-base sm:text-xl pt-4 pb-3 px-6 border border-green-500 hover:border-green-500 rounded"
								>
									Apply Now
								</button>
							</Link>
						</div>
					</div>
					<Image
						src={group}
						loading="lazy"
						alt="Professional group"
						className="rounded-xl object-cover brightness-50 h-96 w-full"
						style={{ zIndex: 0 }}
					/>
				</div>
			</section>
		</>
	);
}
