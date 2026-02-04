import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Outreach",
  description:
    "Learn about SBI's outreach initiatives - building connections across Texas to spread sustainable building knowledge and practices.",
  openGraph: {
    title: "Outreach | Sustainable Building Initiative",
    description:
      "Building connections across Texas to spread sustainable building knowledge and practices.",
  },
};

export default function OutreachLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
