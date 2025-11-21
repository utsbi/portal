"use client";

import { Burger } from "@mantine/core";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import NavLink from "./nav-link";

const navItems = [
	// { name: "Home", href: "/" },
	{ name: "ABOUT", href: "/about/" },
	{ name: "OUTREACH", href: "/outreach/" },
	{ name: "PROJECTS", href: "/projects/" },
	{ name: "CONTACT US", href: "/contact/" },
	{ name: "LOGIN", href: "/login/" }, // TODO: make login button special
];

function Navbar() {
	const [open, setOpen] = useState(false);
	const [visible, setVisible] = useState(true);
	const [scrolled, setScrolled] = useState(false);
	const [lastScrollY, setLastScrollY] = useState(0);
	const menuRef = useRef<HTMLDivElement>(null);

	const toggleMenu = () => {
		setOpen((prev) => !prev);
	};

	// Handle scroll to show/hide navbar
	useEffect(() => {
		const handleScroll = () => {
			const currentScrollY = window.scrollY;

			if (currentScrollY < lastScrollY || currentScrollY < 10) {
				// Scrolling up or at top - show navbar
				setVisible(true);
			} else if (currentScrollY > lastScrollY && currentScrollY > 100) {
				// Scrolling down and past threshold - hide navbar
				setVisible(false);
			}

			setScrolled(currentScrollY > 0);
			setLastScrollY(currentScrollY);
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, [lastScrollY]);

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
		<motion.nav
			className={`fixed w-full z-50 top-0 start-0 transition-colors duration-300 ${
				scrolled ? "bg-white shadow-md" : "bg-transparent"
			}`}
			initial={{ y: 0 }}
			animate={{ y: visible ? 0 : "-100%" }}
			transition={{
				duration: 0.3,
				ease: "easeInOut",
			}}
		>
			<div className="max-w-7xl flex flex-wrap items-center justify-between mx-auto px-6 py-8">
				<Link
					href="/"
					className="flex items-center space-x-3 rtl:space-x-reverse"
				>
					{/* <Image
						src={logo}
						loading={"eager"}
						className="h-14 w-14 md:h-16 md:w-16"
						alt="SBI Logo"
						width={logo.width}
						height={logo.height}
						priority
						unoptimized
					/> */}
					<div
						className={`text-4xl transition-colors duration-300 font-bold ${
							scrolled ? "text-black" : "text-white"
						}`}
					>
						SBI
					</div>
				</Link>

				<div className="md:hidden flex items-center">
					<Burger
						opened={open}
						onClick={toggleMenu}
						aria-label="Toggle navigation"
						size="md"
						color={scrolled ? "black" : "white"}
					/>
				</div>

				{/* Mobile Menu */}
				{/* <div */}
				{/* 	ref={menuRef} */}
				{/* 	className={`absolute top-full left-0 w-full md:hidden transition-all duration-300 ${ */}
				{/* 		open */}
				{/* 			? "opacity-100 translate-y-0 pointer-events-auto" */}
				{/* 			: "opacity-0 -translate-y-full pointer-events-none" */}
				{/* 	}`} */}
				{/* > */}
				{/* 	<div className="flex justify-center bg-white p-3"> */}
				{/* 		<div className="p-4 w-full border-gray-100 bg-gray-50 rounded-lg"> */}
				{/* 			<ul className="flex flex-col space-y-2"> */}
				{/* 				{navItems.map((item) => ( */}
				{/* 					<li key={item.name}> */}
				{/* 						<a */}
				{/* 							href={item.href} */}
				{/* 							className="block py-2 px-3 text-gray-900 rounded hover:bg-gray-100 text-xl font-OldStandardTT" */}
				{/* 						> */}
				{/* 							{item.name} */}
				{/* 						</a> */}
				{/* 					</li> */}
				{/* 				))} */}
				{/* 			</ul> */}
				{/* 		</div> */}
				{/* 	</div> */}
				{/* </div> */}

				{/* Desktop Menu */}
				<div className="items-end justify-between hidden w-full md:flex md:w-auto">
					<ul className="flex flex-col p-4 md:p-0 mt-4 border border-gray-100 rounded-lg md:space-x-12 rtl:space-x-reverse md:flex-row md:mt-0 md:border-0 ">
						{navItems.map((item) => (
							<li key={item.name}>
								<NavLink name={item.name} href="" scrolled={scrolled} />
							</li>
						))}
					</ul>
				</div>
			</div>
		</motion.nav>
	);
}

export default Navbar;
