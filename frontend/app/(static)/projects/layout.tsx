import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Explore our portfolio of professional-grade sustainable building projects designed and executed by our interdisciplinary student team.",
  openGraph: {
    title: "Projects | Sustainable Building Initiative",
    description:
      "Professional-grade sustainable building solutions designed and executed by our interdisciplinary team.",
  },
};

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
