"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleCard({ title, description, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <CardHeader
        className="pb-3 cursor-pointer select-none"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <span className="text-[var(--ink-muted)] text-sm">{open ? "▲" : "▼"}</span>
        </div>
        {description && <p className="text-xs text-[var(--ink-muted)]">{description}</p>}
      </CardHeader>
      {open && <CardContent>{children}</CardContent>}
    </Card>
  );
}
