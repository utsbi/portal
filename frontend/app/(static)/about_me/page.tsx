"use client";

import Image from "next/image";
import Link from "next/link";
import Netflix from "@/assets/images/about_me/netflix.png";
import Amazon from "@/assets/images/about_me/amazon.jpg";
import Java from "@/assets/images/about_me/java.png";
import ProfileCard from "@/components/ProfileCard";

const images = [
  { img: Amazon, href: "https://amazon.com", caption: "Amazon" },
  { img: Java, href: "https://java.com", caption: "Java" },
  { img: Netflix, href: "https://www.netflix.com", caption: "Netflix" },
];

const people = [
  {
    name: "Adetola Adetunji",
    role: "Computer Science",
    email: "aadetunji@utexas.edu",
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
        <div className="flex flex-row justify-center items-center space-x-6">
          {images.map((item) => (
            <div key={item.href} className="flex flex-col items-center">
              <Link href={item.href} target="_blank" rel="noopener noreferrer">
                <Image
                  src={item.img}
                  alt={item.caption}
                  className="w-40 md:w-48 lg:w-56 h-auto pt-4"
                  priority
                />
              </Link>
              {/* Caption */}
              <p className="text-sm text-center mt-2 font-medium">
                {item.caption}
              </p>
            </div>
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
