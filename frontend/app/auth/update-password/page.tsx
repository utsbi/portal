"use client";

import {
	Button,
	Container,
	Paper,
	PasswordInput,
	Stack,
	Text,
	Title,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DotLoader } from "react-spinners";
import { createClient } from "@/utils/supabase/client";

export default function UpdatePasswordPage() {
	const router = useRouter();
	const [isVerifying, setIsVerifying] = useState(true);
	const [verificationError, setVerificationError] = useState<string | null>(
		null,
	);
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [updateError, setUpdateError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSuccess, setIsSuccess] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	const canSubmit = password.length >= 8 && password === confirmPassword;

	useEffect(() => {
		const supabase = createClient();
		let isMounted = true;

		const processRecoveryLink = async () => {
			const rawHash = window.location.hash.startsWith("#")
				? window.location.hash.slice(1)
				: window.location.hash;
			const params = new URLSearchParams(rawHash);
			const type = params.get("type");
			const accessToken = params.get("access_token");
			const refreshToken = params.get("refresh_token");
			const hasRecoveryTokens =
				type === "recovery" &&
				typeof accessToken === "string" &&
				typeof refreshToken === "string";

			if (!hasRecoveryTokens || !accessToken || !refreshToken) {
				if (!isMounted) return;
				setVerificationError(null);
				setIsVerifying(false);
				return;
			}

			try {
				// Persist the recovery session supplied in the redirect hash.
				const { error } = await supabase.auth.setSession({
					access_token: accessToken,
					refresh_token: refreshToken,
				});

				if (!isMounted) return;

				if (error) {
					setVerificationError(error.message);
					setIsVerifying(false);
					return;
				}

				setVerificationError(null);
				window.history.replaceState(
					{},
					document.title,
					`${window.location.pathname}${window.location.search}`,
				);
			} catch (unknownError) {
				if (!isMounted) return;
				setVerificationError(
					unknownError instanceof Error
						? unknownError.message
						: "Something went wrong while validating this link.",
				);
			} finally {
				if (isMounted) {
					setIsVerifying(false);
				}
			}
		};

		const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
			if (!isMounted) return;
			if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
				setVerificationError(null);
			}
		});

		processRecoveryLink();

		return () => {
			isMounted = false;
			authListener?.subscription.unsubscribe();
		};
	}, []);

	const handleSubmit = useCallback(
		async (event: React.FormEvent<HTMLFormElement>) => {
			event.preventDefault();

			if (!canSubmit) {
				setUpdateError(
					"Passwords must match and contain at least 8 characters.",
				);
				return;
			}

			const supabase = createClient();
			setIsSubmitting(true);
			setUpdateError(null);
			setIsSuccess(false);

			const { error } = await supabase.auth.updateUser({ password });

			if (error) {
				setUpdateError(error.message);
				setIsSubmitting(false);
				return;
			}

			setIsSuccess(true);
			setIsSubmitting(false);
			setPassword("");
			setConfirmPassword("");

			// wait two seconds before redirecting to login
			setTimeout(() => {
				router.push("/login");
			}, 2000);
		},
		[canSubmit, password, router],
	);

	useEffect(() => {
		if (isVerifying || verificationError) {
			return;
		}

		let isActive = true;
		const supabase = createClient();

		supabase.auth
			.getSession()
			.then(({ data }) => {
				if (!isActive) return;

				if (!data.session) {
					router.replace("/login");
				} else {
					setIsLoading(false);
				}
			})
			.catch(() => {
				if (!isActive) return;
				router.replace("/login");
			});

		return () => {
			isActive = false;
		};
	}, [isVerifying, verificationError, router]);

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
		<Container size="xs" py="xl">
			<Paper shadow="md" radius="md" p="xl" withBorder>
				<Stack gap="lg">
					<Title order={2}>Create a new password</Title>

					{isVerifying && <Text c="dimmed">Verifying your reset link…</Text>}

					{!isVerifying && verificationError && (
						<Stack gap="xs">
							<Text c="red" fw={600}>
								Unable to continue
							</Text>
							<Text c="dimmed">{verificationError}</Text>
							<Button variant="subtle" onClick={() => router.push("/login")}>
								Return to login
							</Button>
						</Stack>
					)}

					{!isVerifying && !verificationError && (
						<form onSubmit={handleSubmit}>
							<Stack gap="md">
								<Text c="dimmed">
									Enter and confirm a new password for your account.
								</Text>

								<PasswordInput
									label="New password"
									description="Minimum 8 characters"
									required
									value={password}
									onChange={(event) => setPassword(event.currentTarget.value)}
									autoComplete="new-password"
									autoFocus
								/>

								<PasswordInput
									label="Confirm new password"
									required
									value={confirmPassword}
									onChange={(event) =>
										setConfirmPassword(event.currentTarget.value)
									}
									autoComplete="new-password"
								/>

								{updateError && (
									<Text size="sm" c="red">
										{updateError}
									</Text>
								)}

								{isSuccess && (
									<Text size="sm" c="green">
										Password updated. Redirecting to login…
									</Text>
								)}

								<Button
									type="submit"
									fullWidth
									loading={isSubmitting}
									disabled={isSubmitting || isSuccess || !canSubmit}
								>
									Save new password
								</Button>
							</Stack>
						</form>
					)}
				</Stack>
			</Paper>
		</Container>
	);
}
