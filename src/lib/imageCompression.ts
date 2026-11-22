export interface CompressedImageResult {
  dataUrl: string;
  originalBytes: number;
  compressedBytes: number;
  width: number;
  height: number;
  mimeType: string;
}

export interface CompressProfileImageOptions {
  /** Maximum allowed source file size in bytes (default: 5 MB) */
  maxInputBytes?: number;
  /** Target output dimension in pixels for 1:1 Retina avatar (default: 640px = 8x 80px avatar) */
  maxDimension?: number;
  /** Target maximum compressed output size in bytes (default: 180 KB) */
  targetMaxBytes?: number;
}

const DEFAULT_MAX_INPUT_BYTES = 5 * 1024 * 1024; // 5 MB
const DEFAULT_MAX_DIMENSION = 640; // 640x640 Retina HD avatar
const DEFAULT_TARGET_MAX_BYTES = 180 * 1024; // 180 KB

export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Could not read processed image."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read image data."));
    reader.readAsDataURL(blob);
  });
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("The selected file could not be decoded as an image."));
    };

    img.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

/**
 * Multi-step 2x progressive downsampling to avoid aliasing/blurriness
 * when shrinking high-megapixel phone camera photos down to avatar dimensions.
 */
function renderHighQualitySquareCanvas(
  img: HTMLImageElement,
  targetSize: number
): HTMLCanvasElement {
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  const cropSize = Math.max(1, Math.min(srcW, srcH));
  const cropX = Math.round((srcW - cropSize) / 2);
  const cropY = Math.round((srcH - cropSize) / 2);

  // First stage: extract center square crop
  let currentSize = cropSize;
  let currentCanvas = document.createElement("canvas");
  let currentWidth = currentSize > targetSize * 2 ? Math.round(currentSize / 2) : targetSize;
  currentCanvas.width = currentWidth;
  currentCanvas.height = currentWidth;

  const firstCtx = currentCanvas.getContext("2d");
  if (!firstCtx) {
    return currentCanvas;
  }
  firstCtx.imageSmoothingEnabled = true;
  firstCtx.imageSmoothingQuality = "high";
  firstCtx.drawImage(
    img,
    cropX,
    cropY,
    cropSize,
    cropSize,
    0,
    0,
    currentWidth,
    currentWidth
  );
  currentSize = currentWidth;

  // Progressive 2x halving until we reach targetSize
  while (currentSize > targetSize) {
    const nextSize = Math.max(targetSize, Math.round(currentSize / 2));
    const nextCanvas = document.createElement("canvas");
    nextCanvas.width = nextSize;
    nextCanvas.height = nextSize;
    const nextCtx = nextCanvas.getContext("2d");
    if (!nextCtx) break;
    nextCtx.imageSmoothingEnabled = true;
    nextCtx.imageSmoothingQuality = "high";
    nextCtx.drawImage(currentCanvas, 0, 0, currentSize, currentSize, 0, 0, nextSize, nextSize);
    currentCanvas = nextCanvas;
    currentSize = nextSize;
  }

  return currentCanvas;
}

/**
 * Compresses a user-selected profile image (up to 5 MB) into a crystal-clear,
 * visually lossless Retina avatar Data URL (typically 25 KB – 95 KB).
 */
export async function compressProfileImage(
  file: File,
  options: CompressProfileImageOptions = {}
): Promise<CompressedImageResult> {
  const maxInputBytes = options.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES;
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const targetMaxBytes = options.targetMaxBytes ?? DEFAULT_TARGET_MAX_BYTES;

  if (!file.type.startsWith("image/")) {
    throw new Error("Please select a valid image file (JPG, PNG, or WebP).");
  }

  if (file.size > maxInputBytes) {
    throw new Error(
      `Image is ${formatByteSize(file.size)}. Please choose a photo up to ${formatByteSize(maxInputBytes)}.`
    );
  }

  const img = await loadImageElement(file);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  // Pass through already-compact square images untouched (bit-for-bit lossless)
  if (
    file.size <= 140 * 1024 &&
    srcW === srcH &&
    srcW <= maxDimension &&
    ["image/webp", "image/png", "image/jpeg"].includes(file.type)
  ) {
    const dataUrl = await readFileAsDataUrl(file);
    return {
      dataUrl,
      originalBytes: file.size,
      compressedBytes: file.size,
      width: srcW,
      height: srcH,
      mimeType: file.type,
    };
  }

  const cropSize = Math.max(1, Math.min(srcW, srcH));
  const targetSize = Math.min(maxDimension, cropSize);
  const canvas = renderHighQualitySquareCanvas(img, targetSize);

  // Adaptive near-lossless encoding passes (WebP preferred for transparency + 35% higher efficiency, JPEG fallback)
  const qualitySteps = [0.94, 0.9, 0.85, 0.78];
  const candidateMimes = ["image/webp", "image/jpeg"];

  let bestBlob: Blob | null = null;
  let bestMime = "image/webp";

  for (const mime of candidateMimes) {
    let mimeSupported = false;
    for (const quality of qualitySteps) {
      const blob = await canvasToBlob(canvas, mime, quality);
      if (!blob || blob.type !== mime) {
        break;
      }
      mimeSupported = true;
      bestBlob = blob;
      bestMime = mime;
      if (blob.size <= targetMaxBytes) {
        break;
      }
    }
    if (mimeSupported && bestBlob) {
      break;
    }
  }

  if (!bestBlob) {
    const fallbackUrl = canvas.toDataURL("image/jpeg", 0.9);
    const approxBytes = Math.round((fallbackUrl.length * 3) / 4);
    return {
      dataUrl: fallbackUrl,
      originalBytes: file.size,
      compressedBytes: approxBytes,
      width: targetSize,
      height: targetSize,
      mimeType: "image/jpeg",
    };
  }

  const dataUrl = await readFileAsDataUrl(bestBlob);
  return {
    dataUrl,
    originalBytes: file.size,
    compressedBytes: bestBlob.size,
    width: targetSize,
    height: targetSize,
    mimeType: bestMime,
  };
}
