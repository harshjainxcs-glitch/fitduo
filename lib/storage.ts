import { createClient } from "@/lib/supabase/client";

// Photo helpers for the private "photos" bucket.
// Path convention: {user_id}/{yyyy-mm-dd}/{uuid}.jpg  (RLS enforces the prefix).

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/**
 * Downscale + re-encode to JPEG so uploads/downloads are fast (camera photos
 * are often several MB). Falls back to the original file if anything fails.
 */
export async function compressImage(
  file: File,
  maxDim = 1440,
  quality = 0.82,
): Promise<Blob> {
  if (typeof document === "undefined" || !file.type.startsWith("image/")) {
    return file;
  }
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", quality),
    );
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export async function uploadPhoto(
  userId: string,
  date: string,
  file: File,
): Promise<string> {
  const supabase = createClient();
  const blob = await compressImage(file);
  const path = `${userId}/${date}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage
    .from("photos")
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

// Cache signed URLs per path so refetches reuse the same URL (browser caches
// the image instead of re-downloading it every time the query re-runs).
const urlCache = new Map<string, { url: string; exp: number }>();

export async function signedPhotoUrl(
  path: string,
  expiresIn = 21600, // 6h
): Promise<string | null> {
  const hit = urlCache.get(path);
  if (hit && hit.exp > Date.now() + 60_000) return hit.url;

  const { data } = await createClient()
    .storage.from("photos")
    .createSignedUrl(path, expiresIn);
  if (data?.signedUrl) {
    urlCache.set(path, { url: data.signedUrl, exp: Date.now() + expiresIn * 1000 });
  }
  return data?.signedUrl ?? null;
}
