"use client";

import { Flex } from "@mantine/core";
import { motion } from "framer-motion";
import Image from "next/image";
import bg from "@/assets/images/login.jpg";
import { Authentication } from "@/components/Authentication";

export default function Login() {
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
