import * as React from "react";
import { cn } from "@/lib/utils";

/** Avatar simple à initiales — évite une dépendance Radix supplémentaire. */
export function Avatar({
  name,
  className,
}: {
  name?: string | null;
  className?: string;
}) {
  const initials = (name ?? "?")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary",
        className
      )}
    >
      {initials}
    </div>
  );
}
