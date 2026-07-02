import { createClient } from "@/lib/supabase/client";

// Photo helpers for the private "photos" bucket.
// Path convention: {user_id}/{yyyy-mm-dd}/{uuid}.jpg  (RLS enforces the prefix).

export async function uploadPhoto(
  userId: string,
  date: string,
  file: File,
): Promise<string> {
  const supabase = createClient();
  const path = `${userId}/${date}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function signedPhotoUrl(
  path: string,
  expiresIn = 3600,
): Promise<string | null> {
  const { data } = await createClient()
    .storage.from("photos")
    .createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}
