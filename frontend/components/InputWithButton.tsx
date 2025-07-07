"use client";

import {
	ActionIcon,
	TextInput,
	type TextInputProps,
	useMantineTheme,
} from "@mantine/core";
import { useInputState } from "@mantine/hooks";
import { IconArrowRight, IconSearch } from "@tabler/icons-react";

export function InputWithButton(props: TextInputProps) {
	const theme = useMantineTheme();
	const [input, setInput] = useInputState("");

	return (
		<TextInput
			onChange={setInput}
			radius="xl"
			size="md"
			placeholder="Search questions"
			rightSectionWidth={42}
			leftSection={<IconSearch size={18} stroke={1.5} />}
			rightSection={
				<ActionIcon
					onClick={() => {
						console.log(input);
					}}
					onKeyDown={(event) => {
						console.log(event.key);
						if (event.key === "enter") {
							console.log(input);
						}
					}}
					size={32}
					radius="xl"
					color={theme.primaryColor}
					variant="filled"
				>
					<IconArrowRight size={18} stroke={1.5} />
				</ActionIcon>
			}
			{...props}
		/>
	);
}
