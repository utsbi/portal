"use client";

import { Button, Modal, Stack, Text, TextInput } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordModal() {
  const [opened, { open, close }] = useDisclosure(false);
  const [email, setEmail] = useState("");
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
      // The redirectTo URL needs to be configured in your Supabase redirect URLs
      // at https://supabase.com/dashboard/project/_/auth/url-configuration
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSuccess(true);
      setEmail("");
      // Auto-close after showing success message
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    close();
    setEmail("");
    setError(null);
    setSuccess(false);
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={handleClose}
        title={success ? "Check Your Email" : "Reset Your Password"}
        centered
      >
        {success ? (
          <Stack gap="md">
            <Text size="md" c="dimmed">
              Password reset instructions have been sent to your email.
            </Text>
            <Text size="sm" c="dimmed">
              If you registered using your email and password, you will receive
              a password reset email shortly.
            </Text>
            <Button onClick={handleClose} fullWidth>
              Close
            </Button>
          </Stack>
        ) : (
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <Text size="md" c="dimmed">
                Enter your email address and we'll send you a link to reset your
                password. Alternatively, contact one of the directors for
                assistance.
              </Text>

              <TextInput
                label="Email"
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
                disabled={isLoading}
                autoComplete="email"
              />

              {error && (
                <Text size="sm" c="red">
                  {error}
                </Text>
              )}

              <Button type="submit" fullWidth loading={isLoading}>
                {isLoading ? "Sending..." : "Send reset email"}
              </Button>
            </Stack>
          </form>
        )}
      </Modal>

      <Button onClick={open} variant="subtle" size="sm">
        Forgot password?
      </Button>
    </>
  );
}
