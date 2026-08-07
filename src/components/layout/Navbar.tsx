"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, MessageCircle, Gift, User } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useNotificationStore, selectTotalUnread } from "@/store/useNotificationStore";
import { WalletButton } from "@/components/wallet/WalletButton";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/chat", label: "Messages", icon: MessageCircle },
  { href: "/rewards", label: "Rewards", icon: Gift },
  { href: "/profile", label: "Profile", icon: User },
];

export function Navbar() {
  const pathname = usePathname();
  const status = useAuthStore((s) => s.status);
  const authed = status === "authenticated";
  const totalUnread = useNotificationStore(selectTotalUnread);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="container flex h-14 items-center justify-between gap-4">
        <Link href={authed ? "/discover" : "/"} className="flex items-center gap-2 font-bold">
          <span className="text-lg tracking-tight">
            Vo<span className="text-primary">i</span>Dx
          </span>
        </Link>

        {authed && (
          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {href === "/chat" && totalUnread > 0 && (
                    <span className="ml-0.5 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                      {totalUnread > 9 ? "9+" : totalUnread}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        )}

        <WalletButton />
      </div>

      {/* Navigation mobile */}
      {authed && (
        <nav className="flex items-center justify-around border-t border-border md:hidden">
          {LINKS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span className="relative">
                  <Icon className="h-4 w-4" />
                  {href === "/chat" && totalUnread > 0 && (
                    <span className="absolute -right-1.5 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                      {totalUnread > 9 ? "9+" : totalUnread}
                    </span>
                  )}
                </span>
                {label}
              </Link>
            );
          })}
        </nav>
      )}
    </header>
  );
}
