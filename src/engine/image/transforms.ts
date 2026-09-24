import { GrayImage } from './types';

/**
 * Converts RGB image data to Grayscale using custom weights [wR, wG, wB]
 */
export function toGray(
  rgbData: Uint8ClampedArray,
  w: number,
  h: number,
  weights: [number, number, number] = [0.299, 0.587, 0.114]
): GrayImage {
  const numPixels = w * h;
  const grayData = new Uint8ClampedArray(numPixels);
  const [wr, wg, wb] = weights;

  for (let i = 0; i < numPixels; i++) {
    const idx = i * 4;
    const r = rgbData[idx];
    const g = rgbData[idx + 1];
    const b = rgbData[idx + 2];
    const y = Math.round(wr * r + wg * g + wb * b);
    grayData[i] = Math.max(0, Math.min(255, y));
  }

  return { w, h, data: grayData, L: 256 };
}

/**
 * Resamples an image to new dimensions (N x N) using nearest-neighbor
 */
export function resampleImage(img: GrayImage, newW: number, newH: number): GrayImage {
  const outData = new Uint8ClampedArray(newW * newH);
  const xRatio = img.w / newW;
  const yRatio = img.h / newH;

  for (let y = 0; y < newH; y++) {
    const srcY = Math.min(img.h - 1, Math.floor(y * yRatio));
    for (let x = 0; x < newW; x++) {
      const srcX = Math.min(img.w - 1, Math.floor(x * xRatio));
      outData[y * newW + x] = img.data[srcY * img.w + srcX];
    }
  }

  return { w: newW, h: newH, data: outData, L: img.L };
}

/**
 * Quantize image to k bits with optional Floyd-Steinberg error diffusion dithering
 */
export function quantizeImage(img: GrayImage, bits: number, dither: boolean = false): GrayImage {
  const levels = Math.pow(2, bits);
  const step = 256 / levels;
  const w = img.w;
  const h = img.h;
  const outData = new Uint8ClampedArray(w * h);

  if (!dither) {
    for (let i = 0; i < img.data.length; i++) {
      const val = img.data[i];
      const level = Math.floor(val / step);
      outData[i] = Math.min(255, Math.round((level + 0.5) * step));
    }
    return { w, h, data: outData, L: img.L };
  }

  // Floyd-Steinberg dithering with floating point error buffer
  const errorBuf = new Float32Array(img.data);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const oldVal = errorBuf[idx];
      const level = Math.max(0, Math.min(levels - 1, Math.floor(oldVal / step)));
      const newVal = Math.min(255, Math.round((level + 0.5) * step));
      outData[idx] = newVal;

      const quantError = oldVal - newVal;

      if (x + 1 < w) errorBuf[idx + 1] += quantError * (7 / 16);
      if (x - 1 >= 0 && y + 1 < h) errorBuf[(y + 1) * w + (x - 1)] += quantError * (3 / 16);
      if (y + 1 < h) errorBuf[(y + 1) * w + x] += quantError * (5 / 16);
      if (x + 1 < w && y + 1 < h) errorBuf[(y + 1) * w + (x + 1)] += quantError * (1 / 16);
    }
  }

  return { w, h, data: outData, L: img.L };
}

/**
 * Mean Squared Error and Peak Signal-to-Noise Ratio
 */
export function computeMSEandPSNR(orig: GrayImage, processed: GrayImage): { mse: number; psnr: number } {
  const len = Math.min(orig.data.length, processed.data.length);
  if (len === 0) return { mse: 0, psnr: Infinity };

  let sumSqErr = 0;
  for (let i = 0; i < len; i++) {
    const diff = orig.data[i] - processed.data[i];
    sumSqErr += diff * diff;
  }

  const mse = sumSqErr / len;
  if (mse === 0) return { mse: 0, psnr: 99.99 }; // perfectly identical

  const maxVal = 255;
  const psnr = 10 * Math.log10((maxVal * maxVal) / mse);

  return { mse, psnr };
}

/**
 * CLAHE / Local Adaptive Histogram Equalization with tiling and bilinear interpolation
 */
export function localEqualize(
  img: GrayImage,
  tileGridSize: number = 8,
  clipLimit: number = 2.0,
  interpolate: boolean = true
): GrayImage {
  const { w, h, data } = img;
  const outData = new Uint8ClampedArray(w * h);

  const numTilesX = Math.max(1, Math.floor(w / tileGridSize));
  const numTilesY = Math.max(1, Math.floor(h / tileGridSize));

  // Compute CDF LUT for each tile
  const tileLUTs: Uint8ClampedArray[][] = [];

  for (let ty = 0; ty < numTilesY; ty++) {
    tileLUTs[ty] = [];
    const y0 = Math.floor(ty * (h / numTilesY));
    const y1 = Math.floor((ty + 1) * (h / numTilesY));

    for (let tx = 0; tx < numTilesX; tx++) {
      const x0 = Math.floor(tx * (w / numTilesX));
      const x1 = Math.floor((tx + 1) * (w / numTilesX));

      // Histogram of tile
      const hist = new Uint32Array(256);
      let count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          hist[data[y * w + x]]++;
          count++;
        }
      }

      // Clip limit
      if (clipLimit > 0 && count > 0) {
        const clipVal = Math.max(1, Math.floor((clipLimit * count) / 256));
        let excess = 0;
        for (let r = 0; r < 256; r++) {
          if (hist[r] > clipVal) {
            excess += hist[r] - clipVal;
            hist[r] = clipVal;
          }
        }
        const bonus = Math.floor(excess / 256);
        for (let r = 0; r < 256; r++) {
          hist[r] += bonus;
        }
      }

      // Equalization mapping for this tile
      const lut = new Uint8ClampedArray(256);
      let cum = 0;
      for (let r = 0; r < 256; r++) {
        cum += hist[r];
        lut[r] = Math.min(255, Math.round((255 * cum) / Math.max(1, count)));
      }
      tileLUTs[ty][tx] = lut;
    }
  }

  if (!interpolate) {
    // Sharp tile boundaries
    for (let y = 0; y < h; y++) {
      const ty = Math.min(numTilesY - 1, Math.floor((y / h) * numTilesY));
      for (let x = 0; x < w; x++) {
        const tx = Math.min(numTilesX - 1, Math.floor((x / w) * numTilesX));
        const val = data[y * w + x];
        outData[y * w + x] = tileLUTs[ty][tx][val];
      }
    }
    return { w, h, data: outData, L: 256 };
  }

  // Bilinear interpolation between tile center mappings
  const tileW = w / numTilesX;
  const tileH = h / numTilesY;

  for (let y = 0; y < h; y++) {
    // Relative coordinates in tile grid
    const normY = (y - tileH / 2) / tileH;
    const ty0 = Math.max(0, Math.min(numTilesY - 1, Math.floor(normY)));
    const ty1 = Math.max(0, Math.min(numTilesY - 1, ty0 + 1));
    const wy = Math.max(0, Math.min(1, normY - ty0));

    for (let x = 0; x < w; x++) {
      const normX = (x - tileW / 2) / tileW;
      const tx0 = Math.max(0, Math.min(numTilesX - 1, Math.floor(normX)));
      const tx1 = Math.max(0, Math.min(numTilesX - 1, tx0 + 1));
      const wx = Math.max(0, Math.min(1, normX - tx0));

      const val = data[y * w + x];

      const v00 = tileLUTs[ty0][tx0][val];
      const v01 = tileLUTs[ty0][tx1][val];
      const v10 = tileLUTs[ty1][tx0][val];
      const v11 = tileLUTs[ty1][tx1][val];

      const top = (1 - wx) * v00 + wx * v01;
      const bottom = (1 - wx) * v10 + wx * v11;
      const res = Math.round((1 - wy) * top + wy * bottom);

      outData[y * w + x] = Math.max(0, Math.min(255, res));
    }
  }

  return { w, h, data: outData, L: 256 };
}
