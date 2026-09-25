import { GrayImage } from './types';
import { gaussK, convolve } from './filters';

/**
 * Image formation model: I(x,y) = L(x,y) · R(x,y)
 * L = illumination (slow, smooth lighting), R = reflectance (fast, intrinsic surface detail).
 *
 * Illumination is estimated the same way most Retinex implementations do it: a large-radius
 * Gaussian blur. Lighting varies slowly across a scene, so a wide blur keeps L but throws away R.
 */
export function estimateIllumination(img: GrayImage, sigma: number): GrayImage {
  const n = Math.max(3, Math.min(31, Math.round(sigma * 6) | 1));
  return convolve(img, gaussK(n, sigma), true);
}

/**
 * Recovers reflectance R = I / L (scaled back into 0..255), the direct (non-log) form of the model.
 * A small epsilon avoids division blow-ups in near-black pixels.
 */
export function divideReflectance(img: GrayImage, illum: GrayImage, gain = 128): GrayImage {
  const out = new Uint8ClampedArray(img.data.length);
  for (let i = 0; i < img.data.length; i++) {
    const L = Math.max(1, illum.data[i]);
    out[i] = Math.round((img.data[i] / L) * gain);
  }
  return { ...img, data: out };
}

/**
 * log I = log L + log R  →  log R = log I − log L.
 * Working in log space turns the multiplicative model into an additive one (classic single-scale Retinex).
 */
export function logReflectance(img: GrayImage, illum: GrayImage, gain = 32): GrayImage {
  const out = new Uint8ClampedArray(img.data.length);
  for (let i = 0; i < img.data.length; i++) {
    const logI = Math.log(1 + img.data[i]);
    const logL = Math.log(1 + Math.max(1, illum.data[i]));
    out[i] = Math.round(128 + gain * (logI - logL));
  }
  return { ...img, data: out };
}
