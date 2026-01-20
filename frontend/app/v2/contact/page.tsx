"use client";

import { Instagram, Linkedin, Mail, MapPin, Send } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";

import { BlueprintGrid } from "@/components/v2/blueprint-grid";
import { PageHero } from "@/components/v2/page-hero";

const contactInfo = {
  emails: [
    { name: "Pedro Guzman", email: "pedro@utsbi.org", role: "President" },
    { name: "Sam Moran", email: "sam@utsbi.org", role: "Vice President" },
  ],
  social: [
    { name: "Instagram", href: "https://instagram.com/utsbi", icon: Instagram },
    {
      name: "LinkedIn",
      href: "https://linkedin.com/company/utsbi",
      icon: Linkedin,
    },
  ],
  location: "The University of Texas at Austin",
};

const subjectOptions = [
  { value: "general", label: "General Inquiry" },
  { value: "project", label: "Project Inquiry" },
  { value: "membership", label: "Membership" },
  { value: "partnership", label: "Partnership" },
];

export default function ContactPage() {
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    subject: "general",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    await new Promise((resolve) => setTimeout(resolve, 1500));

    setIsSubmitting(false);
    setSubmitStatus("success");
    setFormState({ name: "", email: "", subject: "general", message: "" });

    setTimeout(() => setSubmitStatus("idle"), 5000);
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setFormState((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="bg-sbi-dark text-white">
      <PageHero
        label="Get in Touch"
        title="Contact Us"
        subtitle="Have a question or want to collaborate? We'd love to hear from you."
      />

      <section className="relative py-32 md:py-48 overflow-hidden">
        <BlueprintGrid />
        <div className="relative z-10 max-w-7xl mx-auto px-8 md:px-16">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-16 lg:gap-24">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: true }}
              className="lg:col-span-2"
            >
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-px bg-sbi-green" />
                <span className="text-xs tracking-[0.3em] uppercase text-sbi-green">
                  Contact Info
                </span>
              </div>

              <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-8">
                Let&apos;s Build Something{" "}
                <span className="text-sbi-green italic">Sustainable</span>
              </h2>

              <div className="space-y-8">
                <div>
                  <h3 className="text-sm tracking-[0.2em] uppercase text-sbi-muted mb-4">
                    Email Us
                  </h3>
                  <div className="space-y-3">
                    {contactInfo.emails.map((contact) => (
                      <motion.a
                        key={contact.email}
                        href={`mailto:${contact.email}`}
                        className="flex items-center gap-3 text-sbi-muted hover:text-white transition-colors group"
                        whileHover={{ x: 4 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 25,
                        }}
                      >
                        <span className="w-8 h-8 flex items-center justify-center border border-sbi-dark-border group-hover:border-sbi-green/30 transition-colors">
                          <Mail className="w-4 h-4" />
                        </span>
                        <div>
                          <span className="block text-white">
                            {contact.name}
                          </span>
                          <span className="text-xs text-sbi-muted-dark">
                            {contact.email}
                          </span>
                        </div>
                      </motion.a>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm tracking-[0.2em] uppercase text-sbi-muted mb-4">
                    Follow Us
                  </h3>
                  <div className="flex gap-3">
                    {contactInfo.social.map((social) => (
                      <motion.a
                        key={social.name}
                        href={social.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-10 h-10 flex items-center justify-center border border-sbi-dark-border hover:border-sbi-green/30 text-sbi-muted hover:text-sbi-green transition-colors"
                        whileHover={{ y: -2 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 25,
                        }}
                      >
                        <social.icon className="w-4 h-4" />
                      </motion.a>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm tracking-[0.2em] uppercase text-sbi-muted mb-4">
                    Location
                  </h3>
                  <div className="flex items-start gap-3 text-sbi-muted">
                    <span className="w-8 h-8 flex items-center justify-center border border-sbi-dark-border flex-shrink-0">
                      <MapPin className="w-4 h-4" />
                    </span>
                    <span>{contactInfo.location}</span>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: true }}
              className="lg:col-span-3"
            >
              <div className="relative p-8 md:p-12 bg-sbi-dark-card border border-sbi-dark-border">
                <div className="absolute -top-3 -left-3 w-6 h-6 border border-sbi-green bg-sbi-dark" />
                <div className="absolute -top-3 -right-3 w-6 h-6 border border-sbi-green bg-sbi-dark" />
                <div className="absolute -bottom-3 -left-3 w-6 h-6 border border-sbi-green bg-sbi-dark" />
                <div className="absolute -bottom-3 -right-3 w-6 h-6 border border-sbi-green bg-sbi-dark" />

                <h3 className="text-2xl font-light tracking-tight mb-8">
                  Send a Message
                </h3>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label
                        htmlFor="name"
                        className="block text-xs tracking-[0.2em] uppercase text-sbi-muted mb-2"
                      >
                        Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formState.name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 bg-sbi-dark border border-sbi-dark-border focus:border-sbi-green/50 focus:outline-none focus:ring-1 focus:ring-sbi-green/20 text-white placeholder:text-sbi-muted-dark transition-colors"
                        placeholder="Your name"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="email"
                        className="block text-xs tracking-[0.2em] uppercase text-sbi-muted mb-2"
                      >
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formState.email}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 bg-sbi-dark border border-sbi-dark-border focus:border-sbi-green/50 focus:outline-none focus:ring-1 focus:ring-sbi-green/20 text-white placeholder:text-sbi-muted-dark transition-colors"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="subject"
                      className="block text-xs tracking-[0.2em] uppercase text-sbi-muted mb-2"
                    >
                      Subject
                    </label>
                    <select
                      id="subject"
                      name="subject"
                      value={formState.subject}
                      onChange={handleChange}
                      className="w-full px-4 py-3 bg-sbi-dark border border-sbi-dark-border focus:border-sbi-green/50 focus:outline-none focus:ring-1 focus:ring-sbi-green/20 text-white transition-colors appearance-none cursor-pointer"
                    >
                      {subjectOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="message"
                      className="block text-xs tracking-[0.2em] uppercase text-sbi-muted mb-2"
                    >
                      Message
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      value={formState.message}
                      onChange={handleChange}
                      required
                      rows={6}
                      className="w-full px-4 py-3 bg-sbi-dark border border-sbi-dark-border focus:border-sbi-green/50 focus:outline-none focus:ring-1 focus:ring-sbi-green/20 text-white placeholder:text-sbi-muted-dark transition-colors resize-none"
                      placeholder="Tell us about your inquiry..."
                    />
                  </div>

                  <motion.button
                    type="submit"
                    disabled={isSubmitting}
                    className="relative inline-flex items-center gap-2 px-8 py-4 text-sm font-medium tracking-wider uppercase overflow-hidden bg-sbi-dark-btn text-sbi-green border border-sbi-green/30 hover:bg-sbi-green hover:text-sbi-dark-btn disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-500"
                    whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                    whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
                  >
                    {isSubmitting ? (
                      <>
                        <motion.span
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                          className="w-4 h-4 border-2 border-sbi-green border-t-transparent rounded-full"
                        />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <span>Send Message</span>
                        <Send className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>

                  {submitStatus === "success" && (
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sbi-green text-sm"
                    >
                      Message sent successfully! We&apos;ll get back to you
                      soon.
                    </motion.p>
                  )}

                  {submitStatus === "error" && (
                    <motion.p
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-red-400 text-sm"
                    >
                      Something went wrong. Please try again.
                    </motion.p>
                  )}
                </form>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="relative py-24 border-t border-sbi-dark-border">
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
                How Can We Help?
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-light tracking-tight">
              Inquiry Types
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: "General",
                description:
                  "Questions about SBI, our mission, or how we operate.",
              },
              {
                title: "Projects",
                description:
                  "Interested in our services or have a project proposal.",
              },
              {
                title: "Membership",
                description: "Want to join SBI as a student member.",
              },
              {
                title: "Partnership",
                description: "Sponsor, collaborate, or partner with us.",
              },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{
                  delay: index * 0.1,
                  duration: 0.8,
                  ease: [0.22, 1, 0.36, 1],
                }}
                viewport={{ once: true }}
                className="p-6 bg-sbi-dark-card border border-sbi-dark-border hover:border-sbi-green/30 transition-colors"
              >
                <h3 className="text-lg font-light text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-sbi-muted">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
