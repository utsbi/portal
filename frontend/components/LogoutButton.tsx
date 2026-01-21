"use client";

import { Button } from "@mantine/core";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push("/login");
    router.refresh();
  };

  return <Button onClick={handleLogout}>Logout</Button>;
}
