"use client";

import { Button, Modal, PasswordInput, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

export default function Login() {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col space-y-4">
        <TextInput label="Email" placeholder="Your email" required />
        <PasswordInput label="Password" placeholder="Your password" required />
        <Button variant="filled">Sign In</Button>
        <Button variant="filled" onClick={open}>
          Forgot your password?
        </Button>
        <Modal opened={opened} onClose={close}>
          Please open a ticket in the Discord server to get your password reset!
        </Modal>
      </div>
    </div>
  );
}
