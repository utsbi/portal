"use client";

import { AnimatePresence, motion } from "motion/react";

export interface Department {
	name: string;
	description: string[];
}

interface DepartmentItemProps {
	dept: Department;
	index: number;
	isExpanded: boolean;
	onToggle: () => void;
}

// Department accordion item
export function DepartmentItem({
	dept,
	index,
	isExpanded,
	onToggle,
}: DepartmentItemProps) {
	return (
		<motion.div
			initial={{ opacity: 0, x: -30 }}
			whileInView={{ opacity: 1, x: 0 }}
			transition={{
				delay: index * 0.1,
				duration: 0.6,
				ease: [0.22, 1, 0.36, 1],
			}}
			viewport={{ once: true }}
			className="border-b border-sbi-dark-border last:border-b-0"
		>
			<motion.button
				type="button"
				onClick={onToggle}
				className="w-full py-6 flex items-center justify-between group text-left"
				whileHover={{ x: 8 }}
				transition={{ type: "spring", stiffness: 400, damping: 25 }}
			>
				<span className="text-2xl md:text-3xl font-light text-sbi-muted group-hover:text-white transition-colors duration-300">
					{dept.name}
				</span>
				<motion.div
					animate={{ rotate: isExpanded ? 45 : 0 }}
					transition={{ duration: 0.3, ease: "easeOut" }}
					className="w-8 h-8 flex items-center justify-center border border-sbi-green/30 text-sbi-green"
				>
					<span className="text-lg font-light">+</span>
				</motion.div>
			</motion.button>

			<AnimatePresence>
				{isExpanded && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: "auto", opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
						className="overflow-hidden"
					>
						<ul className="pb-6 pl-1 space-y-2">
							{dept.description.map((item, i) => (
								<li key={i} className="flex items-start gap-3 text-sbi-muted-dark leading-relaxed">
									<span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-sbi-green/50" />
									{item}
								</li>
							))}
						</ul>
					</motion.div>
				)}
			</AnimatePresence>
		</motion.div>
	);
}
