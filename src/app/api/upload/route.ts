import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "newspaper-photos";

export async function POST(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase credentials not configured (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing)" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const weekNumber = formData.get("weekNumber") as string;
  const index = formData.get("index") as string;

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `week-${weekNumber}/${index}-${Date.now()}.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { upsert: true, contentType: file.type });

  if (error) {
    console.error("Supabase storage error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
