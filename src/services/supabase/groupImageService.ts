import { supabase } from "@/integrations/supabase/client";
import { compressBannerImage, formatByteSize } from "@/lib/imageCompression";

const BUCKET = "group-covers";

export interface GroupCoverUploadDetails {
  publicUrl: string;
  originalBytes: number;
  compressedBytes: number;
}

/**
 * Compresses a group header / cover image using multi-step 2x progressive Retina HD
 * downsampling and near-lossless WebP/JPEG encoding, uploads it to the public
 * `group-covers` Supabase Storage bucket, and returns the public CDN URL.
 */
export async function uploadGroupCoverImageWithMeta(
  userId: string,
  file: File
): Promise<GroupCoverUploadDetails> {
  const { blob, ext, mimeType, originalBytes, compressedBytes } = await compressBannerImage(file, {
    maxInputBytes: 10 * 1024 * 1024,
    maxWidth: 1600,
    maxHeight: 1200,
    targetMaxBytes: 320 * 1024,
  });

  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${userId}/${Date.now()}-${rand}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: mimeType,
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

  return {
    publicUrl: data.publicUrl,
    originalBytes,
    compressedBytes,
  };
}

export async function uploadGroupCoverImage(userId: string, file: File): Promise<string> {
  const result = await uploadGroupCoverImageWithMeta(userId, file);
  return result.publicUrl;
}

export { formatByteSize };

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
