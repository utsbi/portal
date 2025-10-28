"use client";

import Image from "next/image";
import Link from "next/link";
import Jackson from "@/assets/images/people/Jackson.jpg";
import Poker from "@/assets/images/Poker.jpg";
import Japan from "@/assets/images/Japan.jpg";
import Basketball from "@/assets/images/BBall.jpg";
import ProfileCard from "@/components/ProfileCard";

const images = [
	{ src: Poker, caption: "Playing poker with friends", href: "https://en.wikipedia.org/wiki/Poker" },
	{ src: Japan, caption: "Trip to Japan", href: "https://www.japan.travel/en/" },
	{ src: Basketball, caption: "Basketball", href: "https://en.wikipedia.org/wiki/Basketball" },
];

const people = [
	{
		name: "Jackson Herleth",
		role: "Electrical and Computer Engineering",
		email: "jackson.herleth@utexas.edu",
		image: Jackson,
	},
];

export default function AboutMe() {
	return (
		<>
			{/* About Me Section */}
			<section className="px-6 py-10 pt-36 md:px-32 2xl:px-80 relative font-OldStandardTT">
				<div>
					<div className="text-4xl">About Me</div>
					<div className="text-xl pt-10 space-y-6">
						<div>
							My name is{" "}
							<span className="font-semibold">Jackson Herleth</span>, and I am a sophomore{" "}
							<span className="font-semibold">Electrical and Computer Engineering</span> major
							at UT Austin, focusing on Computer Architecture and Embedded Systems.
						</div>
						<div>
							My passions outside this class include{" "}
							<span className="font-semibold">playing poker, basketball, and video games</span>{" "}
							with my friends. I also love traveling and recently went to China, Japan, and
							South Korea this summer.
						</div>
						<div>
							I hope to be a <span className="font-semibold">software engineer</span> one day,
							helping build software with innovative solutions that will make change.
						</div>
					</div>
				</div>
			</section>

			{/* Profile Section */}
			<section className="px-6 py-10 pt-12 md:px-32 2xl:px-80 relative font-OldStandardTT">
				<div className="text-4xl">Pictures Relating to Me</div>
				<div className="text-xl pt-10 space-y-6"></div>
				<div className="flex flex-row justify-center items-center">
					{people.map((person) => (
						<div key={person.email} className="w-full md:w-1/3 px-4">
							<ProfileCard {...person} />
						</div>
					))}
				</div>
			</section>

			{/* Pictures Section */}
			<section className="px-6 py-2 md:px-32 2xl:px-80 relative font-OldStandardTT">
				<div className="flex justify-center pt-10 flex-wrap gap-8">
					{images.map((item, index) => (
						<Link
							key={index}
							href={item.href}
							target="_blank"
							rel="noopener noreferrer"
						>
							<div className="flex flex-col items-center">
								<Image
									src={item.src}
									alt={item.caption}
									className="w-80 h-60 object-cover rounded-lg shadow-md hover:scale-105 transition-transform duration-300"
								/>
								<p className="text-center text-lg italic mt-3">{item.caption}</p>
							</div>
						</Link>
					))}
				</div>
			</section>
		</>
	);
}
