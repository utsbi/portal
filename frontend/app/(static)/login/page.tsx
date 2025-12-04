"use client";

import { Flex } from "@mantine/core";
import { motion } from "framer-motion";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DotLoader } from "react-spinners";
import bg from "@/assets/images/login.jpg";
import { Authentication } from "@/components/auth/Authentication";
import { createClient } from "@/utils/supabase/client";

export default function Login() {
	const router = useRouter();
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const checkAuth = async () => {
			const supabase = createClient();
			const {
				data: { session },
			} = await supabase.auth.getSession();
			if (session) {
				router.replace("/dashboard");
			} else {
				setIsLoading(false);
			}
		};

		checkAuth();
	}, [router]);

	if (isLoading) {
		return (
			<div className="flex min-h-svh w-full items-center justify-center">
				<div className="flex flex-col items-center gap-5">
					<DotLoader size={40} color="#4B5563" />
					<span className="text-gray-600 text-xl">Loading...</span>
				</div>
			</div>
		);
	}

	return (
		<div style={{ minHeight: "100vh", position: "relative" }}>
			<Image
				src={bg}
				alt="Login background"
				fill
				quality={100}
				priority
				style={{
					objectFit: "cover",
					objectPosition: "center",
					zIndex: -1,
				}}
			/>
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.7 }}
			>
				<Flex direction="column" justify="center" align="center" mih="100vh">
					<Authentication />
				</Flex>
			</motion.div>
		</div>
	);
}
