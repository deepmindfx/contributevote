import { supabase } from "@/integrations/supabase/client";

const BUCKET = "group-covers";
const MAX_WIDTH = 1400;
const JPEG_QUALITY = 0.85;

/**
 * Resizes and compresses an image file client-side to a crisp JPEG/WebP blob
 * so group cover photos upload quickly and load smoothly on mobile networks.
 */
async function compressCoverImage(file: File): Promise<{ blob: Blob; ext: string; mime: string }> {
  // Pass through small already-optimized images under 350 KB
  if (file.size <= 350 * 1024 && ["image/jpeg", "image/webp", "image/png"].includes(file.type)) {
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    return { blob: file, ext, mime: file.type };
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve({ blob: file, ext: "jpg", mime: file.type || "image/jpeg" });
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Could not process the selected image."));
            return;
          }
          resolve({ blob, ext: "jpg", mime: "image/jpeg" });
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected file could not be read as an image."));
    };

    img.src = objectUrl;
  });
}

/**
 * Uploads a group cover image to the public `group-covers` Supabase Storage bucket
 * under `<userId>/<timestamp>-<random>.<ext>` and returns the public CDN URL.
 */
export async function uploadGroupCoverImage(userId: string, file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please select a JPG, PNG, or WebP image file.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("Please choose an image smaller than 10 MB.");
  }

  const { blob, ext, mime } = await compressCoverImage(file);
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${userId}/${Date.now()}-${rand}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: mime,
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Failed to upload cover photo.");
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error("Failed to resolve uploaded image URL.");
  }
  return data.publicUrl;
}

/**
 * Updates an existing group's cover photo URL in `contribution_groups`.
 */
export async function updateGroupCoverImage(groupId: string, coverImageUrl: string | null) {
  const { error } = await (supabase as any)
    .from("contribution_groups")
    .update({
      cover_image_url: coverImageUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", groupId);

  if (error) throw error;
}
