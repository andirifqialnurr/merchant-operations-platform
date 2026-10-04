/**
 * Product pictures are stored in one size: small enough to load fast on a
 * cashier tablet, large enough for a sharp tile on a dense screen. The
 * picture is scaled down in the browser before it is uploaded; the original
 * never leaves the device.
 */
export const PRODUCT_THUMBNAIL = {
  /** Longest edge in pixels. A tile is at most about 260 CSS pixels wide; this covers 3x screens. */
  maxEdge: 800,
  /** 0 to 1; lossy, tuned for food photos. */
  quality: 0.82,
  /** Preferred format, with the fallback for browsers that cannot write it. */
  types: ["image/webp", "image/jpeg"],
} as const;

export type ImageSize = { height: number; width: number };

/**
 * The size a picture is stored at: the same shape, the longest edge at most
 * `maxEdge`. A picture that is already small is not enlarged.
 */
export function thumbnailSize(source: ImageSize, maxEdge: number = PRODUCT_THUMBNAIL.maxEdge) {
  const longest = Math.max(source.width, source.height);
  if (longest <= 0) throw new Error("A picture needs a width and a height.");
  const scale = Math.min(1, maxEdge / longest);
  return {
    height: Math.max(1, Math.round(source.height * scale)),
    width: Math.max(1, Math.round(source.width * scale)),
  };
}

export type Thumbnail = ImageSize & { blob: Blob; contentType: string };

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Scales a picture down to the stored size. Throws when the file is not a
 * picture the browser can read; the caller shows that as "this file cannot be used".
 */
export async function makeThumbnail(file: Blob): Promise<Thumbnail> {
  // Phones store the rotation next to the pixels; this applies it.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const size = thumbnailSize({ height: bitmap.height, width: bitmap.width });
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot draw pictures.");
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, size.width, size.height);

    for (const type of PRODUCT_THUMBNAIL.types) {
      const blob = await encode(canvas, type, PRODUCT_THUMBNAIL.quality);
      // A browser that cannot write a format quietly answers with PNG instead.
      if (blob && blob.type === type) return { ...size, blob, contentType: type };
    }
    throw new Error("This browser cannot write a picture format the app accepts.");
  } finally {
    bitmap.close();
  }
}
