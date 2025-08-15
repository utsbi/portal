"use client";

import { Container, Flex } from "@mantine/core";
import { motion } from "framer-motion";
import bg from "@/assets/images/login.jpg";
import { Authentication } from "./Authentication";

export default function Login() {
	return (
		<div
			style={{
				minHeight: "100vh",
				backgroundImage: `url(${bg.src})`,
				backgroundSize: "cover",
				backgroundPosition: "center",
				backgroundRepeat: "no-repeat",
			}}
		>
			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.7 }}
			>
				<Container size="sm" style={{ minHeight: "100vh" }}>
					<Flex
						direction="column"
						justify="center"
						align="center"
						style={{ minHeight: "100vh" }}
					>
						<Authentication />
					</Flex>
				</Container>
			</motion.div>
		</div>
	);
}
