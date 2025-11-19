"use client";

import { motion, type Variants } from "motion/react";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import group from "@/assets/images/group.jpg";
import Background from "@/components/v2/background";
import { urbanist } from "@/utils/fonts";

const departments = [
	"Engineering",
	"Business",
	"Tech",
	"Public Relations",
	"Research & Development",
	"Architecture",
	"Legal",
];

const containerVariants: Variants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.1,
		},
	},
};

const itemVariants: Variants = {
	hidden: { opacity: 0, y: 20 },
	visible: {
		opacity: 1,
		y: 0,
		transition: {
			duration: 0.5,
			ease: "easeOut",
		},
	},
};

export default function V2Page() {
	return (
		<div className={`${urbanist.className}`}>
			{/* Main section */}
			<section className="relative h-screen w-full">
				<div
					className="absolute text-white top-1/2 left-1/2 sm:left-[40%] -translate-x-1/2 -translate-y-1/2 animate-title z-10"
					style={{ pointerEvents: "none" }}
				>
					<div
						className="text-6xl sm:text-7xl"
						style={{ pointerEvents: "auto" }}
					>
						<span className="text-green-500">S</span>ustainable
					</div>
					<div
						className="text-6xl sm:text-7xl"
						style={{ pointerEvents: "auto" }}
					>
						<span className="text-green-500">B</span>uilding
					</div>
					<div
						className="text-6xl sm:text-7xl"
						style={{ pointerEvents: "auto" }}
					>
						<span className="text-green-500">I</span>nitiative
					</div>
					<div
						className="pl-1 text-base sm:text-lg"
						style={{ pointerEvents: "auto" }}
					>
						Research Driven, Professionally Inspired, and Student Powered
					</div>
					<div
						className="pl-1 pt-6 flex flex-col sm:flex-row sm:space-x-4"
						style={{ pointerEvents: "auto" }}
					>
						<Link
							href="https://utsbi.org"
							className="mb-3 sm:mb-0"
							target="_blank"
							rel="noopener"
						>
							<button
								type="button"
								className="bg-green-500 hover:bg-transparent text-white-700 hover:text-white transition duration-300 py-2 px-6 border border-green-500 hover:border-green-500 rounded"
							>
								Join Us
							</button>
						</Link>
						<Link href="/about">
							<button
								type="button"
								className="bg-transparent hover:bg-green-500 text-white-700 hover:text-white transition duration-300 py-2 px-6 border border-green-500 hover:border-transparent rounded"
							>
								What We're About
							</button>
						</Link>
					</div>
				</div>
				<div className="brightness-50">
					<Background />
				</div>
			</section>

			{/* Departments section */}
			<section className="relative z-20 bg-white min-h-screen">
				<div className="max-w-7xl mx-auto flex flex-row gap-4 min-h-screen">
					<div className="w-1/3 bg-gray-100 p-4">some cool animation here?</div>
					<div className="w-2/3 p-4 flex flex-col justify-center pl-12">
						<div className="text-5xl pb-4 font-light">
							Research Driven, Professionally Inspired, and Student Powered
						</div>
						<div className="text-4xl py-4 font-medium text-gray-800">
							Our departments
						</div>
						<motion.div
							variants={containerVariants}
							initial="hidden"
							whileInView="visible"
							viewport={{ once: true, margin: "-100px" }}
							className="flex flex-col"
						>
							<div className="border-t-[1.5px] border-gray-300" />
							{departments.map((dept) => (
								<motion.div key={dept} variants={itemVariants}>
									<motion.div
										className="flex flex-row justify-between items-center py-4 cursor-pointer group hover:bg-gray-50 transition-colors duration-300 px-2"
										whileHover={{ x: 10 }}
									>
										<div className="text-3xl font-medium text-gray-500 group-hover:text-green-600 transition-colors">
											{dept}
										</div>
										<div className="flex items-center text-gray-400 group-hover:text-green-600 transition-colors">
											<ArrowRight className="w-8 h-8" />
										</div>
									</motion.div>
									<div className="border-t-[1.5px] border-gray-300" />
								</motion.div>
							))}
						</motion.div>
					</div>
				</div>
			</section>
		</div>
	);
}
