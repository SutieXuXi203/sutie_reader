export const DEFAULT_SCRAMBLE_ROWS = 8;
export const DEFAULT_SCRAMBLE_COLS = 8;

/**
 * Deterministic pseudo-random number generator (Mulberry32)
 */
export function pseudoRandom(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Converts any string (e.g. imageId, chapter title, secret key) into an integer seed
 */
export function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Generates a deterministic permutation array for totalTiles using Fisher-Yates shuffle
 */
export function generateTilePermutation(totalTiles: number, seedStr: string): number[] {
  const rng = pseudoRandom(stringToSeed(seedStr));
  const order = Array.from({ length: totalTiles }, (_, i) => i);
  for (let i = totalTiles - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export const SCRAMBLE_SECRET_SALT = 'sutie_mesh_secure_salt_v2_2026';

/**
 * Derives a deterministic, unguessable seed from an image/file ID using an internal secret salt.
 * Eliminates the need to ever expose seeds in public URLs.
 */
export function deriveScrambleSeed(fileId: string): string {
  if (!fileId) return 'sutie_default_seed';
  const hash1 = stringToSeed(fileId);
  const hash2 = stringToSeed(SCRAMBLE_SECRET_SALT);
  return `sutie_${(hash1 ^ hash2) >>> 0}_${(hash1 + hash2) >>> 0}`;
}

export interface ScrambleParams {
  isScrambled: boolean;
  seed: string;
  rows: number;
  cols: number;
}

/**
 * Parses scramble metadata from an image URL query string or derives it automatically
 */
export function parseScrambleParams(url: string): ScrambleParams {
  if (!url) {
    return { isScrambled: false, seed: '', rows: DEFAULT_SCRAMBLE_ROWS, cols: DEFAULT_SCRAMBLE_COLS };
  }

  const apiMatch = url.match(/(?:^|\/)api\/image\/([a-zA-Z0-9_-]{10,})/);
  const fileId = apiMatch ? apiMatch[1] : null;

  try {
    const parsed = new URL(url, 'http://localhost');
    const hasExplicitScramble = parsed.searchParams.get('scramble') === '1' || parsed.searchParams.has('scrambled');
    const explicitSeed = parsed.searchParams.get('seed');
    const rows = parseInt(parsed.searchParams.get('rows') || '', 10) || DEFAULT_SCRAMBLE_ROWS;
    const cols = parseInt(parsed.searchParams.get('cols') || '', 10) || DEFAULT_SCRAMBLE_COLS;

    const isScrambled = hasExplicitScramble || Boolean(fileId);
    const seed = explicitSeed || (fileId ? deriveScrambleSeed(fileId) : 'default_seed');

    return {
      isScrambled,
      seed,
      rows: rows > 0 ? rows : DEFAULT_SCRAMBLE_ROWS,
      cols: cols > 0 ? cols : DEFAULT_SCRAMBLE_COLS,
    };
  } catch {
    const isScrambled = url.includes('scramble=1') || Boolean(fileId);
    const seed = fileId ? deriveScrambleSeed(fileId) : 'default_seed';

    return {
      isScrambled,
      seed,
      rows: DEFAULT_SCRAMBLE_ROWS,
      cols: DEFAULT_SCRAMBLE_COLS,
    };
  }
}

/**
 * Scrambles an image File/Blob on the browser side using HTML5 Canvas
 * Divides the image into rows x cols tiles (default 8x8 = 64) and shuffles their positions.
 */
export async function scrambleImageFile(
  file: File | Blob,
  seed: string,
  rows: number = DEFAULT_SCRAMBLE_ROWS,
  cols: number = DEFAULT_SCRAMBLE_COLS,
  quality: number = 0.85
): Promise<File> {
  if (typeof window === 'undefined') {
    throw new Error('scrambleImageFile must run in browser environment');
  }

  let imgWidth = 0;
  let imgHeight = 0;
  let sourceElement: ImageBitmap | HTMLImageElement;

  if (typeof createImageBitmap !== 'undefined') {
    const bitmap = await createImageBitmap(file);
    imgWidth = bitmap.width;
    imgHeight = bitmap.height;
    sourceElement = bitmap;
  } else {
    sourceElement = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      const objectUrl = URL.createObjectURL(file);
      el.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(el);
      };
      el.onerror = (e) => {
        URL.revokeObjectURL(objectUrl);
        reject(e);
      };
      el.src = objectUrl;
    });
    imgWidth = sourceElement.naturalWidth;
    imgHeight = sourceElement.naturalHeight;
  }

  const tileW = Math.floor(imgWidth / cols);
  const tileH = Math.floor(imgHeight / rows);
  const cleanW = tileW * cols;
  const cleanH = tileH * rows;

  const canvas = document.createElement('canvas');
  canvas.width = cleanW;
  canvas.height = cleanH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get canvas 2d context');

  const totalTiles = rows * cols;
  const permutation = generateTilePermutation(totalTiles, seed);

  // At scrambled position `scramIndex`, draw tile from `origIndex = permutation[scramIndex]`
  for (let scramIndex = 0; scramIndex < totalTiles; scramIndex++) {
    const origIndex = permutation[scramIndex];

    const origCol = origIndex % cols;
    const origRow = Math.floor(origIndex / cols);
    const sx = origCol * tileW;
    const sy = origRow * tileH;

    const scramCol = scramIndex % cols;
    const scramRow = Math.floor(scramIndex / cols);
    const dx = scramCol * tileW;
    const dy = scramRow * tileH;

    ctx.drawImage(sourceElement, sx, sy, tileW, tileH, dx, dy, tileW, tileH);
  }

  if (typeof (sourceElement as ImageBitmap).close === 'function') {
    (sourceElement as ImageBitmap).close();
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/webp', quality)
  );

  if (!blob) throw new Error('Failed to export scrambled WebP blob');

  const originalName = 'name' in file ? (file as File).name : 'image.png';
  const baseName = originalName.replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}.webp`, { type: 'image/webp' });
}

