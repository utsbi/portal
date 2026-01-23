"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import NavLink from "@/components/nav-link";

const navItems = [
  // { name: "Home", href: "/" },
  { name: "ABOUT", href: "/about" },
  { name: "OUTREACH", href: "/outreach" },
  { name: "PROJECTS", href: "/projects" },
  { name: "CONTACT US", href: "/contact" },
  { name: "LOGIN", href: "/login" },
];

// Animated hamburger menu icon
function MenuIcon({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Toggle navigation"
      className="relative w-12 h-12 flex items-center justify-center z-50"
    >
      <div className="relative w-7 h-5 flex flex-col justify-between">
        <span className="block h-0.5 w-full bg-white rounded-full" />
        <span className="block h-0.5 w-full bg-white rounded-full" />
        <span className="block h-0.5 w-[70%] bg-white rounded-full" />
      </div>
    </button>
  );
}

// Mobile menu item with staggered animation
function MobileMenuItem({
  item,
  index,
  onClose,
}: {
  item: (typeof navItems)[0];
  index: number;
  onClose: () => void;
}) {
  const isLogin = item.name === "LOGIN";

  return (
    <motion.li
      initial={{ opacity: 0, x: -40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{
        delay: index * 0.08,
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <Link
        href={item.href}
        onClick={onClose}
        className={`group flex items-center gap-4 py-4 transition-colors duration-300 ${isLogin ? "text-sbi-green" : "text-sbi-muted hover:text-white"
          }`}
      >
        <motion.span
          className="w-8 h-px bg-sbi-green origin-left"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{
            delay: index * 0.08 + 0.2,
            duration: 0.4,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
        <span className="text-2xl font-light tracking-wide">{item.name}</span>
      </Link>
    </motion.li>
  );
}

function Navbar() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const lastScrollY = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => {
    setOpen((prev) => !prev);
  };

  const closeMenu = () => {
    setOpen(false);
  };

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Handle scroll to show/hide navbar
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < lastScrollY.current || currentScrollY < 10) {
        // Scrolling up or at top - show navbar
        setVisible(true);
      } else if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        // Scrolling down and past threshold - hide navbar
        setVisible(false);
      }

      setScrolled(currentScrollY > 0);
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <>
      <motion.nav
        className={`fixed w-full z-50 top-0 start-0 transition-all duration-500 will-change-transform ${scrolled
            ? "bg-sbi-dark/95 backdrop-blur-md border-b border-sbi-dark-border"
            : "bg-transparent"
          }`}
        initial={{ y: 0 }}
        animate={{ y: visible ? 0 : "-100%" }}
        transition={{
          duration: 0.3,
          ease: "easeInOut",
        }}
      >
        <div className="max-w-7xl flex flex-wrap items-center justify-between mx-auto px-8 md:px-16 py-6 select-none">
          <Link
            href="/"
            className="flex items-center space-x-3 rtl:space-x-reverse group z-50"
          >
            <div className="relative">
              <span className="text-3xl font-light tracking-tight text-white">
                <span className="text-sbi-green">S</span>BI
              </span>
              <motion.div
                className="absolute -bottom-1 left-0 h-px bg-sbi-green"
                initial={{ width: 0 }}
                whileHover={{ width: "100%" }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </Link>

          {/* Mobile menu toggle */}
          <div className="md:hidden flex items-center">
            <MenuIcon onClick={toggleMenu} />
          </div>

          {/* Desktop Menu */}
          <div className="items-center justify-between hidden w-full md:flex md:w-auto">
            <ul className="flex flex-col p-4 md:p-0 mt-4 md:space-x-10 rtl:space-x-reverse md:flex-row md:mt-0 items-center">
              {navItems.map((item) => (
                <li key={item.name}>
                  <NavLink name={item.name} href={item.href} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            className="fixed inset-0 z-60 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-sbi-dark/98 backdrop-blur-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />

            {/* Close button in top right */}
            <button
              type="button"
              onClick={closeMenu}
              aria-label="Close menu"
              className="absolute top-6 right-8 w-12 h-12 flex items-center justify-center z-70"
            >
              <motion.div
                className="relative w-7 h-7"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.3 }}
              >
                <span className="absolute top-1/2 left-0 w-full h-0.5 bg-white rounded-full -translate-y-1/2 rotate-45" />
                <span className="absolute top-1/2 left-0 w-full h-0.5 bg-white rounded-full -translate-y-1/2 -rotate-45" />
              </motion.div>
            </button>

            {/* Blueprint grid pattern */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
              <svg
                width="100%"
                height="100%"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <title>Grid pattern</title>
                <defs>
                  <pattern
                    id="mobile-grid"
                    width="40"
                    height="40"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 40 0 L 0 0 0 40"
                      fill="none"
                      stroke="white"
                      strokeWidth="0.5"
                    />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#mobile-grid)" />
              </svg>
            </div>

            {/* Menu content */}
            <div className="relative h-full flex flex-col justify-center px-12">
              {/* Decorative line */}
              <motion.div
                className="absolute left-8 top-32 bottom-32 w-px bg-linear-to-b from-transparent via-sbi-green/30 to-transparent"
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              />

              {/* Navigation items */}
              <nav>
                <ul className="space-y-2">
                  {navItems.map((item, index) => (
                    <MobileMenuItem
                      key={item.name}
                      item={item}
                      index={index}
                      onClose={closeMenu}
                    />
                  ))}
                </ul>
              </nav>

              {/* Bottom decorative element */}
              <motion.div
                className="absolute bottom-12 left-12 right-12"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
              >
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-px bg-sbi-dark-border" />
                  <span className="text-xs tracking-[0.3em] uppercase text-sbi-green/50">
                    SBI
                  </span>
                  <div className="flex-1 h-px bg-sbi-dark-border" />
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default Navbar;
