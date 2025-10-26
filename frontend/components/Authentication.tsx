import {
	Button,
	Checkbox,
	Group,
	Paper,
	PasswordInput,
	Stack,
	Text,
	TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";

import { login } from "@/app/login/actions";

export function Authentication() {
	const form = useForm({
		initialValues: {
			email: "",
			password: "",
		},

		validate: {
			email: (val) => (/^\S+@\S+$/.test(val) ? null : "Invalid email"),
			// password: (val) =>
			// 	val.length <= 6
			// 		? "Password should include at least 6 characters"
			// 		: null, // don't need to validate password for login only
		},
	});

	return (
		<Paper radius="md" p="xl" withBorder shadow="lg" w="100%" maw="400px">
			<Text size="lg" fw={500} ta="center" mb={20}>
				Welcome to SBI Portal
			</Text>

			<form onSubmit={form.onSubmit((values) => login(values))}>
				<Stack>
					<TextInput
						required
						label="Email"
						placeholder="hello@gmail.com"
						value={form.values.email}
						onChange={(event) =>
							form.setFieldValue("email", event.currentTarget.value)
						}
						error={form.errors.email && "Invalid email"}
						radius="md"
					/>

					<PasswordInput
						required
						label="Password"
						placeholder="Your password"
						value={form.values.password}
						onChange={(event) =>
							form.setFieldValue("password", event.currentTarget.value)
						}
						error={
							form.errors.password &&
							"Password should include at least 6 characters"
						}
						radius="md"
					/>
				</Stack>

				<Group mt="xl" w="100%" justify="space-between">
					<Checkbox label="Keep me logged in" size="md" />
					<Button type="submit" radius="md" fullWidth>
						Login
					</Button>
				</Group>
			</form>
		</Paper>
	);
}
