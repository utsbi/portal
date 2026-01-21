"use client";

import { motion } from "motion/react";
import Link from "next/link";

const FORMS_LINK = "https://forms.gle/KWJjaXGYt2dv3bY68";

const footerLinks = {
  navigation: [
    { name: "About", href: "/about" },
    { name: "Projects", href: "/projects" },
    { name: "Outreach", href: "/outreach" },
    { name: "Contact", href: "/contact" },
  ],
  resources: [
    { name: "Join Our Team", href: FORMS_LINK, external: true },
    { name: "Login", href: "/login" },
  ],
  social: [
    { name: "Instagram", href: "https://instagram.com/ut.sbi" },
    { name: "LinkedIn", href: "https://linkedin.com/company/utsbi" },
  ],
};

function FooterLink({
  href,
  children,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const Component = external ? "a" : Link;
  const externalProps = external
    ? { target: "_blank", rel: "noopener noreferrer" }
    : {};

  return (
    <Component
      href={href}
      {...externalProps}
      className="group relative inline-block text-sbi-muted hover:text-white transition-colors duration-300"
    >
      <span className="relative">
        {children}
        <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-sbi-green transition-all duration-300 group-hover:w-full" />
      </span>
    </Component>
  );
}

export function Footer() {
  return (
    <footer className="relative bg-sbi-dark border-t border-sbi-dark-border overflow-hidden">
      {/* Architectural grid background */}
      <div className="absolute inset-0 pointer-events-none">
        <svg
          className="w-full h-full opacity-[0.02]"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <title>Grid pattern</title>
          <defs>
            <pattern
              id="footer-grid"
              width="60"
              height="60"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 60 0 L 0 0 0 60"
                fill="none"
                stroke="white"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#footer-grid)" />
        </svg>
      </div>

      {/* Diagonal accent lines */}
      <div className="absolute top-0 right-0 w-96 h-96 pointer-events-none opacity-10">
        <svg
          viewBox="0 0 400 400"
          fill="none"
          className="w-full h-full"
          aria-hidden="true"
        >
          <title>Decorative lines</title>
          <line
            x1="0"
            y1="400"
            x2="400"
            y2="0"
            stroke="url(#footer-gradient)"
            strokeWidth="1"
          />
          <line
            x1="50"
            y1="400"
            x2="400"
            y2="50"
            stroke="url(#footer-gradient)"
            strokeWidth="0.5"
          />
          <line
            x1="100"
            y1="400"
            x2="400"
            y2="100"
            stroke="url(#footer-gradient)"
            strokeWidth="0.5"
          />
          <defs>
            <linearGradient
              id="footer-gradient"
              x1="0%"
              y1="100%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor="#22c55e" stopOpacity="0" />
              <stop offset="50%" stopColor="#22c55e" stopOpacity="1" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-8 md:px-16">
        {/* Main footer content */}
        <div className="py-16 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8">
          {/* Brand column */}
          <div className="lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              viewport={{ once: true }}
            >
              {/* Logo */}
              <Link href="/v2" className="inline-block group">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl md:text-5xl font-extralight tracking-tighter">
                    <span className="text-sbi-green">S</span>
                    <span className="text-white">BI</span>
                  </span>
                  <span className="w-2 h-2 bg-sbi-green rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
              </Link>

              <p className="mt-6 text-sbi-muted font-light leading-relaxed max-w-sm">
                A student-powered initiative transforming sustainable building
                practices through interdisciplinary collaboration and
                professional-grade execution.
              </p>

              {/* Coordinates-style decorative element */}
              <div className="mt-8 flex items-center gap-4 text-xs tracking-[0.2em] text-sbi-muted-dark uppercase">
                <span className="w-8 h-px bg-sbi-dark-border" />
                <span>EST. 2024</span>
                <span className="text-sbi-green">•</span>
                <span>UT AUSTIN</span>
              </div>
            </motion.div>
          </div>

          {/* Links columns */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8 lg:gap-12">
            {/* Navigation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.1,
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1],
              }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-6">
                <span className="w-4 h-px bg-sbi-green" />
                <span className="text-xs tracking-[0.2em] uppercase text-sbi-green">
                  Navigate
                </span>
              </div>
              <ul className="space-y-3">
                {footerLinks.navigation.map((link) => (
                  <li key={link.name}>
                    <FooterLink href={link.href}>{link.name}</FooterLink>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Resources */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.2,
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1],
              }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-6">
                <span className="w-4 h-px bg-sbi-green" />
                <span className="text-xs tracking-[0.2em] uppercase text-sbi-green">
                  Resources
                </span>
              </div>
              <ul className="space-y-3">
                {footerLinks.resources.map((link) => (
                  <li key={link.name}>
                    <FooterLink
                      href={link.href}
                      external={"external" in link && link.external}
                    >
                      {link.name}
                    </FooterLink>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Social */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.3,
                duration: 0.8,
                ease: [0.22, 1, 0.36, 1],
              }}
              viewport={{ once: true }}
            >
              <div className="flex items-center gap-3 mb-6">
                <span className="w-4 h-px bg-sbi-green" />
                <span className="text-xs tracking-[0.2em] uppercase text-sbi-green">
                  Connect
                </span>
              </div>
              <ul className="space-y-3">
                {footerLinks.social.map((link) => (
                  <li key={link.name}>
                    <FooterLink href={link.href} external>
                      {link.name}
                    </FooterLink>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="relative py-6 border-t border-sbi-dark-border">
          {/* Technical markers */}
          <div className="absolute left-0 top-0 w-3 h-3 -translate-y-1/2 border border-sbi-dark-border bg-sbi-dark">
            <div className="absolute inset-1 bg-sbi-green/20" />
          </div>
          <div className="absolute right-0 top-0 w-3 h-3 -translate-y-1/2 border border-sbi-dark-border bg-sbi-dark">
            <div className="absolute inset-1 bg-sbi-green/20" />
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
              viewport={{ once: true }}
              className="text-xs text-sbi-muted-dark tracking-wide"
            >
              © {new Date().getFullYear()} Sustainable Building Initiative. All
              rights reserved.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              viewport={{ once: true }}
              className="flex items-center gap-6 text-xs text-sbi-muted-dark"
            >
              <span className="hidden sm:inline-flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-sbi-green rounded-full animate-pulse" />
                <span>Building Sustainably</span>
              </span>
              <span className="tracking-[0.15em] uppercase">
                Research • Design • Execute
              </span>
            </motion.div>
          </div>
        </div>
      </div>
    </footer>
  );
}
