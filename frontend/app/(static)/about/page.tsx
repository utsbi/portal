"use client";

import Image from "next/image";
import Link from "next/link";
import Rice from "@/assets/images/schools/rice_university.png";
import TAMU from "@/assets/images/schools/TAMU.png";
import UTAustin from "@/assets/images/schools/TEXAS_official_seal.svg";
import ProfileCard from "@/components/ProfileCard";

// import ICOL from "@/assets/images/schools/imperial_college_of_london.png";

const images = [
	{ img: UTAustin, href: "https://utexas.edu" },
	{ img: TAMU, href: "https://tamu.edu" },
	{ img: Rice, href: "https://www.rice.edu/" },
	// { img: ICOL, href: "https://www.imperial.ac.uk/" },
];

const people = [
	{
		name: "Pedro Guzman",
		role: "President",
		email: "pedro@utsbi.org",
	},
	{
		name: "Sam Moran",
		role: "Vice President",
		email: "sam@utsbi.org",
	},
	{
		name: "Brendan Lyon",
		role: "Director of Mechanical Systems",
		email: "brendanlyon@utexas.edu",
	},
	{
		name: "Enoch Zhu",
		role: "Director of External Technologies",
		email: "enoch@utsbi.org",
	},
	{
		name: "Daniel Lam",
		role: "Director of Internal Technologies",
		email: "daniel@utsbi.org",
	},
	{
		name: "Dev Shroff",
		role: "Director of R&D",
		email: "dev@utsbi.org",
	},
	{
		name: "Ali Akbar",
		role: "Director of Finance",
		email: "aliakbar@utexas.edu",
	},
	{
		name: "Kabir Muzumdar",
		role: "Director of Civil Systems",
		email: "kabir@utsbi.org",
	},
	{
		name: "Noah Dao",
		role: "Director of Public Relations",
		email: "ntd534@my.utexas.edu",
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
								The Sustainable Building Initiative (SBI)
							</span>{" "}
							is a professionally driven, student-led consultancy founded at the
							University of Texas at Austin in 2024. Born from a passion to
							solve real-world infrastructure challenges, SBI unites students
							from every academic discipline to function as a single, cohesive
							company. We partner with clients to engineer, design, and develop
							innovative building projects.
						</div>
						<div>
							As a student organization, SBI aims to{" "}
							<span className="font-semibold">
								drive innovation in sustainable infrastructure and empower the
								next generation of industry leaders
							</span>
							. Our mission is to provide hands-on consultancy experience that
							delivers tangible value to our clients while developing our
							members' practical skills. We bridge the gap between academic
							theory and professional practice, tackling the technical,
							environmental, and economic aspects of sustainable development.
						</div>
						<div>
							Our <span className="font-semibold">vision and goals</span> for
							SBI are to become the premier student-led consultancy for
							sustainable development in the region. In the short term, we
							provide unparalleled hands-on learning experiences through our
							departmental project work in engineering, architecture, finance,
							and more. Long term, our goal is to expand our project portfolio,
							advance cutting-edge research in sustainable materials and design,
							and advocate for green building practices that serve society.
						</div>
						<div>
							Become a part of our{" "}
							<span className="font-semibold">
								dynamic and growing organization
							</span>{" "}
							at The University of Texas at Austin to gain invaluable,
							real-world skills and help shape a more sustainable future. Join a
							mission-driven team dedicated to making a tangible impact, one
							project at a time.
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
				<div className="text-4xl">Meet Our Team</div>
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
