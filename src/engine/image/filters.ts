import { GrayImage } from './types';

export type Kernel = number[][];
export const box = (n: number): Kernel => Array.from({ length: n }, () => Array(n).fill(1 / (n * n)));
export const gauss2 = (x: number, y: number, s: number) =>
  Math.exp(-(x * x + y * y) / (2 * s * s)) / (2 * Math.PI * s * s);

/** Gaussian kernel; normalized so the weights sum to 1 (unless norm=false) */
export function gaussK(n: number, s: number, norm = true): Kernel {
  const c = (n - 1) / 2;
  const k = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => gauss2(j - c, i - c, s)));
  const t = norm ? k.flat().reduce((a, b) => a + b, 0) : 1;
  return k.map((r) => r.map((v) => v / t));
}

export const KERNELS: Record<string, Kernel> = {
  identity: [[0, 0, 0], [0, 1, 0], [0, 0, 0]],
  box3: box(3),
  gauss3: [[1, 2, 1], [2, 4, 2], [1, 2, 1]].map((r) => r.map((v) => v / 16)),
  sharpen: [[0, -1, 0], [-1, 5, -1], [0, -1, 0]],
  edge: [[-1, -1, -1], [-1, 8, -1], [-1, -1, -1]],
  emboss: [[-2, -1, 0], [-1, 1, 1], [0, 1, 2]],
};

export const kSum = (k: Kernel) => k.flat().reduce((a, b) => a + b, 0);

/** 2D filtering with replicated borders. flip=true gives true convolution (kernel rotated 180°). */
export function convolve(img: GrayImage, k: Kernel, flip = true): GrayImage {
  const n = k.length, r = (n - 1) / 2, { w, h, data } = img;
  const out = new Uint8ClampedArray(w * h);
  const bias = Math.abs(kSum(k)) < 1e-9 ? 128 : 0; // zero-sum kernels: shift so negatives are visible
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const yy = Math.min(h - 1, Math.max(0, y + i - r)), xx = Math.min(w - 1, Math.max(0, x + j - r));
          acc += (flip ? k[n - 1 - i][n - 1 - j] : k[i][j]) * data[yy * w + xx];
        }
      out[y * w + x] = Math.round(acc + bias);
    }
  return { ...img, data: out };
}

/** n×n neighbourhood around (x,y), replicated borders */
export function patch(img: GrayImage, x: number, y: number, n: number): number[][] {
  const r = (n - 1) / 2;
  return Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      const yy = Math.min(img.h - 1, Math.max(0, y + i - r)), xx = Math.min(img.w - 1, Math.max(0, x + j - r));
      return img.data[yy * img.w + xx];
    }));
}

/** Seeded additive Gaussian noise, g = f + n */
export function addNoise(img: GrayImage, sigma: number, seed = 7): GrayImage {
  if (sigma <= 0) return img;
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out = new Uint8ClampedArray(img.data.length);
  for (let i = 0; i < out.length; i++) {
    const g = Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd());
    out[i] = Math.round(img.data[i] + sigma * g);
  }
  return { ...img, data: out };
}

/** Distance (px) over which a row goes from 10% to 90% of its range around the strongest edge */
export function edgeWidth(row: ArrayLike<number>): number {
  let bi = 0, bd = 0;
  for (let i = 1; i < row.length; i++) if (Math.abs(row[i] - row[i - 1]) > bd) { bd = Math.abs(row[i] - row[i - 1]); bi = i; }
  const lo = Math.min(...Array.from(row)), hi = Math.max(...Array.from(row));
  if (hi - lo < 1) return 0;
  const a = row[Math.max(0, bi - 12)], b = row[Math.min(row.length - 1, bi + 12)], up = b > a;
  const t = (p: number) => lo + (up ? p : 1 - p) * (hi - lo);
  let i0 = bi, i1 = bi;
  while (i0 > 0 && (up ? row[i0] > t(0.1) : row[i0] < t(0.9) + 0)) i0--;
  while (i1 < row.length - 1 && (up ? row[i1] < t(0.9) : row[i1] > t(0.1))) i1++;
  return i1 - i0;
}
