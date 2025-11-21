"use client";

import { motion } from "motion/react";
import Link from "next/link";

interface NavLinkProps {
	name: string;
	href: string;
	scrolled: boolean;
}

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

export default function NavLink({ name, href, scrolled }: NavLinkProps) {
	return (
		<Link
			href={href}
			className={`flex items-center gap-2 py-2 px-3 rounded md:p-0 text-lg transition-colors duration-300 ${
				scrolled ? "text-black" : "text-white"
			}`}
		>
			<span
				className={`w-3 h-3 rounded-full transition-colors duration-300 ${
					scrolled ? "bg-black" : "bg-white"
				}`}
			/>
			<motion.span
				className="inline-flex"
				variants={letterContainerVariants}
				initial="initial"
				whileHover="hover"
			>
				{name.split("").map((char, index) => (
					<motion.span
						// biome-ignore lint/suspicious/noArrayIndexKey: Index is required for unique keys on duplicate characters
						key={`${name}-${index}`}
						className={`relative overflow-hidden ${char === " " ? "w-2" : ""}`}
						style={{
							display: "inline-block",
							height: "1.2em",
						}}
					>
						<motion.span
							variants={letterVariants}
							className="block"
							style={{
								lineHeight: "1.2em",
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
	);
}
