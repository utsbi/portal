"use client";

import Link from "next/link";
import Image from "next/image";
// Import image from frontend/assets/images/people
import sidharthImg from "@/assets/images/people/Sidharth.jpg";
// Additional assets for the three images laid out side-by-side
import comicsImg from "@/assets/images/comics.jpg";
import pastaImg from "@/assets/images/pasta.jpg";
import cycleImg from "@/assets/images/cycle.jpg";

export default function AboutMePage() {
	return (
		<main className="max-w-4xl mx-auto p-8 pt-24">{/* extra top padding so navbar doesn't cover content */}
			<h1 className="text-4xl font-bold mb-4">About Me</h1>

			{/* Biography */}
			<p className="text-lg mb-6">I’m Sidharth Darapuram, a freshman at <strong className="font-bold">UT Austin</strong> studying <strong className="font-bold">computer science</strong> with a love for creativity, storytelling, and technology. I’m passionate about video games—not just playing them, but understanding how they can tell meaningful stories and connect people. I’m naturally curious and always eager to learn new skills, whether it’s coding, writing, or even picking up hobbies like skateboarding or guitar. I value empathy, imagination, and persistence, and I’m motivated by the idea of creating experiences—especially through games—that leave a lasting, positive impact on others.</p>

			{/* Profile block: placed above Images section as requested */}
			<div className="flex flex-col items-center mb-8">
				<Image
					src={sidharthImg}
					alt="Sidharth Darapuram"
					width={320}
					height={480}
					className="rounded-lg object-cover mb-4"
				/>

				<p className="text-lg font-medium">Sidharth Darapuram</p>
				<p className="text-sm text-gray-600 mb-4">Computer Science</p>

				<a href="mailto:sidharthdarapuram@gmail.com" className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Email Me</a>
			</div>

			{/* Images Relating to Me: now contains the three-image gallery */}
			<section className="mb-8">
				<h2 className="text-2xl font-semibold mb-4">Images Relating to Me</h2>

				<div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
					{/* Comics */}
					<a href="https://www.gocomics.com/calvinandhobbes" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center">
						<Image src={comicsImg} alt="Comics" width={360} height={240} className="rounded-lg object-cover" />
						<p className="text-sm text-center mt-2">I like reading comics, my favorite is Calvin and Hobbes</p>
					</a>

					{/* Pasta */}
					<a href="https://www.olivegarden.com/home" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center">
						<Image src={pastaImg} alt="Pasta" width={360} height={240} className="rounded-lg object-cover" />
						<p className="text-sm text-center mt-2">My favorite food to eat is pasta at Olive Garden.</p>
					</a>

					{/* Cycle */}
					<a href="http://www.ozone-cycling.com/?idioma=en" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center">
						<Image src={cycleImg} alt="Cycle" width={360} height={240} className="rounded-lg object-cover" />
						<p className="text-sm text-center mt-2">One of my favorite hobbies is to go cycling</p>
					</a>
				</div>
			</section>

			<p className="text-lg">Want to go back? <Link href="/" className="text-blue-600 underline">Home</Link></p>
		</main>
	);
}
