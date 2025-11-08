"use client";

import { motion } from "motion/react";
import Image from "next/image";

const gridImages = [
	{ id: 1, width: 100, height: 100, gridArea: "1 / 1 / 4 / 2" },
	{ id: 2, width: 100, height: 100, gridArea: "1 / 2 / 2 / 3" },
	{ id: 3, width: 100, height: 100, gridArea: "1 / 3 / 2 / 6" },
	{ id: 4, width: 100, height: 100, gridArea: "1 / 6 / 2 / 7" },
	{ id: 5, width: 100, height: 100, gridArea: "1 / 7 / 2 / 8" },
	{ id: 6, width: 100, height: 100, gridArea: "1 / 8 / 3 / 10" },
	{ id: 7, width: 100, height: 100, gridArea: "2 / 2 / 3 / 4" },

	// center image
	{ id: 8, width: 300, height: 300, gridArea: "2 / 4 / 5 / 7" },

	{ id: 9, width: 300, height: 200, gridArea: "2 / 7 / 4 / 8" },
	{ id: 10, width: 250, height: 250, gridArea: "3 / 8 / 4 / 9" },
	{ id: 11, width: 600, height: 600, gridArea: "3 / 2 / 4 / 3" },
	{ id: 12, width: 350, height: 300, gridArea: "3 / 3 / 5 / 3" },
	{ id: 13, width: 300, height: 250, gridArea: "3 / 9 / 6 / 10" },
	{ id: 19, width: 300, height: 200, gridArea: "4 / 7 / 5 / 9" },
	{ id: 14, width: 300, height: 250, gridArea: "4 / 1 / 6 / 3" },
	{ id: 15, width: 300, height: 200, gridArea: "5 / 3 / 6 / 4" },
	{ id: 16, width: 400, height: 300, gridArea: "5 / 4 / 6 / 5" },
	{ id: 17, width: 300, height: 200, gridArea: "5 / 5 / 6 / 8" },
	{ id: 18, width: 400, height: 300, gridArea: "5 / 8 / 6 / 9" },
];

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.08,
			delayChildren: 0.2,
		},
	},
};

const itemVariants = {
	hidden: {
		opacity: 0,
		scale: 0.8,
	},
	visible: {
		opacity: 1,
		scale: 1,
		transition: {
			duration: 0.5,
		},
	},
};

export default function Background() {
	return (
		<div className="fixed inset-0 w-full h-screen overflow-hidden bg-[#181718]">
			<motion.div
				className="w-full h-full grid gap-2 md:gap-1 p-2 md:p-2"
				style={{
					gridTemplateColumns: "repeat(9, 1fr)",
					gridTemplateRows: "repeat(5, 1fr)",
				}}
				variants={containerVariants}
				initial="hidden"
				animate="visible"
			>
				{gridImages.map((img) => (
					<motion.div
						key={img.id}
						className="relative overflow-hidden bg-gray-200 border-2 md:border-2 border-gray-800"
						style={{ gridArea: img.gridArea }}
						variants={itemVariants}
					>
						<Image
							src={`https://picsum.photos/seed/${img.id}/${img.width}/${img.height}`}
							alt={`Grid image ${img.id}`}
							fill
							className="object-cover"
							// sizes="(max-width: 768px) 50vw, 25vw"
							// priority={img.id === 11} // Priority for center image
						/>
					</motion.div>
				))}
			</motion.div>
		</div>
	);
}
