"use client";

import { useState, useRef, useEffect } from "react";
import logo from "@/assets/logos/official_logo.gif";
import Image from "next/image";

const navItems = [
  { name: "Home", href: "/" },
  { name: "About", href: "/about/" },
  { name: "Outreach", href: "/outreach/" },
  { name: "Projects", href: "/projects/" },
  { name: "Contact Us", href: "/contact/" },
];

function Navbar() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  return (
    <nav className="bg-white fixed w-full z-50 top-0 start-0 border-b border-gray-200">
      <div className="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-3">
        <a href="/" className="flex items-center space-x-3 rtl:space-x-reverse">
          {/* <video autoPlay muted playsInline className="h-14 w-14 md:h-16 md:w-16">
            <source src={logoAnimation} type="video/webm" />
          </video> */}
          <Image
            src={logo}
            loading={"eager"}
            className="h-14 w-14 md:h-16 md:w-16"
            alt="SBI Logo"
          />
        </a>

        <button
          onClick={() => setOpen((prev) => !prev)}
          type="button"
          className="inline-flex items-center p-4 w-12 h-12 justify-center text-sm text-gray-500 rounded-lg md:hidden hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-gray-100"
          aria-controls="navbar-sticky"
          aria-expanded={open}
        >
          <span className="sr-only">Open main menu</span>
          {/* Hamburger Icon */}
          {!open && (
            <svg
              className="w-5 h-5 transition-all duration-300"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 17 14"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M1 1h15M1 7h15M1 13h15"
              ></path>
            </svg>
          )}
          {/* X Icon */}
          {open && (
            <svg
              className="w-10 h-10 transition-all duration-300"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          )}
        </button>

        {/* Mobile Menu */}
        <div
          ref={menuRef}
          className={`absolute top-full left-0 w-full md:hidden transition-all duration-300 ${
            open
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 -translate-y-full pointer-events-none"
          }`}
        >
          <div className="flex justify-center bg-white p-3">
            <div className="p-4 w-[100%] border-gray-100 bg-gray-50 rounded-lg">
              <ul className="flex flex-col space-y-2">
                {navItems.map((item) => (
                  <li key={item.name}>
                    <a
                      href={item.href}
                      className="block py-2 px-3 text-gray-900 rounded hover:bg-gray-100 text-xl font-OldStandardTT"
                    >
                      {item.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Desktop Menu */}
        <div className="items-end justify-between hidden w-full md:flex md:w-auto">
          <ul className="flex flex-col p-4 md:p-0 mt-4 border border-gray-100 rounded-lg bg-gray-50 md:space-x-8 rtl:space-x-reverse md:flex-row md:mt-0 md:border-0 md:bg-white">
            {navItems.map((item) => (
              <li key={item.name}>
                <a
                  href={item.href}
                  className="block py-2 px-3 text-gray-900 rounded hover:bg-gray-100 md:hover:bg-transparent hover:underline md:p-0 md:text-black text-xl font-OldStandardTT"
                >
                  {item.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
