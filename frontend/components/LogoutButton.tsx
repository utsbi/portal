"use client";

import { Button } from "@mantine/core";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LogoutButton() {
	const router = useRouter();
	const supabase = createClient();

	const handleLogout = async () => {
		await supabase.auth.signOut();
		router.push("/login");
		router.refresh();
	};

	return <Button onClick={handleLogout}>Logout</Button>;
}
