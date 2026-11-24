import { AVATAR_DATA_URL, AVATAR_DATA_URL_MAX, AVATAR_SIZE } from '@grabcode/contracts/schemas';

// Avatar upload without object storage: crop the picked photo to a square, shrink it to AVATAR_SIZE px in the browser and send
// it as a data URL that UpdateMeSchema accepts (HON-50).

/** Raw file cap before decoding: phone photos are a few MB, anything far bigger is not a profile picture. */
export const AVATAR_FILE_MAX = 10 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const QUALITIES = [0.85, 0.7, 0.55, 0.4];

export function avatarFileError(file: { type: string; size: number }): string | null {
  if (!TYPES.includes(file.type)) return 'Chỉ nhận ảnh JPG, PNG hoặc WebP.';
  if (file.size > AVATAR_FILE_MAX) return 'Ảnh quá lớn (tối đa 10 MB).';
  return null;
}

/** Centered square crop of a w×h image. */
export function squareCrop(w: number, h: number) {
  const side = Math.min(w, h);
  return { sx: (w - side) / 2, sy: (h - side) / 2, side };
}

/** First encoding (best quality first) that fits the contract, or null. */
export function fitDataUrl(encode: (quality: number) => string): string | null {
  for (const q of QUALITIES) {
    const url = encode(q);
    if (url.length <= AVATAR_DATA_URL_MAX && AVATAR_DATA_URL.test(url)) return url;
  }
  return null;
}

/** Browser only. Rejects with a Vietnamese message the profile form shows as is. */
export async function avatarFromFile(file: File): Promise<string> {
  const err = avatarFileError(file);
  if (err) throw new Error(err);
  const src = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = src;
    await img.decode().catch(() => {
      throw new Error('Không đọc được ảnh này, thử ảnh khác.');
    });
    const { sx, sy, side } = squareCrop(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = AVATAR_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');
    // JPEG has no alpha: paint white so transparent PNGs do not turn black.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    const url = fitDataUrl((q) => canvas.toDataURL('image/jpeg', q));
    if (!url) throw new Error('Không nén được ảnh đủ nhỏ, thử ảnh khác.');
    return url;
  } finally {
    URL.revokeObjectURL(src);
  }
}
