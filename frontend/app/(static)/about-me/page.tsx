import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
// import Eseohe from "@/assets/images/";

export const metadata: Metadata = {
	title: "About Me",
};

// const images = [
// 	{ img: Eseohe, href: "" },
// 	{ img: Valorant, href: "" },
// 	{ img: Otter, href: "" },
//     { img: One Piece, href: "" },
// ];

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
                    
				</div>
			</section>
		</>
	);
}
