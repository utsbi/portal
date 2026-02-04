import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with the Sustainable Building Initiative. Contact us for project inquiries, partnerships, or membership opportunities.",
  openGraph: {
    title: "Contact | Sustainable Building Initiative",
    description:
      "Have a question or want to collaborate? Get in touch with SBI.",
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
