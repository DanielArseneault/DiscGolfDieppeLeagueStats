import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--ink)] shadow-sm placeholder:text-[var(--ink-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-border)] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
