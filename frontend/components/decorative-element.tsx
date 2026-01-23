"use client";

import { motion } from "motion/react";

// Interactive decorative element for the departments section
export function DecorativeElement() {
	return (
		<motion.div
			initial="hidden"
			whileInView="visible"
			whileHover="hover"
			viewport={{ once: true }}
			variants={{
				hidden: { opacity: 0, scale: 0.8 },
				visible: {
					opacity: 1,
					scale: 1,
					transition: { delay: 0.3, duration: 0.8 },
				},
				hover: { scale: 1.05 },
			}}
			className="hidden lg:block relative w-64 h-64 mt-12 cursor-pointer"
		>
			{/* Squares */}
			<motion.div
				className="absolute inset-0 border border-sbi-dark-border"
				variants={{
					hidden: { rotate: 45 },
					visible: { rotate: 45 },
					hover: {
						rotate: 55,
						borderColor: "rgba(45, 212, 191, 0.3)",
					},
				}}
				transition={{ type: "spring", stiffness: 300, damping: 20 }}
			/>
			<motion.div
				className="absolute inset-4 border border-sbi-green/20"
				variants={{
					hidden: { rotate: 45 },
					visible: { rotate: 45 },
					hover: {
						rotate: 35,
						borderColor: "rgba(45, 212, 191, 0.4)",
					},
				}}
				transition={{ type: "spring", stiffness: 250, damping: 20 }}
			/>
			<motion.div
				className="absolute inset-8 border border-sbi-green/10"
				variants={{
					hidden: { rotate: 45 },
					visible: { rotate: 45 },
					hover: {
						rotate: 55,
						borderColor: "rgba(45, 212, 191, 0.5)",
					},
				}}
				transition={{ type: "spring", stiffness: 200, damping: 20 }}
			/>

			{/* Rotating center */}
			<motion.div
				className="absolute inset-0 flex items-center justify-center"
				animate={{ rotate: 360 }}
				transition={{
					duration: 30,
					repeat: Infinity,
					ease: "linear",
				}}
			>
				<motion.div
					className="w-2 h-2 bg-sbi-green rounded-full"
					variants={{
						visible: { scale: 1 },
						hover: {
							scale: 3,
							boxShadow: "0 0 20px rgba(45, 212, 191, 0.6)",
						},
					}}
					transition={{
						type: "spring",
						stiffness: 400,
						damping: 15,
					}}
				/>
			</motion.div>

			{/* Expanding rings on hover */}
			<motion.div className="absolute inset-0 flex items-center justify-center pointer-events-none">
				<motion.div
					className="w-4 h-4 border border-sbi-green/0 rounded-full"
					variants={{
						visible: { scale: 1, opacity: 0 },
						hover: {
							scale: 8,
							opacity: [0, 0.3, 0],
							borderColor: "rgba(45, 212, 191, 0.5)",
							transition: { duration: 1.5, repeat: Infinity },
						},
					}}
				/>
			</motion.div>
		</motion.div>
	);
}
