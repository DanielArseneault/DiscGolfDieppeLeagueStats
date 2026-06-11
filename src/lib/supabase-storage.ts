import { createClient } from "@supabase/supabase-js";

const BUCKET = "newspaper-photos";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export function getPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;
  return createClient(url, key);
}

export async function uploadPhoto(
  file: File,
  weekNumber: number,
  index: number
): Promise<string> {
  const supabase = getPublicClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `week-${weekNumber}/${index}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deletePhoto(url: string): Promise<void> {
  const supabase = getServiceClient();
  const path = url.split(`/${BUCKET}/`)[1];
  if (!path) return;
  await supabase.storage.from(BUCKET).remove([path]);
}

export function getPhotoUrl(path: string): string {
  const supabase = getPublicClient();
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
