"use client";

import { ArrowUpRight, Compass, Layers, Target } from "lucide-react";
import {
	AnimatePresence,
	animate,
	motion,
	useInView,
	useMotionTemplate,
	useMotionValue,
	useScroll,
	useTransform,
} from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import group from "@/assets/images/group.jpg";
import Background from "@/components/v2/background";

const FORMS_LINK = "https://forms.gle/KWJjaXGYt2dv3bY68";

// Loading screen component
function LoadingScreen({ onComplete }: { onComplete: () => void }) {
	const [progress, setProgress] = useState(0);
	const [phase, setPhase] = useState<"loading" | "revealing" | "done">(
		"loading",
	);

	useEffect(() => {
		// Simulate loading progress
		const duration = 2000;
		const interval = 20;
		const increment = 100 / (duration / interval);

		const timer = setInterval(() => {
			setProgress((prev) => {
				const next = prev + increment + Math.random() * 2;
				if (next >= 100) {
					clearInterval(timer);
					return 100;
				}
				return next;
			});
		}, interval);

		return () => clearInterval(timer);
	}, []);

	useEffect(() => {
		if (progress >= 100) {
			setTimeout(() => setPhase("revealing"), 300);
			setTimeout(() => {
				setPhase("done");
				onComplete();
			}, 1200);
		}
	}, [progress, onComplete]);

	return (
		<motion.div
			className="fixed inset-0 z-100 bg-sbi-dark flex items-center justify-center"
			initial={{ opacity: 1 }}
			animate={{
				opacity: phase === "done" ? 0 : 1,
				pointerEvents: phase === "done" ? "none" : "auto",
			}}
			transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
		>
			{/* Background grid */}
			<div className="absolute inset-0 overflow-hidden opacity-[0.02]">
				<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
					<title>Loading grid</title>
					<defs>
						<pattern
							id="loading-grid"
							width="60"
							height="60"
							patternUnits="userSpaceOnUse"
						>
							<path
								d="M 60 0 L 0 0 0 60"
								fill="none"
								stroke="currentColor"
								strokeWidth="0.5"
							/>
						</pattern>
					</defs>
					<rect width="100%" height="100%" fill="url(#loading-grid)" />
				</svg>
			</div>

			{/* Center content */}
			<div className="relative flex flex-col items-center">
				{/* Logo / Letters */}
				<div className="flex items-center gap-1 mb-12">
					{["S", "B", "I"].map((letter, index) => (
						<motion.div
							key={letter}
							className="relative"
							initial={{ opacity: 0, y: 40 }}
							animate={{
								opacity: 1,
								y: 0,
								scale: phase === "revealing" ? [1, 1.1, 0.9] : 1,
							}}
							transition={{
								delay: index * 0.15,
								duration: 0.8,
								ease: [0.22, 1, 0.36, 1],
							}}
						>
							<span className="text-7xl md:text-8xl font-extralight tracking-tighter text-white">
								{letter}
							</span>
							{/* Glow effect on each letter */}
							<motion.div
								className="absolute inset-0 blur-xl bg-sbi-green/20"
								initial={{ opacity: 0 }}
								animate={{
									opacity: phase === "revealing" ? [0, 0.5, 0] : 0,
								}}
								transition={{
									delay: index * 0.1,
									duration: 0.6,
								}}
							/>
						</motion.div>
					))}
				</div>

				{/* Progress bar container */}
				<div className="relative w-48 md:w-64">
					{/* Track */}
					<div className="h-px bg-sbi-dark-border w-full" />

					{/* Progress fill */}
					<motion.div
						className="absolute top-0 left-0 h-px bg-sbi-green origin-left"
						initial={{ scaleX: 0 }}
						animate={{ scaleX: progress / 100 }}
						transition={{ duration: 0.1, ease: "linear" }}
					/>

					{/* Progress indicator dot */}
					<motion.div
						className="absolute top-1/2 -translate-y-1/2 w-2 h-2 bg-sbi-green rounded-full"
						initial={{ left: 0 }}
						animate={{ left: `${Math.min(progress, 100)}%` }}
						transition={{ duration: 0.1, ease: "linear" }}
					>
						{/* Pulse effect */}
						<motion.div
							className="absolute inset-0 bg-sbi-green rounded-full"
							animate={{ scale: [1, 2, 1], opacity: [0.5, 0, 0.5] }}
							transition={{ duration: 1.5, repeat: Infinity }}
						/>
					</motion.div>

					{/* Percentage */}
					<motion.div
						className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs tracking-[0.3em] text-sbi-muted tabular-nums"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.5 }}
					>
						{Math.floor(progress)}%
					</motion.div>
				</div>

				{/* Loading text */}
				<motion.p
					className="absolute -bottom-20 text-xs tracking-[0.3em] uppercase text-sbi-muted-dark"
					initial={{ opacity: 0 }}
					animate={{
						opacity: phase === "loading" ? 1 : 0,
					}}
					transition={{ delay: 0.8, duration: 0.4 }}
				>
					Loading Experience
				</motion.p>
			</div>

			{/* Corner accents */}
			<div className="absolute top-8 left-8 w-16 h-16">
				<motion.div
					className="absolute top-0 left-0 w-full h-px bg-sbi-dark-border"
					initial={{ scaleX: 0 }}
					animate={{ scaleX: 1 }}
					transition={{ delay: 0.2, duration: 0.6 }}
				/>
				<motion.div
					className="absolute top-0 left-0 h-full w-px bg-sbi-dark-border"
					initial={{ scaleY: 0 }}
					animate={{ scaleY: 1 }}
					transition={{ delay: 0.2, duration: 0.6 }}
				/>
			</div>
			<div className="absolute top-8 right-8 w-16 h-16">
				<motion.div
					className="absolute top-0 right-0 w-full h-px bg-sbi-dark-border"
					initial={{ scaleX: 0 }}
					animate={{ scaleX: 1 }}
					transition={{ delay: 0.3, duration: 0.6 }}
				/>
				<motion.div
					className="absolute top-0 right-0 h-full w-px bg-sbi-dark-border"
					initial={{ scaleY: 0 }}
					animate={{ scaleY: 1 }}
					transition={{ delay: 0.3, duration: 0.6 }}
				/>
			</div>
			<div className="absolute bottom-8 left-8 w-16 h-16">
				<motion.div
					className="absolute bottom-0 left-0 w-full h-px bg-sbi-dark-border"
					initial={{ scaleX: 0 }}
					animate={{ scaleX: 1 }}
					transition={{ delay: 0.4, duration: 0.6 }}
				/>
				<motion.div
					className="absolute bottom-0 left-0 h-full w-px bg-sbi-dark-border"
					initial={{ scaleY: 0 }}
					animate={{ scaleY: 1 }}
					transition={{ delay: 0.4, duration: 0.6 }}
				/>
			</div>
			<div className="absolute bottom-8 right-8 w-16 h-16">
				<motion.div
					className="absolute bottom-0 right-0 w-full h-px bg-sbi-dark-border"
					initial={{ scaleX: 0 }}
					animate={{ scaleX: 1 }}
					transition={{ delay: 0.5, duration: 0.6 }}
				/>
				<motion.div
					className="absolute bottom-0 right-0 h-full w-px bg-sbi-dark-border"
					initial={{ scaleY: 0 }}
					animate={{ scaleY: 1 }}
					transition={{ delay: 0.5, duration: 0.6 }}
				/>
			</div>

			{/* Reveal curtains */}
			<motion.div
				className="absolute inset-0 bg-sbi-dark origin-top"
				initial={{ scaleY: 0 }}
				animate={{
					scaleY: phase === "revealing" ? 1 : 0,
				}}
				transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
			/>
		</motion.div>
	);
}

// Blueprint grid pattern for architectural aesthetic
function BlueprintGrid() {
	return (
		<div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
			<svg
				width="100%"
				height="100%"
				xmlns="http://www.w3.org/2000/svg"
				aria-hidden="true"
			>
				<title>Blueprint grid pattern</title>
				<defs>
					<pattern
						id="blueprint-grid"
						width="50"
						height="50"
						patternUnits="userSpaceOnUse"
					>
						<path
							d="M 50 0 L 0 0 0 50"
							fill="none"
							stroke="currentColor"
							strokeWidth="0.5"
						/>
					</pattern>
					<pattern
						id="blueprint-grid-large"
						width="250"
						height="250"
						patternUnits="userSpaceOnUse"
					>
						<path
							d="M 250 0 L 0 0 0 250"
							fill="none"
							stroke="currentColor"
							strokeWidth="1"
						/>
					</pattern>
				</defs>
				<rect width="100%" height="100%" fill="url(#blueprint-grid)" />
				<rect width="100%" height="100%" fill="url(#blueprint-grid-large)" />
			</svg>
		</div>
	);
}

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

// Counter animation component
function Counter({
	value,
	prefix = "",
	suffix = "",
}: {
	value: number;
	prefix?: string;
	suffix?: string;
}) {
	const ref = useRef<HTMLSpanElement>(null);
	const motionValue = useMotionValue(0);
	const isInView = useInView(ref, { once: true, margin: "-100px" });

	useEffect(() => {
		if (isInView) {
			animate(motionValue, value, { duration: 2.5, ease: [0.22, 1, 0.36, 1] });
		}
	}, [isInView, value, motionValue]);

	useEffect(() => {
		return motionValue.on("change", (latest) => {
			if (ref.current) {
				ref.current.textContent = `${prefix}${Math.floor(latest).toLocaleString()}${suffix}`;
			}
		});
	}, [motionValue, prefix, suffix]);

	return <span ref={ref} className="tabular-nums" />;
}

// Magnetic button with hover effects
function MagneticButton({
	children,
	href,
	variant = "primary",
	external = false,
}: {
	children: React.ReactNode;
	href: string;
	variant?: "primary" | "secondary";
	external?: boolean;
}) {
	const ref = useRef<HTMLAnchorElement>(null);
	const x = useMotionValue(0);
	const y = useMotionValue(0);

	const handleMouseMove = (e: React.MouseEvent) => {
		if (!ref.current) return;
		const rect = ref.current.getBoundingClientRect();
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;
		x.set((e.clientX - centerX) * 0.15);
		y.set((e.clientY - centerY) * 0.15);
	};

	const handleMouseLeave = () => {
		x.set(0);
		y.set(0);
	};

	const isPrimary = variant === "primary";

	return (
		<motion.a
			ref={ref}
			href={href}
			target={external ? "_blank" : undefined}
			rel={external ? "noopener noreferrer" : undefined}
			style={{ x, y }}
			onMouseMove={handleMouseMove}
			onMouseLeave={handleMouseLeave}
			className={`
				relative inline-flex items-center gap-2 px-8 py-4 text-sm font-medium tracking-wider uppercase
				overflow-hidden group transition-colors duration-500
				${
					isPrimary
						? "bg-sbi-dark-btn text-sbi-green border border-sbi-green/30 hover:bg-sbi-green hover:text-sbi-dark-btn"
						: "bg-transparent text-white border border-white/30 hover:bg-white hover:text-sbi-dark-btn"
				}
			`}
			whileHover={{ scale: 1.02 }}
			whileTap={{ scale: 0.98 }}
			transition={{ type: "spring", stiffness: 400, damping: 25 }}
		>
			<span className="relative z-10">{children}</span>
			<ArrowUpRight className="w-4 h-4 relative z-10 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
		</motion.a>
	);
}

// Strategy card with reveal animation
function StrategyCard({
	item,
	index,
}: {
	item: (typeof strategy)[0];
	index: number;
}) {
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

// Department accordion item
function DepartmentItem({
	dept,
	index,
	isExpanded,
	onToggle,
}: {
	dept: (typeof departments)[0];
	index: number;
	isExpanded: boolean;
	onToggle: () => void;
}) {
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
						<p className="pb-6 text-sbi-muted-dark leading-relaxed pl-1">
							{dept.description}
						</p>
					</motion.div>
				)}
			</AnimatePresence>
		</motion.div>
	);
}

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
							{/* Eyebrow */}
							{/* <motion.div
								initial={{ opacity: 0, y: 20 }}
								animate={showContent ? { opacity: 1, y: 0 } : {}}
							transition={{
								delay: 0.2,
								duration: 0.8,
								ease: [0.22, 1, 0.36, 1],
							}}
							className="flex items-center gap-3 mb-8"
						>
							<div className="w-12 h-px bg-sbi-green" />
							<span className="text-sbi-green text-sm tracking-[0.3em] uppercase font-light">
								Architectural Consulting
							</span>
						</motion.div> */}

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

						{/* Scroll indicator */}
						{/* <motion.div
							initial={{ opacity: 0 }}
							animate={showContent ? { opacity: 1 } : {}}
							transition={{ delay: 1.2, duration: 1 }}
							className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
						>
							<span className="text-xs tracking-[0.3em] uppercase text-sbi-muted">
								Scroll
							</span>
							<motion.div
								animate={showContent ? { y: [0, 8, 0] } : {}}
								transition={{
									repeat: Infinity,
									duration: 1.5,
									ease: "easeInOut",
								}}
								className="w-px h-8 bg-linear-to-b from-sbi-green to-transparent"
							/>
						</motion.div> */}
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

								{/* Decorative element */}
								<motion.div
									initial={{ opacity: 0, scale: 0.8 }}
									whileInView={{ opacity: 1, scale: 1 }}
									transition={{ delay: 0.3, duration: 0.8 }}
									viewport={{ once: true }}
									className="hidden lg:block relative w-64 h-64 mt-12"
								>
									<div className="absolute inset-0 border border-sbi-dark-border rotate-45" />
									<div className="absolute inset-4 border border-sbi-green/20 rotate-45" />
									<div className="absolute inset-8 border border-sbi-green/10 rotate-45" />
									<motion.div
										className="absolute inset-0 flex items-center justify-center"
										animate={{ rotate: 360 }}
										transition={{
											duration: 30,
											repeat: Infinity,
											ease: "linear",
										}}
									>
										<div className="w-2 h-2 bg-sbi-green rounded-full" />
									</motion.div>
								</motion.div>
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
