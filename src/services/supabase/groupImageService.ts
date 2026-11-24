import { supabase } from "@/integrations/supabase/client";
import { compressBannerImage, formatByteSize } from "@/lib/imageCompression";

const BUCKET = "protected-group-covers";
export const PROTECTED_GROUP_COVER_PREFIX = `${BUCKET}:`;

export interface GroupCoverUploadDetails {
  coverReference: string;
  originalBytes: number;
  compressedBytes: number;
}

/**
 * Compresses a group header / cover image using multi-step 2x progressive Retina HD
 * downsampling and near-lossless WebP/JPEG encoding before storing it in the protected bucket.
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

  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: mimeType,
      cacheControl: "0",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Failed to upload cover photo.");
  }

  return {
    coverReference: PROTECTED_GROUP_COVER_PREFIX + path,
    originalBytes,
    compressedBytes,
  };
}

export async function uploadGroupCoverImage(userId: string, file: File): Promise<string> {
  const result = await uploadGroupCoverImageWithMeta(userId, file);
  return result.coverReference;
}

export function downloadGroupCover(reference: string) {
  return supabase.storage.from(BUCKET).download(reference.slice(PROTECTED_GROUP_COVER_PREFIX.length));
}

export { formatByteSize };

/**
 * Updates the cover reference on an existing group.
 */
export async function updateGroupCoverImage(groupId: string, coverReference: string | null) {
  const { error } = await supabase
    .from("contribution_groups")
    .update({
      cover_image_url: coverReference,
      updated_at: new Date().toISOString(),
    })
    .eq("id", groupId).select("id").single();

  if (error) throw error;
}
