"use client";

import { BarChart3, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const sections = [
  { href: "/dashboard/admin", label: "Overview", icon: BarChart3 },
  { href: "/dashboard/admin/dues", label: "Dues", icon: Wallet },
];

export function AdminNavigation() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin sections"
      className="mb-6 flex shrink-0 gap-6 border-b border-sbi-dark-border/50"
    >
      {sections.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/dashboard/admin"
            ? pathname === href || pathname === `${href}/stats`
            : pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex items-center gap-2 border-b-2 px-1 pb-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sbi-green",
              active
                ? "border-sbi-green text-sbi-green"
                : "border-transparent text-sbi-muted hover:border-sbi-dark-border hover:text-white",
            )}
          >
            <Icon aria-hidden="true" className="size-4" strokeWidth={1.5} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
