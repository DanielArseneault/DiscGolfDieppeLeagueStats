"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RemoveDraftButton({ roundId }: { roundId: number }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleClick() {
    setSaving(true);
    await fetch(`/api/rounds/${roundId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDraft: false }),
    });
    router.refresh();
    setSaving(false);
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={saving}>
      {saving ? "Removing..." : "Remove Draft"}
    </Button>
  );
}
