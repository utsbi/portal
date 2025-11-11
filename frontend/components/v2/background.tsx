"use client";

import { motion } from "motion/react";
import Image from "next/image";
import {
	austinNightWide,
	blanton,
	blantonNightArt,
	bridge,
	buildingWithOrangeBig,
	clockKnotGreenery,
	dkrStadiumDay,
	dkrStadiumNight,
	eerNight,
	eerRightSide,
	rlmHallway,
	rlpBridgeCenter,
	rlpBridgeGreenery,
	rlpBridgeOffset,
	rlpNight,
	towerDay,
	towerTopDay,
	wcpGreeneryDay,
	welStairs,
} from "./background-images";

const gridImages = [
	{ id: 14, gridArea: "4 / 1 / 6 / 3", src: eerNight },
	{ id: 17, gridArea: "5 / 5 / 6 / 8", src: austinNightWide },
	{ id: 15, gridArea: "5 / 3 / 6 / 4", src: dkrStadiumNight },
	{ id: 16, gridArea: "5 / 4 / 6 / 5", src: eerRightSide },
	{ id: 13, gridArea: "3 / 9 / 6 / 10", src: rlmHallway },
	{ id: 18, gridArea: "5 / 8 / 6 / 9", src: wcpGreeneryDay },
	{ id: 12, gridArea: "3 / 3 / 5 / 3", src: bridge },
	{ id: 19, gridArea: "4 / 7 / 5 / 9", src: clockKnotGreenery },
	{ id: 8, gridArea: "2 / 4 / 5 / 7", src: towerDay },
	{ id: 10, gridArea: "3 / 8 / 4 / 9", src: welStairs },
	{ id: 9, gridArea: "2 / 7 / 4 / 8", src: blanton },
	{ id: 1, gridArea: "1 / 1 / 4 / 2", src: rlpBridgeCenter },
	{ id: 11, gridArea: "3 / 2 / 4 / 3", src: blantonNightArt },
	{ id: 7, gridArea: "2 / 2 / 3 / 4", src: buildingWithOrangeBig },
	{ id: 6, gridArea: "1 / 8 / 3 / 10", src: rlpNight },
	{ id: 2, gridArea: "1 / 2 / 2 / 3", src: towerTopDay },
	{ id: 3, gridArea: "1 / 3 / 2 / 6", src: rlpBridgeGreenery },
	{ id: 4, gridArea: "1 / 6 / 2 / 7", src: rlpBridgeOffset },
	{ id: 5, gridArea: "1 / 7 / 2 / 8", src: dkrStadiumDay },
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
				className="w-full h-full grid gap-1 p-1"
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
							src={img.src}
							alt={`Grid image ${img.id}`}
							fill
							className="object-cover"
							priority
						/>
					</motion.div>
				))}
			</motion.div>
		</div>
	);
}
