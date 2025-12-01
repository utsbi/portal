"use client";

import { Compass, Layers, Target } from "lucide-react";
import { AnimatePresence, motion, useScroll, useTransform } from "motion/react";
import Image from "next/image";
import { useRef, useState } from "react";

import group from "@/assets/images/group.jpg";
import { Background } from "@/components/v2/background";
import { BlueprintGrid } from "@/components/v2/blueprint-grid";
import { Counter } from "@/components/v2/counter";
import { DecorativeElement } from "@/components/v2/decorative-element";
import { DepartmentItem } from "@/components/v2/department-item";
import { LoadingScreen } from "@/components/v2/loading-screen";
import { MagneticButton } from "@/components/v2/magnetic-button";
import { StrategyCard } from "@/components/v2/strategy-card";

const FORMS_LINK = "https://forms.gle/KWJjaXGYt2dv3bY68";

const stats = [
	{
		value: 25,
		label: "Project Portfolio",
		prefix: "$",
		suffix: "M+",
		description:
			"Professional-grade sustainable solutions delivered across diverse project scopes.",
	},
	{
		value: 50,
		label: "Student Members",
		prefix: "",
		suffix: "+",
		description:
			"Multidisciplinary talents from engineering, business, and technology converging as one consultancy.",
	},
	{
		value: 1000,
		label: "Hours Contributed",
		prefix: "",
		suffix: "+",
		description:
			"Expertise dedicated to innovative designs serving our community.",
	},
];

const strategy = [
	{
		num: "01",
		title: "Identify",
		subtitle: "the Opportunity",
		description:
			"We assess infrastructure challenges to find opportunities where sustainable design can deliver the greatest impact for our clients and community.",
		icon: Target,
	},
	{
		num: "02",
		title: "Architect",
		subtitle: "the Solution",
		description:
			"Our teams fuse client vision with cutting-edge, sustainable practices to design practical, personalized solutions.",
		icon: Compass,
	},
	{
		num: "03",
		title: "Execute",
		subtitle: "with Precision",
		description:
			"We take a hands-on approach to implementation, delivering projects on time and to the highest professional standard.",
		icon: Layers,
	},
];

const departments = [
	{
		name: "Engineering",
		description:
			"Structural analysis, MEP systems, and sustainable infrastructure design.",
	},
	{
		name: "Architecture",
		description: "Conceptual design, 3D modeling, and spatial planning.",
	},
	{
		name: "Business",
		description:
			"Project management, client relations, and strategic planning.",
	},
	{
		name: "Technology",
		description:
			"Building information modeling, energy simulations, and digital tools.",
	},
	{
		name: "Research & Development",
		description:
			"Material science, sustainability metrics, and innovation labs.",
	},
	{
		name: "Public Relations",
		description: "Community engagement, outreach, and partnership development.",
	},
];

export default function V2Page() {
	const [isLoading, setIsLoading] = useState(true);
	const [showContent, setShowContent] = useState(false);
	const [expandedDept, setExpandedDept] = useState<string | null>(null);
	const heroRef = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({
		target: heroRef,
		offset: ["start start", "end start"],
	});
	const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
	const heroScale = useTransform(scrollYProgress, [0, 1], [1, 1.1]);

	const handleLoadingComplete = () => {
		setIsLoading(false);
		// Small delay to ensure loading screen is gone before starting animations
		setTimeout(() => setShowContent(true), 100);
	};

	return (
		<>
			<AnimatePresence>
				{isLoading && <LoadingScreen onComplete={handleLoadingComplete} />}
			</AnimatePresence>

			<div className="bg-sbi-dark text-white">
				{/* Hero Section */}
				<section
					ref={heroRef}
					className="relative h-screen w-full overflow-hidden"
				>
					{/* Background with parallax */}
					<motion.div
						style={{ scale: heroScale }}
						className="absolute inset-0 brightness-[0.35]"
					>
						<Background startAnimation={showContent} />
					</motion.div>

					{/* Gradient overlay */}
					<div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-sbi-dark z-10" />

					{/* Content */}
					<motion.div
						style={{ opacity: heroOpacity }}
						className="relative z-20 h-full flex flex-col justify-center px-8 md:px-16 lg:px-24 select-none"
					>
						<div className="max-w-5xl">
							{/* Main headline - Staggered reveal */}
							<div className="overflow-hidden">
								<motion.h1
									initial={{ y: "100%" }}
									animate={showContent ? { y: 0 } : {}}
									transition={{
										delay: 0.1,
										duration: 1,
										ease: [0.22, 1, 0.36, 1],
									}}
									className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-extralight tracking-tighter"
								>
									<span className="text-sbi-green">S</span>ustainable
								</motion.h1>
							</div>
							<div className="overflow-hidden pb-4">
								<motion.h1
									initial={{ y: "100%" }}
									animate={showContent ? { y: 0 } : {}}
									transition={{
										delay: 0.2,
										duration: 1,
										ease: [0.22, 1, 0.36, 1],
									}}
									className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-extralight tracking-tighter"
								>
									<span className="text-sbi-green">B</span>uilding
								</motion.h1>
							</div>
							<div className="overflow-hidden">
								<motion.h1
									initial={{ y: "100%" }}
									animate={showContent ? { y: 0 } : {}}
									transition={{
										delay: 0.3,
										duration: 1,
										ease: [0.22, 1, 0.36, 1],
									}}
									className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-extralight tracking-tighter -translate-y-2"
								>
									<span className="text-sbi-green">I</span>nitiative
								</motion.h1>
							</div>

							{/* Tagline */}
							<motion.p
								initial={{ opacity: 0, y: 20 }}
								animate={showContent ? { opacity: 1, y: 0 } : {}}
								transition={{
									delay: 0.6,
									duration: 0.8,
									ease: [0.22, 1, 0.36, 1],
								}}
								className="text-lg md:text-xl text-sbi-muted font-light mb-12 max-w-xl leading-relaxed"
							>
								Research Driven. Professionally Inspired.{" "}
								<span className="text-white">Student Powered.</span>
							</motion.p>

							{/* CTA Buttons */}
							<motion.div
								initial={{ opacity: 0, y: 20 }}
								animate={showContent ? { opacity: 1, y: 0 } : {}}
								transition={{
									delay: 0.8,
									duration: 0.8,
									ease: [0.22, 1, 0.36, 1],
								}}
								className="flex flex-col sm:flex-row gap-4"
							>
								<MagneticButton href={FORMS_LINK} variant="primary" external>
									Join Our Team
								</MagneticButton>
								<MagneticButton href="/about" variant="secondary">
									Explore Our Work
								</MagneticButton>
							</motion.div>
						</div>
					</motion.div>
				</section>

				{/* Mission Statement Section */}
				<section className="relative py-32 md:py-48 overflow-hidden">
					<BlueprintGrid />
					<div className="relative z-10 max-w-4xl mx-auto px-8 md:px-16">
						<motion.div
							initial={{ opacity: 0, y: 40 }}
							whileInView={{ opacity: 1, y: 0 }}
							transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
							viewport={{ once: true, margin: "-100px" }}
							className="text-center"
						>
							<motion.span
								initial={{ opacity: 0, scale: 0.8 }}
								whileInView={{ opacity: 1, scale: 1 }}
								transition={{ delay: 0.2, duration: 0.6 }}
								viewport={{ once: true }}
								className="inline-block px-4 py-2 mb-8 text-xs tracking-[0.3em] uppercase text-sbi-green border border-sbi-green/30"
							>
								Our Mission
							</motion.span>

							<p className="text-2xl md:text-3xl lg:text-4xl font-light text-[#c4d4cc] leading-relaxed">
								We transform ambitious ideas into{" "}
								<span className="text-white font-normal">
									tangible realities
								</span>{" "}
								by uniting talented students from across all disciplines. Our
								mission is to execute{" "}
								<span className="text-sbi-green italic">
									professional-grade sustainable building projects
								</span>{" "}
								that address the specific needs of our clients and community.
							</p>

							<motion.div
								initial={{ scaleX: 0 }}
								whileInView={{ scaleX: 1 }}
								transition={{
									delay: 0.5,
									duration: 1,
									ease: [0.22, 1, 0.36, 1],
								}}
								viewport={{ once: true }}
								className="w-24 h-px bg-sbi-green mx-auto mt-12"
							/>
						</motion.div>
					</div>
				</section>

				{/* Stats Section */}
				<section className="relative py-24 border-y border-sbi-dark-border">
					<div className="max-w-7xl mx-auto px-8 md:px-16">
						<div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-0 md:divide-x divide-sbi-dark-border">
							{stats.map((stat, index) => (
								<motion.div
									key={stat.label}
									initial={{ opacity: 0, y: 40 }}
									whileInView={{ opacity: 1, y: 0 }}
									transition={{
										delay: index * 0.2,
										duration: 0.8,
										ease: [0.22, 1, 0.36, 1],
									}}
									viewport={{ once: true, margin: "-100px" }}
									className="flex flex-col items-center text-center px-8"
								>
									<div className="text-5xl md:text-6xl lg:text-7xl font-thin text-white mb-4 tracking-tighter">
										<Counter
											value={stat.value}
											prefix={stat.prefix}
											suffix={stat.suffix}
										/>
									</div>
									<div className="text-sm tracking-[0.2em] uppercase text-sbi-green mb-4">
										{stat.label}
									</div>
									<p className="text-sbi-muted-dark text-sm leading-relaxed max-w-xs">
										{stat.description}
									</p>
								</motion.div>
							))}
						</div>
					</div>
				</section>

				{/* Strategy Section */}
				<section className="relative py-32 md:py-48 overflow-hidden">
					<BlueprintGrid />
					<div className="relative z-10 max-w-7xl mx-auto px-8 md:px-16">
						{/* Section header */}
						<motion.div
							initial={{ opacity: 0, y: 30 }}
							whileInView={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
							viewport={{ once: true }}
							className="mb-20"
						>
							<div className="flex items-center gap-4 mb-6">
								<div className="w-16 h-px bg-sbi-green" />
								<span className="text-xs tracking-[0.3em] uppercase text-sbi-green">
									Methodology
								</span>
							</div>
							<h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight">
								Our Strategy
							</h2>
						</motion.div>

						{/* Strategy cards */}
						<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
							{strategy.map((item, index) => (
								<StrategyCard key={item.num} item={item} index={index} />
							))}
						</div>
					</div>
				</section>

				{/* Departments Section */}
				<section className="relative py-32 md:py-48 overflow-hidden">
					<div className="max-w-7xl mx-auto px-8 md:px-16">
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
							{/* Left column - Text */}
							<div>
								<motion.div
									initial={{ opacity: 0, y: 30 }}
									whileInView={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
									viewport={{ once: true }}
								>
									<div className="flex items-center gap-3 mb-8">
										<div className="w-12 h-px bg-sbi-green" />
										<span className="text-xs tracking-[0.3em] uppercase text-sbi-green">
											Teams
										</span>
									</div>
									<h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight mb-6">
										Our Departments
									</h2>
									<p className="text-sbi-muted leading-relaxed mb-8 max-w-md">
										Specialized teams working in harmony to deliver
										comprehensive sustainable building solutions.
									</p>
								</motion.div>

								<DecorativeElement />
							</div>

							{/* Right column - Accordion */}
							<div>
								{departments.map((dept, index) => (
									<DepartmentItem
										key={dept.name}
										dept={dept}
										index={index}
										isExpanded={expandedDept === dept.name}
										onToggle={() =>
											setExpandedDept(
												expandedDept === dept.name ? null : dept.name,
											)
										}
									/>
								))}
							</div>
						</div>
					</div>
				</section>

				{/* CTA Section */}
				<section className="relative py-32 md:py-48 overflow-hidden">
					<BlueprintGrid />

					{/* Background image */}
					<div className="absolute inset-0">
						<Image
							src={group}
							alt="SBI Team"
							fill
							className="object-cover brightness-50"
							sizes="100vw"
						/>
						<div className="absolute inset-0 bg-linear-to-t from-sbi-dark via-sbi-dark/80 to-sbi-dark/60" />
					</div>

					<div className="relative z-10 max-w-4xl mx-auto px-8 md:px-16 text-center">
						<motion.div
							initial={{ opacity: 0, y: 40 }}
							whileInView={{ opacity: 1, y: 0 }}
							transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
							viewport={{ once: true }}
						>
							<motion.span
								initial={{ opacity: 0, scale: 0.8 }}
								whileInView={{ opacity: 1, scale: 1 }}
								transition={{ delay: 0.2, duration: 0.6 }}
								viewport={{ once: true }}
								className="inline-block px-4 py-2 mb-8 text-xs tracking-[0.3em] uppercase text-sbi-green border border-sbi-green/30"
							>
								Join Us
							</motion.span>

							<h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight mb-6">
								Your Journey to{" "}
								<span className="italic text-sbi-green">
									Sustainable Impact
								</span>{" "}
								Begins Here
							</h2>

							<p className="text-lg md:text-xl text-sbi-muted font-light mb-12 max-w-2xl mx-auto">
								Learn. Build. Lead. Be part of a team that's shaping the future
								of sustainable architecture.
							</p>

							<motion.div
								initial={{ opacity: 0, y: 20 }}
								whileInView={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.4, duration: 0.8 }}
								viewport={{ once: true }}
							>
								<MagneticButton href={FORMS_LINK} variant="primary" external>
									Apply Now
								</MagneticButton>
							</motion.div>
						</motion.div>
					</div>
				</section>
			</div>
		</>
	);
}
