"use client";

import { Burger } from "@mantine/core";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import logo from "@/assets/logos/logo.gif";

const navItems = [
	// { name: "Home", href: "/" },
	{ name: "ABOUT", href: "/about/" },
	{ name: "OUTREACH", href: "/outreach/" },
	{ name: "PROJECTS", href: "/projects/" },
	{ name: "CONTACT US", href: "/contact/" },
	{ name: "LOGIN", href: "/login/" }, // TODO: make login button special
];

const letterContainerVariants = {
	initial: {
		transition: {
			staggerChildren: 0.02,
			staggerDirection: -1,
		},
	},
	hover: {
		transition: {
			staggerChildren: 0.01,
		},
	},
};

const letterVariants = {
	initial: {
		y: 0,
		transition: {
			duration: 0.2,
		},
	},
	hover: {
		y: "-1.5em",
		transition: {
			duration: 0.2,
		},
	},
};

function Navbar() {
	const [open, setOpen] = useState(false);
	const [visible, setVisible] = useState(true);
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
			className="fixed w-full z-50 top-0 start-0"
			initial={{ y: 0 }}
			animate={{ y: visible ? 0 : -100 }}
			transition={{
				duration: 0.3,
				ease: "easeInOut",
			}}
		>
			<div className="max-w-7xl flex flex-wrap items-center justify-between mx-auto p-6">
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
						unoptimized
					/>
				</Link>

				<div className="md:hidden flex items-center">
					<Burger
						opened={open}
						onClick={toggleMenu}
						aria-label="Toggle navigation"
						size="md"
						color="white"
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
								<Link
									// href={item.href}
									href=""
									className="flex items-center gap-2 py-2 px-3 text-white rounded md:p-0 text-lg"
								>
									<span className="w-3 h-3 rounded-full bg-white" />
									<motion.span
										className="inline-flex"
										variants={letterContainerVariants}
										initial="initial"
										whileHover="hover"
									>
										{item.name.split("").map((char, index) => (
											<motion.span
												key={`${item.name}-${index}`}
												className={`relative overflow-hidden ${char === " " ? "w-2" : ""}`}
												style={{
													display: "inline-block",
													height: "1.5em",
												}}
											>
												<motion.span
													variants={letterVariants}
													className="block"
													style={{
														lineHeight: "1.5em",
													}}
												>
													{char}
												</motion.span>
												<motion.span
													variants={letterVariants}
													className="block absolute inset-0"
													style={{
														top: "1.5em",
														lineHeight: "1.5em",
													}}
												>
													{char}
												</motion.span>
											</motion.span>
										))}
									</motion.span>
								</Link>
							</li>
						))}
					</ul>
				</div>
			</div>
		</motion.nav>
	);
}

export default Navbar;
