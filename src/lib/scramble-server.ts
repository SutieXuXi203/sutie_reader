import sharp from 'sharp';
import { generateTilePermutation, DEFAULT_SCRAMBLE_ROWS, DEFAULT_SCRAMBLE_COLS } from './scramble';

export interface ScrambleOptions {
  seed: string;
  rows?: number;
  cols?: number;
  quality?: number;
}

/**
 * Fast in-memory raw pixel scrambler using Sharp.
 * Operates in ~50-90ms by extracting raw RGBA pixels and copying tile row slices.
 */
export async function scrambleImageBuffer(
  inputBuffer: Buffer,
  options: ScrambleOptions
): Promise<Buffer> {
  const rows = options.rows || DEFAULT_SCRAMBLE_ROWS;
  const cols = options.cols || DEFAULT_SCRAMBLE_COLS;
  const totalTiles = rows * cols;
  const quality = options.quality ?? 85;

  const metadata = await sharp(inputBuffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error('Invalid image: missing dimensions');
  }

  const tileW = Math.floor(metadata.width / cols);
  const tileH = Math.floor(metadata.height / rows);
  const cleanW = tileW * cols;
  const cleanH = tileH * rows;

  // Single pass decompression into raw RGBA buffer
  const { data: srcData } = await sharp(inputBuffer)
    .resize(cleanW, cleanH, { fit: 'cover' })
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
    .webp({ quality })
    .toBuffer();
}
