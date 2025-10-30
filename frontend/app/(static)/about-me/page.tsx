import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import Valorant from "@/assets/images/about/Valorant.png";
import Otter from "@/assets/images/about/Otter.jpg";
import Jollof from "@/assets/images/about/Jollof.png";
import ProfileCard from "@/components/ProfileCard";

export const metadata: Metadata = {
	title: "About Me",
};

const images = [
	{ img: Valorant, href: "https://playvalorant.com/en-us/" },
	{ img: Otter, href: "https://www.reddit.com/r/Eyebleach/comments/loi8hn/i_love_otters_in_hats/" },
	{ img: Jollof, href: "https://naijastickitchen.com/product/jollof-rice-with-chicken-served-with-plantain-bulk/" },
];

const about = [
    {
		name: "Eseohe Aigberadion",
		role: "Computer Science",
		email: "eseoheaigb@utexas.edu",
	},
];

export default function AboutMe() {
	return (
		<>
			<section className="px-6 py-10 pt-36 md:px-32 2xl:px-80 relative font-OldStandardTT">
				<div>
					<div className="text-4xl">About Me</div>
					<div className="text-xl pt-10 space-y-6">
						<div>
							My name is Eseohe Aigberadion. I am Junior Computer Science major at the{" "}
                            <span className="font-semibold">
                                University of Texas at Austin 
                            </span>{" "}
                            pursuing a certificate in{" "}
                            <span className="font-semibold">
                                Digital Arts and Media;
                            </span>{" "}        
                            because I really like playing video games like 
                            <span className="font-semibold">
                                Valorant
                            </span>{" "}                           
                            or story-mode choice-based games like {" "}   
                            <span className="font-semibold">
                            Telltale: The Walking Dead, Detriot Become Human, Until Dawn, etc.                                        
                            </span>{" "}                            
						</div>

						<div>
                            Along with gaming, I also like watching/listening to musicals, anime, manga, films/shows, 
                            and all things media related. Some animes I'd recommend are {" "}
                            <span className="font-semibold">
                                Vinland Saga, Apothecary Diaries, ReZero, Attack on Titan, and to Your Eternity,
                            </span> {" "}
                            but my favorite anime is definitely One Piece.
						</div>

						<div>
                            Post grad I'd like to work on backend, cloud, platform, or infrastructure engineering, or  
                            creating internal tools for other engineers. My dream companies are either {" "}
                            <span className="font-semibold">
                                Riot Games, Capital One, Google, LinkedIn, or Twitch.
                            </span> {" "}
                            But first I need to get better at leetcoding. 
						</div>
					</div>
				</div>
			</section>

			<section className="px-6 py-10 md:px-32 2xl:px-80 relative font-OldStandardTT">
				<div className="text-4xl">Pictures Relating to Me</div>
				<div className="flex justify-center">
					<div className="pt-10 flex flex-wrap justify-center -mx-4 space-y-8 md:space-y-0 w-3/4">
						{about.map((item) => (
							<div key={item.email} className="w-full md:w-1/3 px-4">
								<ProfileCard {...item} />
							</div>
						))}
					</div>
				</div>
			</section>

			<section className="px-80 py-40 md:px-100 2xl:px-164 relative">
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
								alt={`Fun fact for ${item.href}`}
								className="w-96 lg:w-80 pt-4 md:pt-0"
								priority
							/>
						</Link>
					))}
				</div>
			</section>           
		</>
	);
}
