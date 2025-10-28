"use client";

import { Burger } from "@mantine/core";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import logo from "@/assets/logos/logo.gif";

const navItems = [
  { name: "Home", href: "/" },
  { name: "About", href: "/about/" },
  { name: "About Me", href: "/about_me/" },
  { name: "Outreach", href: "/outreach/" },
  { name: "Projects", href: "/projects/" },
  { name: "Contact Us", href: "/contact/" },
  { name: "Login", href: "/login/" }, // TODO: make login button special
];

function Navbar() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const toggleMenu = () => {
    setOpen((prev) => !prev);
  };

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
        <Link
          href="/"
          className="flex items-center space-x-3 rtl:space-x-reverse"
        >
          <Image
            src={logo}
            loading={"eager"}
            className="h-14 w-14 md:h-16 md:w-16"
            alt="SBI Logo"
            width={logo.width}
            height={logo.height}
            priority
          />
        </Link>

        <div className="md:hidden flex items-center">
          <Burger
            opened={open}
            onClick={toggleMenu}
            aria-label="Toggle navigation"
            size="md"
          />
        </div>

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
                <Link
                  href={item.href}
                  className="block py-2 px-3 text-gray-900 rounded hover:bg-gray-100 md:hover:bg-transparent hover:underline md:p-0 md:text-black text-xl font-OldStandardTT"
                >
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
