import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import ME from "@/assets/images/about/shitty.jpg";
import Code from "@/assets/images/about/code.jpg";
import Lacrosse from "@/assets/images/about/outside.jpeg";
import Library from "@/assets/images/about/game.jpg";

export const metadata: Metadata = {
	title: "About Me",
	description: "Learn more about Mason Hallmark",
};

const images = [
	{
		img: Code,
		href: "https://github.com/",
		caption: "Building innovative software and solving complex problems.",
	},
	{
		img: Lacrosse,
		href: "https://quwhack.itch.io/touch-grass-simulator",
		caption: "Touching Grass.",
	},
	{
		img: Library,
		href: "https://store.steampowered.com/app/1030300/Hollow_Knight_Silksong/",
		caption: "Enjoying playing games. Not Touching Grass.",
	},
];

export default function AboutMe() {
	return (
		<>
			{/* Introduction Section */}
			<section className="px-6 py-16 pt-36 md:px-32 2xl:px-80 font-OldStandardTT">
				<div className="text-4xl font-semibold mb-8">About Me</div>

				<div className="text-lg leading-relaxed space-y-6">
					<p>
						Hello! My name is{" "}
						<span className="font-semibold text-orange-700">Mason Hallmark</span>,
						a <span className="font-semibold">Computer Science major</span> at
						the <span className="font-semibold">University of Texas at Austin</span>.
						I’m passionate about building impactful software and exploring how
						technology can create real-world change.
					</p>
					<p>
						Outside of academics, I love to{" "}
						<span className="font-semibold">travel</span>,{" "}
						<span className="font-semibold">bowl</span>, and play{" "}
						<span className="font-semibold">soccer</span> and{" "}
						<span className="font-semibold">lacrosse</span>. I also enjoy{" "}
						<span className="font-semibold">hiking</span> scenic trails and
						spending time outdoors. When I’m relaxing, you’ll often find me
						playing <span className="font-semibold">video games</span> or exploring
						new tech projects just for fun.
					</p>
				</div>

				{/* Profile Section */}
				<div className="mt-12 flex flex-col md:flex-row items-center justify-between gap-8">
					<div className="text-center md:text-left space-y-4">
						<h2 className="text-3xl font-bold">Mason Hallmark</h2>
						<p className="text-xl text-gray-600">B.S. Computer Science</p>
						<Link
							href="mailto:masonhallmark@utexas.edu"
							className="inline-block bg-orange-600 text-white px-5 py-2 rounded-lg hover:bg-orange-700 transition"
						>
							Email Me
						</Link>
					</div>

					<Image
						src={ME}
						alt="Mason"
						className="w-48 h-auto md:w-64 rounded-lg shadow-md"
						priority
					/>
				</div>
			</section>

			{/* Image Gallery Section */}
			<section className="px-6 py-10 md:px-32 2xl:px-80">
				<div className="text-3xl font-semibold text-center mb-10">Highlights</div>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-10">
					{images.map((item) => (
						<div
							key={item.href}
							className="flex flex-col items-center text-center space-y-3"
						>
							<Link
								href={item.href}
								target="_blank"
								rel="noopener noreferrer"
								className="hover:opacity-90 transition"
							>
								<Image
									src={item.img}
									alt={item.caption}
									className="w-full rounded-xl shadow-lg"
									priority
								/>
							</Link>
							<p className="text-sm text-gray-700">{item.caption}</p>
						</div>
					))}
				</div>
			</section>
		</>
	);
}
