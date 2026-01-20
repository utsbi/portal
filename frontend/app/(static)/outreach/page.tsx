"use client";

import { motion } from "motion/react";

import { BlueprintGrid } from "@/components/v2/blueprint-grid";
import { Counter } from "@/components/v2/counter";
import { MagneticButton } from "@/components/v2/magnetic-button";
import { PageHero } from "@/components/v2/page-hero";

const stats = [
  {
    value: 5,
    label: "Schools Reached",
    suffix: "+",
    description: "High schools and universities in our growing network.",
  },
  {
    value: 200,
    label: "Students Impacted",
    suffix: "+",
    description: "Future leaders introduced to sustainable building practices.",
  },
  {
    value: 6,
    label: "Active Partnerships",
    suffix: "",
    description: "Organizations collaborating on sustainability initiatives.",
  },
];

export default function OutreachPage() {
  return (
    <div className="bg-sbi-dark text-white">
      <PageHero
        label="Outreach"
        title="Expanding Impact"
        subtitle="Building connections across Texas to spread sustainable building knowledge and practices."
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
              Our Mission
            </motion.span>

            <p className="text-2xl md:text-3xl lg:text-4xl font-light text-[#c4d4cc] leading-relaxed">
              We believe in{" "}
              <span className="text-white font-normal">
                empowering the next generation
              </span>{" "}
              with the knowledge and skills needed to build a more sustainable
              future. Through workshops, partnerships, and educational programs,
              we&apos;re{" "}
              <span className="text-sbi-green italic">
                expanding our reach across Texas
              </span>{" "}
              and beyond.
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

      <section className="relative py-24 border-y border-sbi-dark-border">
        <div className="max-w-7xl mx-auto px-8 md:px-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-0 md:divide-x divide-sbi-dark-border">
            {stats.map((stat) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  ease: [0.22, 1, 0.36, 1],
                }}
                viewport={{ once: true, margin: "-100px" }}
                className="flex flex-col items-center text-center px-8"
              >
                <div className="text-5xl md:text-6xl lg:text-7xl font-thin text-white mb-4 tracking-tighter">
                  <Counter value={stat.value} suffix={stat.suffix} />
                </div>
                <div className="text-sm tracking-[0.2em] uppercase text-sbi-green mb-4">
                  {stat.label}
                </div>
                <p className="text-sbi-muted-dark text-sm leading-relaxed max-w-xs">
                  {stat.description}
                </p>
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
            className="mb-12"
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-px bg-sbi-green" />
              <span className="text-xs tracking-[0.3em] uppercase text-sbi-green">
                Network
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight">
              Our Growing Network
            </h2>
            <p className="mt-4 text-sbi-muted max-w-xl">
              Explore our connections with high schools, universities, and
              organizations across the region.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="absolute -inset-4 border border-sbi-dark-border pointer-events-none" />
            <div className="absolute -top-2 -left-2 w-4 h-4 border border-sbi-green bg-sbi-dark" />
            <div className="absolute -top-2 -right-2 w-4 h-4 border border-sbi-green bg-sbi-dark" />
            <div className="absolute -bottom-2 -left-2 w-4 h-4 border border-sbi-green bg-sbi-dark" />
            <div className="absolute -bottom-2 -right-2 w-4 h-4 border border-sbi-green bg-sbi-dark" />

            <div className="relative aspect-[16/9] bg-sbi-dark-card overflow-hidden">
              <iframe
                src="https://www.google.com/maps/d/embed?mid=1ItBSYv-_H_PJBScpnU8gLMzr9F4qA6Q&ehbc=2E312F"
                className="absolute inset-0 w-full h-full"
                allowFullScreen
                title="SBI Outreach Network Map"
                style={{ border: 0 }}
              />
            </div>
          </motion.div>
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
                Get Involved
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight">
              Partner With Us
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "Schools",
                description:
                  "Bring sustainable building education to your students through workshops and presentations.",
              },
              {
                title: "Organizations",
                description:
                  "Collaborate on sustainability initiatives and community projects.",
              },
              {
                title: "Sponsors",
                description:
                  "Support the next generation of sustainable building professionals.",
              },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  delay: index * 0.15,
                  duration: 0.8,
                  ease: [0.22, 1, 0.36, 1],
                }}
                viewport={{ once: true }}
                className="group relative h-full"
              >
                <div className="relative h-full p-8 bg-sbi-dark-card border border-sbi-dark-border hover:border-sbi-green/30 transition-colors duration-500 flex flex-col">
                  <span className="absolute top-6 right-6 text-5xl font-thin text-sbi-dark-border tracking-tighter">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <h3 className="text-2xl font-light text-white mb-4 tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-sbi-muted text-sm leading-relaxed flex-1">
                    {item.description}
                  </p>

                  <motion.div
                    className="absolute bottom-0 left-0 h-0.5 bg-sbi-green"
                    initial={{ width: 0 }}
                    whileInView={{ width: "100%" }}
                    transition={{
                      delay: 0.5 + index * 0.15,
                      duration: 0.8,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    viewport={{ once: true }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-32 border-t border-sbi-dark-border">
        <BlueprintGrid />
        <div className="relative z-10 max-w-4xl mx-auto px-8 md:px-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight mb-6">
              Ready to{" "}
              <span className="italic text-sbi-green">Collaborate</span>?
            </h2>

            <p className="text-lg md:text-xl text-sbi-muted font-light mb-12 max-w-2xl mx-auto">
              Whether you&apos;re a school, organization, or potential sponsor,
              we&apos;d love to hear from you.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              viewport={{ once: true }}
            >
              <MagneticButton href="/contact" variant="primary">
                Get in Touch
              </MagneticButton>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
