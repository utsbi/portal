import {
	Button,
	Center,
	Paper,
	PasswordInput,
	Stack,
	Text,
	TextInput,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function Authentication() {
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const router = useRouter();

	const form = useForm({
		initialValues: {
			email: "",
			password: "",
		},

		validate: {
			email: (val) => (/^\S+@\S+$/.test(val) ? null : "Invalid email"),
		},
	});

	async function login() {
		const supabase = createClient();
		setIsLoading(true);
		setError(null); // Clear previous errors

		try {
			const { data, error } = await supabase.auth.signInWithPassword({
				email: form.values.email.trim().toLowerCase(),
				password: form.values.password,
			});

			if (error) {
				if (error.message.includes("Invalid login credentials")) {
					setError("Invalid email or password");
				} else if (error.message.includes("Email not confirmed")) {
					setError("Please verify your email address");
				} else {
					setError("An error occurred. Please try again.");
				}
				return;
			}

			if (data.user) {
				form.reset();
				router.push("/dashboard");
				router.refresh();
			}
		} catch (error: unknown) {
			setError("An unexpected error occurred. Please try again.");
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<Paper radius="md" p="xl" withBorder shadow="lg" w="100%" maw="400px">
			<Text size="lg" fw={500} ta="center" mb={20}>
				Welcome to SBI Portal
			</Text>

			<form onSubmit={form.onSubmit(() => login())}>
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
						autoComplete="email"
						disabled={isLoading}
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
						autoComplete="current-password"
						disabled={isLoading}
					/>
				</Stack>

				<Stack mt="xl" w="100%">
					<Button type="submit" radius="md" fullWidth disabled={isLoading}>
						{isLoading ? "Logging in..." : "Login"}
					</Button>
					{error && (
						<Center>
							<Text c="red" ta="center">
								{error}
							</Text>
						</Center>
					)}
				</Stack>
			</form>
		</Paper>
	);
}
