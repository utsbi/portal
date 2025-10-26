import { redirect } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { createClient } from "@/utils/supabase/server";

export default async function Dashboard() {
	const supabase = await createClient();

	const { data, error } = await supabase.auth.getUser();
	if (error || !data?.user) {
		redirect("/login");
	}

	return (
		<div className="flex flex-col items-center justify-center w-full h-screen">
			<div>Hello {data.user.email}</div>
			<LogoutButton />
		</div>
	);
}
