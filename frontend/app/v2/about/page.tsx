"use client";

import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";

import group from "@/assets/images/group.jpg";
import Ali from "@/assets/images/people/Ali.jpg";
import Brendan from "@/assets/images/people/Brendan.jpg";
import Daniel from "@/assets/images/people/Daniel.jpg";
import Dev from "@/assets/images/people/Dev.jpg";
import Enoch from "@/assets/images/people/Enoch.jpg";
import Kabir from "@/assets/images/people/Kabir.jpg";
import Noah from "@/assets/images/people/Noah.jpg";
import Pedro from "@/assets/images/people/Pedro.jpg";
import Sam from "@/assets/images/people/Sam.jpg";
import Rice from "@/assets/images/schools/rice_university.png";
import TAMU from "@/assets/images/schools/TAMU.png";
import UTAustin from "@/assets/images/schools/TEXAS_official_seal.svg";
import { BlueprintGrid } from "@/components/v2/blueprint-grid";
import { MagneticButton } from "@/components/v2/magnetic-button";
import { PageHero } from "@/components/v2/page-hero";
import { TeamCard } from "@/components/v2/team-card";

const FORMS_LINK = "https://forms.gle/KWJjaXGYt2dv3bY68";

const teamMembers = [
  {
    name: "Pedro Guzman",
    role: "President",
    email: "pedro@utsbi.org",
    image: Pedro,
  },
  {
    name: "Sam Moran",
    role: "Vice President",
    email: "sam@utsbi.org",
    image: Sam,
  },
  {
    name: "Brendan Lyon",
    role: "Director of Mechanical Systems",
    email: "brendanlyon@utexas.edu",
    image: Brendan,
  },
  {
    name: "Enoch Zhu",
    role: "Director of External Technologies",
    email: "enoch@utsbi.org",
    image: Enoch,
  },
  {
    name: "Daniel Lam",
    role: "Director of Internal Technologies",
    email: "daniel@utsbi.org",
    image: Daniel,
  },
  {
    name: "Dev Shroff",
    role: "Director of R&D",
    email: "dev@utsbi.org",
    image: Dev,
  },
  {
    name: "Ali Akbar",
    role: "Director of Finance",
    email: "aliakbar@utexas.edu",
    image: Ali,
  },
  {
    name: "Kabir Muzumdar",
    role: "Director of Civil Systems",
    email: "kabir@utsbi.org",
    image: Kabir,
  },
  {
    name: "Noah Dao",
    role: "Director of Public Relations",
    email: "ntd534@my.utexas.edu",
    image: Noah,
  },
];

const universities = [
  { name: "UT Austin", logo: UTAustin, href: "https://utexas.edu" },
  { name: "Texas A&M", logo: TAMU, href: "https://tamu.edu" },
  { name: "Rice University", logo: Rice, href: "https://www.rice.edu/" },
];

export default function AboutPage() {
  return (
    <div className="bg-sbi-dark text-white">
      <PageHero
        label="About Us"
        title="Who We Are"
        subtitle="A student-powered initiative transforming sustainable building practices through interdisciplinary collaboration."
      />

      <section className="relative py-32 md:py-48 overflow-hidden">
        <BlueprintGrid />
        <div className="relative z-10 max-w-4xl mx-auto px-8 md:px-16">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center"
          >
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              viewport={{ once: true }}
              className="inline-block px-4 py-2 mb-8 text-xs tracking-[0.3em] uppercase text-sbi-green border border-sbi-green/30"
            >
              Our Story
            </motion.span>

            <p className="text-2xl md:text-3xl lg:text-4xl font-light text-[#c4d4cc] leading-relaxed">
              <span className="text-white font-normal">
                The Sustainable Building Initiative
              </span>{" "}
              is a professionally driven, student-led consultancy founded at the
              University of Texas at Austin in 2024. Born from a passion to
              solve real-world infrastructure challenges, we unite students from{" "}
              <span className="text-sbi-green italic">
                every academic discipline
              </span>{" "}
              to function as a single, cohesive company.
            </p>

            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              transition={{
                delay: 0.5,
                duration: 1,
                ease: [0.22, 1, 0.36, 1],
              }}
              viewport={{ once: true }}
              className="w-24 h-px bg-sbi-green mx-auto mt-12"
            />
          </motion.div>
        </div>
      </section>

      <section className="relative py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-8 md:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: true }}
              className="relative aspect-[4/3] overflow-hidden"
            >
              <Image
                src={group}
                alt="SBI Team"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute inset-0 border border-sbi-dark-border" />
              <div className="absolute -bottom-4 -right-4 w-24 h-24 border border-sbi-green/30" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-px bg-sbi-green" />
                <span className="text-xs tracking-[0.3em] uppercase text-sbi-green">
                  Our Vision
                </span>
              </div>

              <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-6">
                Driving Innovation in{" "}
                <span className="text-sbi-green italic">
                  Sustainable Infrastructure
                </span>
              </h2>

              <div className="space-y-4 text-sbi-muted leading-relaxed">
                <p>
                  As a student organization, SBI aims to drive innovation in
                  sustainable infrastructure and empower the next generation of
                  industry leaders. Our mission is to provide hands-on
                  consultancy experience that delivers tangible value to our
                  clients while developing our members&apos; practical skills.
                </p>
                <p>
                  We bridge the gap between academic theory and professional
                  practice, tackling the technical, environmental, and economic
                  aspects of sustainable development.
                </p>
                <p>
                  Our goal is to become the premier student-led consultancy for
                  sustainable development in the region, expanding our project
                  portfolio and advancing cutting-edge research in sustainable
                  materials and design.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="relative py-24 border-y border-sbi-dark-border">
        <div className="max-w-7xl mx-auto px-8 md:px-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="text-xs tracking-[0.3em] uppercase text-sbi-muted">
              Partner Universities
            </span>
          </motion.div>

          <div className="flex flex-wrap justify-center items-center gap-12 md:gap-24">
            {universities.map((uni, index) => (
              <motion.div
                key={uni.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  delay: index * 0.1,
                  duration: 0.6,
                  ease: [0.22, 1, 0.36, 1],
                }}
                viewport={{ once: true }}
              >
                <Link
                  href={uni.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block opacity-50 hover:opacity-100 grayscale hover:grayscale-0 transition-all duration-500"
                >
                  <Image
                    src={uni.logo}
                    alt={uni.name}
                    className="h-20 md:h-24 w-auto"
                    priority
                  />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-32 md:py-48 overflow-hidden">
        <BlueprintGrid />
        <div className="relative z-10 max-w-7xl mx-auto px-8 md:px-16">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true }}
            className="mb-16"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-px bg-sbi-green" />
              <span className="text-xs tracking-[0.3em] uppercase text-sbi-green">
                Leadership
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight">
              Our Team
            </h2>
            <p className="mt-4 text-sbi-muted max-w-xl">
              Meet the dedicated leaders driving SBI&apos;s mission to transform
              sustainable building practices.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamMembers.map((member, index) => (
              <TeamCard
                key={member.email}
                name={member.name}
                role={member.role}
                email={member.email}
                imageSrc={member.image.src}
                index={index}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-32 md:py-48 overflow-hidden">
        <BlueprintGrid />
        <div className="absolute inset-0">
          <Image
            src={group}
            alt="SBI Team"
            fill
            className="object-cover brightness-[0.3]"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-linear-to-t from-sbi-dark via-sbi-dark/80 to-sbi-dark/60" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-8 md:px-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true }}
          >
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              viewport={{ once: true }}
              className="inline-block px-4 py-2 mb-8 text-xs tracking-[0.3em] uppercase text-sbi-green border border-sbi-green/30"
            >
              Join Us
            </motion.span>

            <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight mb-6">
              Be Part of the{" "}
              <span className="italic text-sbi-green">Future</span>
            </h2>

            <p className="text-lg md:text-xl text-sbi-muted font-light mb-12 max-w-2xl mx-auto">
              Gain invaluable real-world skills and help shape a more
              sustainable future. Join a mission-driven team dedicated to making
              a tangible impact.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              viewport={{ once: true }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <MagneticButton href={FORMS_LINK} variant="primary" external>
                Apply Now
              </MagneticButton>
              <MagneticButton href="/v2/contact" variant="secondary">
                Contact Us
              </MagneticButton>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
