"use client";

import { Container, Flex } from "@mantine/core";
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
		</div>
	);
}
