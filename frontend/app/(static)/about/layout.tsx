import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about the Sustainable Building Initiative - a student-led consultancy at UT Austin transforming sustainable building practices through interdisciplinary collaboration.",
  openGraph: {
    title: "About | Sustainable Building Initiative",
    description:
      "A student-powered initiative transforming sustainable building practices through interdisciplinary collaboration.",
  },
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
