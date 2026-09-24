import { GrayImage, ImageStats } from './types';

/**
 * Computes histogram h(r_k) = n_k
 */
export function computeHistogram(img: GrayImage, bins: number = 256): Uint32Array {
  const hist = new Uint32Array(bins);
  const factor = bins / img.L;
  const data = img.data;
  const len = data.length;

  for (let i = 0; i < len; i++) {
    const val = data[i];
    const bin = Math.min(bins - 1, Math.floor(val * factor));
    hist[bin]++;
  }
  return hist;
}

/**
 * Computes normalized histogram (PDF): p(r_k) = n_k / (M * N)
 */
export function normalizeHistogram(hist: Uint32Array, totalPixels: number): Float64Array {
  const pdf = new Float64Array(hist.length);
  if (totalPixels <= 0) return pdf;
  for (let i = 0; i < hist.length; i++) {
    pdf[i] = hist[i] / totalPixels;
  }
  return pdf;
}

/**
 * Computes Cumulative Distribution Function: c(r_k) = sum_{j<=k} p(r_j)
 */
export function computeCDF(pdf: Float64Array): Float64Array {
  const cdf = new Float64Array(pdf.length);
  let acc = 0;
  for (let i = 0; i < pdf.length; i++) {
    acc += pdf[i];
    cdf[i] = Math.min(1.0, acc);
  }
  if (cdf.length > 0) {
    cdf[cdf.length - 1] = 1.0; // numerical clamp
  }
  return cdf;
}

/**
 * Computes comprehensive statistical descriptors of an image
 */
export function computeStats(hist: Uint32Array, totalPixels: number): ImageStats {
  if (totalPixels === 0) {
    return { mean: 0, variance: 0, stdDev: 0, entropy: 0, min: 0, max: 0, totalPixels: 0 };
  }

  const pdf = normalizeHistogram(hist, totalPixels);
  let mean = 0;
  let min = -1;
  let max = 0;

  for (let r = 0; r < hist.length; r++) {
    if (hist[r] > 0) {
      if (min === -1) min = r;
      max = r;
    }
    mean += r * pdf[r];
  }

  let variance = 0;
  let entropy = 0;

  for (let r = 0; r < hist.length; r++) {
    const p = pdf[r];
    if (p > 0) {
      variance += Math.pow(r - mean, 2) * p;
      entropy -= p * Math.log2(p);
    }
  }

  return {
    mean,
    variance,
    stdDev: Math.sqrt(variance),
    entropy,
    min: min === -1 ? 0 : min,
    max,
    totalPixels,
  };
}

/**
 * Computes histogram intersection / L1 distance between two normalized histograms
 */
export function histogramIntersection(p1: Float64Array, p2: Float64Array): number {
  let intersection = 0;
  const len = Math.min(p1.length, p2.length);
  for (let i = 0; i < len; i++) {
    intersection += Math.min(p1[i], p2[i]);
  }
  return intersection;
}
