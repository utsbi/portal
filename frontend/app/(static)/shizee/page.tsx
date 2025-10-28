"use client";
import Image from "next/image";
import Link from "next/link";
import Food from "@/assets/images/aboutMe/food.jpg";
import Christ from "@/assets/images/aboutMe/Christ.jpg";
import Show from "@/assets/images/aboutMe/show.jpg";
import ProfileCard from "@/components/ProfileCard";

const images = [
	{	img: Food, 
		href: "https://www.seriouseats.com/khao-piak-sen-lao-chicken-noodle-soup",
		caption: "Favorite food: Khao Piak",
	},

	{	img: Christ, 
		href: "https://www.logos.com/grow/nook-who-is-jesus/",
		caption: "Cannot live without my Lord and Savior Jesus Christ!",
	},

	{	img: Show, 
		href: "https://www.imdb.com/title/tt0238784/",
		caption: "Show I am currently watching",
	},
];

const people = [
	{
		name: "Shizee Saucedo",
		role: "Computer Science",
		email: "sos585@my.utexas.edu",
	}
];

export default function AboutMe() {
	return (
		<>
			<section className="px-6 py-10 pt-36 md:px-32 2xl:px-80 relative font-OldStandardTT">
				<div>
					<div className="text-4xl">About Me</div>
					<div className="text-xl pt-10 space-y-6">
						<div>
							<span className="font-semibold">
							Shizee
							</span>{" "}
							 means to shine bright like a star in <span className="font-semibold"> Hmong. </span> Currently, I am freshmen at 
							<span className="font-semibold"> The University of Texas at Austin </span>
							majoring in Computer Science. I lived in California for most of my life, but I am coming from Fort Worth, TX. 
							</div>
							<div>
							In my free time I love to play guitar, sing, dance, workout, and cook/bake.  My most favorite thing to do 
							is see live music and concerts. I love 
							<span className="font-semibold"> Jesus. </span> 
							</div>
							<div>
							As for my career aspirations...I am not too sure yet. I am very interested in robotics, but I am exploring all kinds of options. 
							I am genuinely curious about everything in CS. 
						</div>
					</div>
				</div>
			</section>

			<section className="px-6 py-10 md:px-32 2xl:px-80 relative font-OldStandardTT">
				<div className="text-4xl">Pictures Related to Me</div>
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

			<section className="px-6 py-2 md:px-60 2xl:px-80 relative font-OldStandardTT">
				<div className="flex justify-center gap-10"> 
					{images.map((item) => (
						<div key={item.href} className="flex flex-col items-center">
						<Link
							href={item.href}
							target="_blank"
							rel="noopener noreferrer"
						>
							<Image
								src={item.img}
								alt={`${item.href}`}
								className="w-96 lg:w-80 pt-4 md:pt-0"
								priority
							/>
						</Link>
						<p className = "mt-4 text-md text-center">
							{item.caption}
						</p>
						</div>
					))}
				</div>
			</section>
			</>
			);
}
