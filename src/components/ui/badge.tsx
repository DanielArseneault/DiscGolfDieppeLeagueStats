import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-[var(--r-pill)] border px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-[var(--accent)] text-[var(--accent-ink)]",
        secondary: "border-transparent bg-[var(--chip-neutral)] text-[var(--ink)]",
        destructive: "border-transparent bg-[var(--tint-bad-bg)] text-[var(--tint-bad-fg)]",
        outline: "border-[var(--line)] text-[var(--ink)]",
        blue: "border-transparent bg-[var(--blue-surface)] text-[var(--blue-ink)]",
        red: "border-transparent bg-[var(--red-surface)] text-[var(--red-ink)]",
        green: "border-transparent bg-[var(--tint-good-bg)] text-[var(--tint-good-fg)]",
        yellow: "border-transparent bg-[var(--tint-warn-bg)] text-[var(--tint-warn-fg)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
