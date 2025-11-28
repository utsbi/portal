"use client";

import { motion, type Variants } from "motion/react";
import Link from "next/link";

interface NavLinkProps {
	name: string;
	href: string;
	scrolled: boolean;
}

const letterContainerVariants: Variants = {
	initial: {
		transition: {
			staggerChildren: 0.02,
			staggerDirection: -1,
		},
	},
	hover: {
		transition: {
			staggerChildren: 0.015,
		},
	},
};

const letterVariants: Variants = {
	initial: {
		y: 0,
		transition: {
			duration: 0.25,
			ease: "easeOut",
		},
	},
	hover: {
		y: "-1.4em",
		transition: {
			duration: 0.25,
			ease: "easeOut",
		},
	},
};

export default function NavLink({
	name,
	href,
}: Omit<NavLinkProps, "scrolled">) {
	const isLogin = name === "LOGIN";

	if (isLogin) {
		return (
			<Link
				href={href}
				className="relative px-4 py-2 text-xs tracking-[0.2em] uppercase text-sbi-green border border-sbi-green/30 hover:bg-sbi-green hover:text-sbi-dark transition-all duration-300"
			>
				{name}
			</Link>
		);
	}

	return (
		<Link
			href={href}
			className="group flex items-center gap-3 py-2 px-3 md:p-0 text-xs tracking-[0.2em] uppercase text-sbi-muted hover:text-white transition-colors duration-300"
		>
			<motion.span
				className="inline-flex overflow-hidden"
				variants={letterContainerVariants}
				initial="initial"
				whileHover="hover"
			>
				{name.split("").map((char, index) => (
					<motion.span
						// biome-ignore lint/suspicious/noArrayIndexKey: Index is required for unique keys on duplicate characters
						key={`${name}-${index}`}
						className={`relative overflow-hidden ${char === " " ? "w-1.5" : ""}`}
						style={{
							display: "inline-block",
							height: "1.4em",
						}}
					>
						<motion.span
							variants={letterVariants}
							className="block text-sbi-muted group-hover:text-white transition-colors"
							style={{
								lineHeight: "1.4em",
							}}
						>
							{char}
						</motion.span>
						<motion.span
							variants={letterVariants}
							className="block absolute inset-0 text-sbi-green"
							style={{
								top: "1.4em",
								lineHeight: "1.4em",
							}}
						>
							{char}
						</motion.span>
					</motion.span>
				))}
			</motion.span>
		</Link>
	);
}
