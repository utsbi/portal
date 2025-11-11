"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";
import { gridImages } from "./background-images";

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
	const [imagesLoaded, setImagesLoaded] = useState(0);
	const totalImages = gridImages.length;
	// Start animation when 50% loaded
	const shouldAnimate = imagesLoaded >= Math.ceil(totalImages * 0.5);

	const handleImageLoad = () => {
		setImagesLoaded((prev) => prev + 1);
	};

	return (
		<div className="fixed inset-0 w-full h-screen overflow-hidden bg-[#181718]">
			<motion.div
				className="w-full h-full grid gap-1 p-1"
				style={{
					gridTemplateColumns: "repeat(9, 1fr)",
					gridTemplateRows: "repeat(5, 1fr)",
				}}
				variants={containerVariants}
				initial="hidden"
				animate={shouldAnimate ? "visible" : "hidden"}
			>
				{gridImages.map((img) => (
					<motion.div
						key={img.id}
						className="relative overflow-hidden bg-gray-200 border-2 md:border-2 border-gray-800"
						style={{
							gridArea: img.gridArea,
							willChange: "transform, opacity",
						}}
						variants={itemVariants}
					>
						<Image
							src={img.src}
							alt={`Grid image ${img.id}`}
							fill
							className="object-cover"
							sizes={img.sizes}
							quality={70}
							priority={img.priority}
							placeholder="blur"
							onLoad={handleImageLoad}
						/>
					</motion.div>
				))}
			</motion.div>
		</div>
	);
}
