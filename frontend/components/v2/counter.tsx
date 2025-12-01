"use client";

import { animate, useInView, useMotionValue } from "motion/react";
import { useEffect, useRef } from "react";

interface CounterProps {
	value: number;
	prefix?: string;
	suffix?: string;
}

// Counter animation component
export function Counter({ value, prefix = "", suffix = "" }: CounterProps) {
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
