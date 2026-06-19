"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ScorecardTabs({
  blueContent,
  redContent,
  blueLabel = "🔵 Blue",
  redLabel = "🔴 Red",
}: {
  blueContent?: React.ReactNode;
  redContent?: React.ReactNode;
  blueLabel?: string;
  redLabel?: string;
}) {
  if (!blueContent && !redContent) return null;
  if (!blueContent) return <>{redContent}</>;
  if (!redContent) return <>{blueContent}</>;

  return (
    <Tabs defaultValue="blue">
      <TabsList className="mb-4">
        <TabsTrigger value="blue">{blueLabel}</TabsTrigger>
        <TabsTrigger value="red">{redLabel}</TabsTrigger>
      </TabsList>
      <TabsContent value="blue" className="space-y-6">{blueContent}</TabsContent>
      <TabsContent value="red" className="space-y-6">{redContent}</TabsContent>
    </Tabs>
  );
}
