"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ServerSwitcher } from "./ServerSwitcher";

const links = [
  { href: "/", label: "Servers" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/players", label: "Players" },
  { href: "/settings", label: "Settings" },
  { href: "/updates", label: "Updates" },
  { href: "/logs", label: "Logs" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">Palworld Manager</div>
          <div className="brand-sub">Homelab · Tailscale</div>
        </div>
        <ServerSwitcher />
        <nav className="nav">
          {links.map((l) => {
            const active =
              l.href === "/"
                ? pathname === "/"
                : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={active ? "active" : undefined}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
