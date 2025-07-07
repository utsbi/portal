'use client';

import { Button, Modal } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { CustomPasswordInput } from "@/components/CustomPasswordInput";
import { FloatingLabelInput } from "@/components/FloatingLabelInput";
import { ForgotPasswordInput } from "@/components/ForgotPasswordInput";

export default function Home() {
  const [opened, { open, close }] = useDisclosure(false);

	return (
		<div className="min-h-screen flex items-center justify-center">
			<div className="flex flex-col space-y-4">
				<FloatingLabelInput />
				<ForgotPasswordInput />
				<CustomPasswordInput />
				<Button variant="filled">Sign In</Button>
				<Button variant="filled" onClick={open}>Forgot your password?</Button>
				<Modal opened={opened} onClose={close}>
				  Test
				</Modal>
			</div>
		</div>
	);
}
