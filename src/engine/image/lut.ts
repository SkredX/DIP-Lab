import { GrayImage } from './types';

/**
 * Applies a 256-entry lookup table (LUT) to an input image
 */
export function applyLUT(img: GrayImage, lut: Uint8ClampedArray): GrayImage {
  const len = img.data.length;
  const outData = new Uint8ClampedArray(len);
  const src = img.data;

  for (let i = 0; i < len; i++) {
    outData[i] = lut[src[i]];
  }

  return {
    w: img.w,
    h: img.h,
    data: outData,
    L: img.L,
  };
}

/**
 * Creates a LUT from an arbitrary mathematical function s = T(r)
 */
export function lutFromFn(T: (r: number) => number, L: number = 256): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(L);
  for (let r = 0; r < L; r++) {
    const val = T(r);
    lut[r] = Math.max(0, Math.min(L - 1, Math.round(val)));
  }
  return lut;
}

/**
 * Computes histogram equalization mapping: s_k = round((L - 1) * c(r_k))
 */
export function equalizeLUT(cdf: Float64Array, L: number = 256): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(L);
  const maxVal = L - 1;
  const len = Math.min(L, cdf.length);

  for (let r = 0; r < len; r++) {
    lut[r] = Math.max(0, Math.min(maxVal, Math.round(maxVal * cdf[r])));
  }
  return lut;
}

/**
 * Computes histogram matching LUT: s = G^-1(T(r))
 * Maps source CDF to target CDF.
 */
export function matchLUT(cdfSrc: Float64Array, cdfTgt: Float64Array, L: number = 256): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(L);
  const tgtLen = cdfTgt.length;

  for (let r = 0; r < L; r++) {
    const srcVal = cdfSrc[r];
    // Find smallest z such that cdfTgt[z] >= srcVal
    let bestZ = 0;
    let minDiff = Infinity;

    for (let z = 0; z < tgtLen; z++) {
      const diff = Math.abs(cdfTgt[z] - srcVal);
      if (diff < minDiff) {
        minDiff = diff;
        bestZ = z;
      }
      // If we crossed and found an exact or greater match
      if (cdfTgt[z] >= srcVal && minDiff < 0.0001) {
        bestZ = z;
        break;
      }
    }

    lut[r] = Math.max(0, Math.min(L - 1, bestZ));
  }

  return lut;
}

/**
 * Inverts a monotonically increasing LUT.
 * Handles plateau / flat regions gracefully with nearest neighbor.
 */
export function invertMonotoneLUT(lut: Uint8ClampedArray, L: number = 256): {
  invLut: Uint8ClampedArray;
  isStrictlyMonotonic: boolean;
  flatSpots: number[];
} {
  const invLut = new Uint8ClampedArray(L);
  let isStrictlyMonotonic = true;
  const flatSpots: number[] = [];

  // Check monotonicity
  for (let r = 0; r < L - 1; r++) {
    if (lut[r + 1] < lut[r]) {
      isStrictlyMonotonic = false;
    } else if (lut[r + 1] === lut[r]) {
      flatSpots.push(r);
    }
  }

  // Construct inverse: for each output s, find input r such that lut[r] ≈ s
  for (let s = 0; s < L; s++) {
    let closestR = 0;
    let minDiff = Infinity;
    for (let r = 0; r < L; r++) {
      const diff = Math.abs(lut[r] - s);
      if (diff < minDiff) {
        minDiff = diff;
        closestR = r;
      }
    }
    invLut[s] = closestR;
  }

  return { invLut, isStrictlyMonotonic, flatSpots };
}

/**
 * Quantize LUT to k bits (L_k = 2^k levels)
 */
export function quantizeLUT(bits: number, L: number = 256): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(L);
  const levels = Math.pow(2, bits);
  const step = L / levels;

  for (let r = 0; r < L; r++) {
    const levelIdx = Math.floor(r / step);
    const quantizedVal = Math.min(L - 1, Math.round((levelIdx + 0.5) * step));
    lut[r] = quantizedVal;
  }
  return lut;
}
