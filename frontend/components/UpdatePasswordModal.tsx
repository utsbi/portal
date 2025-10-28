"use client";

import { Button, Modal, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useState } from "react";
import { createClient } from "@/utils/supabase/client";

export default function UpdatePasswordModal() {
	const [opened, { open, close }] = useDisclosure(false);
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [success, setSuccess] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const supabase = createClient();
		setIsLoading(true);
		setError(null);
		setSuccess(false);

		try {
			const { error } = await supabase.auth.updateUser({ password });
			if (error) throw error;
			setSuccess(true);
			setPassword("");
			setTimeout(() => {
				close();
				setSuccess(false);
			}, 1500);
		} catch (error: unknown) {
			setError(error instanceof Error ? error.message : "An error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	const handleClose = () => {
		close();
		setPassword("");
		setError(null);
		setSuccess(false);
	};

	return (
		<>
			<Modal
				opened={opened}
				onClose={handleClose}
				title="Reset Your Password"
				centered
			>
				<form onSubmit={handleSubmit}>
					<Stack gap="md">
						<Text size="md" c="dimmed">
							Please enter your new password below.
						</Text>

						<TextInput
							label="New password"
							id="password"
							type="password"
							placeholder="New password"
							required
							value={password}
							onChange={(e) => setPassword(e.currentTarget.value)}
							disabled={isLoading || success}
						/>

						{error && (
							<Text size="sm" c="red">
								{error}
							</Text>
						)}

						{success && (
							<Text size="sm" c="green">
								Password updated successfully!
							</Text>
						)}

						<Button
							type="submit"
							fullWidth
							loading={isLoading}
							disabled={success}
						>
							{success
								? "Password Updated!"
								: isLoading
									? "Saving..."
									: "Save new password"}
						</Button>
					</Stack>
				</form>
			</Modal>

			<Button onClick={open}>Reset Password</Button>
		</>
	);
}
