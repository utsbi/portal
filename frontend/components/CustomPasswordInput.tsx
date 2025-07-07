"use client";

import { Anchor, Button, Flex, Modal, PasswordInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useState } from "react";
import classes from "./CustomPasswordInput.module.css";

export function CustomPasswordInput() {
	const [focused, setFocused] = useState(false);
	const [value, setValue] = useState("");
	const floating = value.trim().length !== 0 || focused || undefined;
	const [opened, { open, close }] = useDisclosure(false);

	return (
		<>
			<PasswordInput
				label="Password"
				placeholder="Your password"
				required
				classNames={classes}
				value={value}
				onChange={(event) => setValue(event.currentTarget.value)}
				onFocus={() => setFocused(true)}
				onBlur={() => setFocused(false)}
				mt="md"
				autoComplete="nope"
				data-floating={floating}
				labelProps={{ "data-floating": floating }}
			/>
		</>
	);
}
