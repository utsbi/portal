"use client";

import type { LucideIcon } from "lucide-react";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import { useRef } from "react";

export interface StrategyItem {
	num: string;
	title: string;
	subtitle: string;
	description: string;
	icon: LucideIcon;
}

interface StrategyCardProps {
	item: StrategyItem;
	index: number;
}

// Strategy card with reveal animation
export function StrategyCard({ item, index }: StrategyCardProps) {
	const ref = useRef<HTMLDivElement>(null);
	const mouseX = useMotionValue(0);
	const mouseY = useMotionValue(0);

	const handleMouseMove = (e: React.MouseEvent) => {
		if (!ref.current) return;
		const rect = ref.current.getBoundingClientRect();
		mouseX.set(e.clientX - rect.left);
		mouseY.set(e.clientY - rect.top);
	};

	return (
		<motion.div
			ref={ref}
			initial={{ opacity: 0, y: 60 }}
			whileInView={{ opacity: 1, y: 0 }}
			transition={{
				delay: index * 0.15,
				duration: 0.8,
				ease: [0.22, 1, 0.36, 1],
			}}
			viewport={{ once: true, margin: "-100px" }}
			onMouseMove={handleMouseMove}
			className="group relative"
		>
			{/* Glow effect */}
			<motion.div
				className="absolute -inset-px rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
				style={{
					background: useMotionTemplate`
						radial-gradient(
							400px circle at ${mouseX}px ${mouseY}px,
							rgba(45, 212, 191, 0.08),
							transparent 70%
						)
					`,
				}}
			/>

			<div className="relative h-full p-8 md:p-10 bg-sbi-dark-card border border-sbi-dark-border hover:border-sbi-green/30 transition-colors duration-500">
				{/* Number */}
				<div className="absolute top-6 right-6 text-6xl md:text-7xl font-thin text-sbi-dark-border select-none tracking-tighter">
					{item.num}
				</div>

				{/* Icon */}
				<div className="mb-6 w-12 h-12 flex items-center justify-center border border-sbi-green/30 text-sbi-green">
					<item.icon className="w-5 h-5" strokeWidth={1.5} />
				</div>

				{/* Content */}
				<h3 className="text-2xl md:text-3xl font-light text-white mb-1 tracking-tight">
					{item.title}
				</h3>
				<p className="text-lg text-sbi-green/70 mb-4 font-light italic">
					{item.subtitle}
				</p>
				<p className="text-sbi-muted leading-relaxed text-sm">
					{item.description}
				</p>

				{/* Bottom line */}
				<motion.div
					className="absolute bottom-0 left-0 h-0.5 bg-sbi-green"
					initial={{ width: 0 }}
					whileInView={{ width: "100%" }}
					transition={{
						delay: 0.5 + index * 0.2,
						duration: 0.8,
						ease: [0.22, 1, 0.36, 1],
					}}
					viewport={{ once: true }}
				/>
			</div>
		</motion.div>
	);
}
