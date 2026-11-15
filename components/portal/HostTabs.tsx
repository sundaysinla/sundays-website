"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/portal/admin", label: "Carpool" },
  { href: "/portal/admin/checkin", label: "Check-in" },
];

/** Host-only sub-navigation across the admin pages. */
export default function HostTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Host tools">
      {tabs.map((t) => {
        const active = t.href === "/portal/admin" ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            style={{ cornerShape: "squircle" } as React.CSSProperties}
            className={cn(
              "rounded-2xl border px-3 pt-1.5 pb-1 font-ui text-[11px] uppercase tracking-wide transition-colors",
              active ? "border-ink bg-ink text-paper" : "border-ink/20 bg-transparent text-ink hover:bg-blueberry-200/30"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
