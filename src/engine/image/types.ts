export interface GrayImage {
  w: number;
  h: number;
  data: Uint8ClampedArray; // length w * h, values 0..L-1
  L: number; // default 256
}

export interface ColorImage {
  w: number;
  h: number;
  data: Uint8ClampedArray; // length w * h * 4 (RGBA)
}

export interface ImageStats {
  mean: number;
  variance: number;
  stdDev: number;
  entropy: number;
  min: number;
  max: number;
  totalPixels: number;
}
