"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { gridImages, towerDay, towerNight } from "./background-images";

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.07,
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

export function Background({
	startAnimation = true,
}: {
	startAnimation?: boolean;
}) {
	const [imagesLoaded, setImagesLoaded] = useState(0);
	const [mounted, setMounted] = useState(false);
	const { resolvedTheme } = useTheme();
	const totalImages = gridImages.length;
	// Start animation when 50% loaded AND startAnimation is true
	const shouldAnimate =
		startAnimation && imagesLoaded >= Math.ceil(totalImages * 0.1);

	// Wait for component to mount before using theme
	useEffect(() => {
		setMounted(true);
	}, []);

	// Use resolvedTheme to get actual theme (handles "system" preference)
	// Default to dark during SSR to match initial render
	const isDarkMode = mounted ? resolvedTheme === "dark" : true;

	const handleImageLoad = () => {
		setImagesLoaded((prev) => prev + 1);
	};

	// Get the correct image source based on dark mode
	const getImageSrc = (img: (typeof gridImages)[0]) => {
		if (img.id === 8) {
			return isDarkMode ? towerNight : towerDay;
		}
		return img.src;
	};

	return (
		<div className="fixed inset-0 w-full h-screen overflow-hidden bg-[#181718] select-none">
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
						className="relative overflow-hidden bg-gray-200 border-2 border-gray-800"
						style={{
							gridArea: img.gridArea,
							willChange: "transform, opacity",
						}}
						variants={itemVariants}
					>
						<Image
							src={getImageSrc(img)}
							alt={`Grid image ${img.id}`}
							fill
							className="object-cover"
							sizes={img.sizes}
							quality={70}
							priority={img.priority}
							placeholder="blur"
							onLoad={handleImageLoad}
							draggable={false}
						/>
					</motion.div>
				))}
			</motion.div>
		</div>
	);
}
