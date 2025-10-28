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
          <div className="text-4xl">About Me</div>
          <div className="text-xl pt-10 space-y-6">
            <div>
              I'm a current 1st year student at{" "}
              <span className="font-semibold">
                {" "}
                The University of Texas at Austin{" "}
              </span>
              majoring in Computer Science. I'm also doing a minor in Data
              Science with a concentration in Machine Learning & AI.
            </div>

            <div>
              My passions outside of class are listening to music, trying new
              foods, and playing video games. I'm also very big on traveling as
              I've been to <span className="font-semibold"> 5 countries </span>{" "}
              like the United States, Mexico, and France.
            </div>

            <div>
              My <span className="font-semibold">future goal</span> for myself
              is being hired in the ML/AI field. This could be anything from
              being a software engineer working on AI integration, or doing
              anything machine learning-related for robotics. Because of my love
              for Java, I'm looking into career opportunities in companies like
              Netflix and Amazon, as they use{" "}
              <span className="font-semibold"> Java </span> for their backend
              frameworks.
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
