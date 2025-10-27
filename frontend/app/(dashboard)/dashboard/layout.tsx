import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Dashboard",
	description: "SBI Portal Dashboard",
};

export default function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="dashboard-container">
			<main>{children}</main>
		</div>
	);
}
