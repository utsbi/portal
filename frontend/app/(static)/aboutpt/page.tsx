"use client";

import Image from "next/image";
import Link from "next/link";
import ProfileCard from "@/components/ProfileCard";
import Valorant from "@/assets/images/schools/Valorant.png"
import League from "@/assets/images/schools/League2.png"
import Matthew from "@/assets/images/schools/MatthewMaltese.png"

// import ICOL from "@/assets/images/schools/imperial_college_of_london.png";

const images = [
	{ img: Valorant, href: "https://tenor.com/view/xd-gif-12303110809700957130" },
	{ img: League, href: "https://www.leagueoflegends.com/en-us/" },
	{ img: Matthew, href: "https://matt-maltese.com/?srsltid=AfmBOoqStQpJ_FCjRYsk_8k5CcFrymEsg25-qKqQ4G_j1KzkRTrnZcFz" },
	// { img: ICOL, href: "https://www.imperial.ac.uk/" },
];

const people = [
	{
		name: "Paul Tran",
		role: "Tech Team",
		email: "pvt283@my.utexas.edu",
	},
];

export default function About() {
	return (
		<>
			<section className="px-6 py-10 pt-36 md:px-32 2xl:px-80 relative font-OldStandardTT">
				<div>
					<div className="text-4xl">About Us</div>
					<div className="text-xl pt-10 space-y-6">
						<div>
							<span className="font-semibold">
								Howdy!
							</span>{" "}
							My name is Paul Tran, and I'm a freshmen Electrical and Computer Engineering major at UT Austin. 
							I grew up in Arlington, Texas, and enjoy the pretty basic stuff like hanging out with my fam, partying, and playing games. 
							I play a good amount of Valorant and League of Legends, but more recently I've only been studying or hanging out in person.
							My favorite artist is Matt Maltese, who I saw this thursday, along with some others like The Marias and Mac DeMarco. 
						</div>
						<div>
						</div>
					</div>
				</div>
			</section>

			<section className="px-6 py-10 md:px-48 2xl:px-80 relative">
				<div className="flex flex-row justify-center items-center">
					{images.map((item) => (
						<Link
							key={item.href}
							href={item.href}
							target="_blank"
							rel="noopener noreferrer"
						>
							<Image
								src={item.img}
								alt={`University logo for ${item.href}`}
								className="w-96 lg:w-80 pt-4 md:pt-0"
								priority
							/>
						</Link>
					))}
				</div>
			</section>

			<section className="px-6 py-10 md:px-32 2xl:px-80 relative font-OldStandardTT">
				<div className="text-4xl"></div>
				<div className="flex justify-center">
					<div className="pt-10 flex flex-wrap justify-center -mx-4 space-y-8 md:space-y-0 w-3/4">
						{people.map((item) => (
							<div key={item.email} className="w-full md:w-1/3 px-4">
								<ProfileCard {...item} />
							</div>
						))}
					</div>
				</div>
			</section>
		</>
	);
}
