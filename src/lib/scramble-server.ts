import sharp from 'sharp';
import { generateTilePermutation, DEFAULT_SCRAMBLE_ROWS, DEFAULT_SCRAMBLE_COLS } from './scramble';

export interface ScrambleOptions {
  seed: string;
  rows?: number;
  cols?: number;
  quality?: number;
}

/**
 * In-memory raw pixel scrambler using Sharp (giải mã -> hoán đổi ô -> mã hóa WebP lossless 1:1).
 * Đo thực tế trên ảnh 1200x1800–1600x2048 đã nén WebP: ~0,5–1,4 giây CPU/ảnh (bước mã hóa lossless chiếm phần lớn),
 * nên route `/api/image/[id]` dùng `scrambledImageCache` để không tính lại cho mỗi lần xem.
 */
export async function scrambleImageBuffer(
  inputBuffer: Buffer,
  options: ScrambleOptions
): Promise<Buffer> {
  const rows = Math.min(Math.max(options.rows || DEFAULT_SCRAMBLE_ROWS, 2), 16);
  const cols = Math.min(Math.max(options.cols || DEFAULT_SCRAMBLE_COLS, 2), 16);
  const totalTiles = rows * cols;

  const metadata = await sharp(inputBuffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Invalid image: missing dimensions');
  }

  const tileW = Math.floor(metadata.width / cols);
  const tileH = Math.floor(metadata.height / rows);
  const cleanW = tileW * cols;
  const cleanH = tileH * rows;

  // Extract clean grid bounds directly without destructive resampling
  const { data: srcData } = await sharp(inputBuffer)
    .extract({ left: 0, top: 0, width: cleanW, height: cleanH })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const channels = 4;
  const permutation = generateTilePermutation(totalTiles, options.seed);
  const dstData = Buffer.alloc(cleanW * cleanH * channels);

  // Copy each tile into its scrambled destination
  for (let scramIndex = 0; scramIndex < totalTiles; scramIndex++) {
    const origIndex = permutation[scramIndex];

    const origCol = origIndex % cols;
    const origRow = Math.floor(origIndex / cols);
    const srcX = origCol * tileW;
    const srcY = origRow * tileH;

    const scramCol = scramIndex % cols;
    const scramRow = Math.floor(scramIndex / cols);
    const dstX = scramCol * tileW;
    const dstY = scramRow * tileH;

    for (let row = 0; row < tileH; row++) {
      const srcOffset = ((srcY + row) * cleanW + srcX) * channels;
      const dstOffset = ((dstY + row) * cleanW + dstX) * channels;
      const length = tileW * channels;
      srcData.copy(dstData, dstOffset, srcOffset, srcOffset + length);
    }
  }

  return sharp(dstData, {
    raw: {
      width: cleanW,
      height: cleanH,
      channels: 4,
    },
  })
    .webp({ lossless: true, effort: 0 })
    .toBuffer();
}
