"use client";

import { Moon, Sun } from "lucide-react";
import { motion } from "motion/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	// Avoid hydration mismatch
	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		return (
			<div className="w-10 h-10 flex items-center justify-center">
				<div className="w-5 h-5 rounded-full bg-sbi-dark-border dark:bg-sbi-dark-border animate-pulse" />
			</div>
		);
	}

	const isDark = resolvedTheme === "dark";

	return (
		<motion.button
			type="button"
			onClick={() => setTheme(isDark ? "light" : "dark")}
			className="relative w-10 h-10 flex items-center justify-center rounded-full border border-sbi-light-border dark:border-sbi-dark-border bg-transparent hover:bg-sbi-green/10 transition-colors group"
			whileHover={{ scale: 1.05 }}
			whileTap={{ scale: 0.95 }}
			aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
		>
			{/* Sun icon */}
			<motion.div
				className="absolute"
				initial={false}
				animate={{
					scale: isDark ? 0 : 1,
					rotate: isDark ? -90 : 0,
					opacity: isDark ? 0 : 1,
				}}
				transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
			>
				<Sun className="w-5 h-5 text-sbi-green" />
			</motion.div>

			{/* Moon icon */}
			<motion.div
				className="absolute"
				initial={false}
				animate={{
					scale: isDark ? 1 : 0,
					rotate: isDark ? 0 : 90,
					opacity: isDark ? 1 : 0,
				}}
				transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
			>
				<Moon className="w-5 h-5 text-sbi-green" />
			</motion.div>

			{/* Hover ring effect */}
			<motion.div
				className="absolute inset-0 rounded-full border border-sbi-green opacity-0 group-hover:opacity-50"
				initial={false}
				whileHover={{ scale: 1.1 }}
				transition={{ duration: 0.2 }}
			/>
		</motion.button>
	);
}

export default ThemeToggle;
