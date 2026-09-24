import { GrayImage } from './types';

export type ProceduralPreset =
  | 'lowContrast'
  | 'highContrast'
  | 'dark'
  | 'bright'
  | 'bimodal'
  | 'gradient'
  | 'checker'
  | 'uneven'
  | 'rings';

export interface PresetInfo {
  id: ProceduralPreset;
  name: string;
  description: string;
}

export const PRESETS: PresetInfo[] = [
  { id: 'lowContrast', name: 'Foggy Landscape (Low Contrast)', description: 'Narrow intensity histogram clustered in mid-grays.' },
  { id: 'highContrast', name: 'Geometric Solids (High Contrast)', description: 'Sharp edges with extreme dark and light values.' },
  { id: 'dark', name: 'Night Sky (Dark / Underexposed)', description: 'Heavy bias toward low intensities (0-60).' },
  { id: 'bright', name: 'Overexposed Beach (Bright)', description: 'Heavy bias toward high intensities (180-255).' },
  { id: 'bimodal', name: 'Coin on Slate (Bimodal)', description: 'Two distinct peaks: dark background and bright object.' },
  { id: 'gradient', name: 'Smooth Linear Ramp', description: 'Continuous gradient spanning full dynamic range.' },
  { id: 'checker', name: 'High-Frequency Checkerboard', description: 'Sharp repeating checker pattern for Nyquist sampling tests.' },
  { id: 'uneven', name: 'Uneven Spotlight Lighting', description: 'Strong local lighting gradient (bright top-left, dark bottom-right).' },
  { id: 'rings', name: 'Concentric Ripples', description: 'Harmonic frequency rings testing resolution and transform curves.' },
];

/**
 * Generates procedural grayscale images
 */
export function generateProceduralImage(preset: ProceduralPreset, size: number = 128): GrayImage {
  const w = size;
  const h = size;
  const data = new Uint8ClampedArray(w * h);

  for (let y = 0; y < h; y++) {
    const ny = y / (h - 1); // 0 to 1
    for (let x = 0; x < w; x++) {
      const nx = x / (w - 1); // 0 to 1
      const idx = y * w + x;
      let val = 128;

      switch (preset) {
        case 'lowContrast': {
          // Narrow range [100, 160] with subtle rolling hills
          const wave = Math.sin(nx * 4 * Math.PI) * Math.cos(ny * 4 * Math.PI);
          const hill = Math.sin(nx * 2) * 15;
          val = 130 + wave * 15 + hill;
          break;
        }

        case 'highContrast': {
          // Sharp circles and blocks with extreme contrast
          const cx = nx - 0.5;
          const cy = ny - 0.5;
          const dist = Math.sqrt(cx * cx + cy * cy);
          if (dist < 0.25) {
            val = 245;
          } else if (dist < 0.4) {
            val = 15;
          } else if (nx > 0.5 !== ny > 0.5) {
            val = 220;
          } else {
            val = 30;
          }
          break;
        }

        case 'dark': {
          // Underexposed night scene: values mostly 10-60 with a couple faint stars
          const base = 25 + Math.sin(nx * 3) * 10 + Math.cos(ny * 3) * 10;
          const star1 = (x === 30 && y === 40) || (x === 90 && y === 20) || (x === 65 && y === 85);
          val = star1 ? 240 : base;
          break;
        }

        case 'bright': {
          // Overexposed bright scene: values mostly 190-250
          const base = 215 + Math.sin(nx * 5) * 15 + Math.cos(ny * 5) * 15;
          val = base;
          break;
        }

        case 'bimodal': {
          // Dark background (~45) with bright circular disk (~210)
          const cx = nx - 0.5;
          const cy = ny - 0.5;
          const r = Math.sqrt(cx * cx + cy * cy);
          if (r < 0.28) {
            val = 210 + Math.sin(nx * 20) * 10;
          } else {
            val = 45 + Math.cos(ny * 20) * 10;
          }
          break;
        }

        case 'gradient': {
          // Smooth 2D diagonal gradient
          val = (nx * 0.7 + ny * 0.3) * 255;
          break;
        }

        case 'checker': {
          // 8x8 checkerboard blocks
          const cellX = Math.floor(nx * 8);
          const cellY = Math.floor(ny * 8);
          val = (cellX + cellY) % 2 === 0 ? 230 : 25;
          break;
        }

        case 'uneven': {
          // Spotlight from top-left + underlying pattern
          const lightIntensity = Math.max(0, 1.2 - Math.sqrt(nx * nx + ny * ny));
          const texture = (Math.sin(nx * 16 * Math.PI) * Math.sin(ny * 16 * Math.PI) + 1) * 0.5;
          val = (0.2 + 0.8 * texture) * lightIntensity * 255;
          break;
        }

        case 'rings': {
          // Concentric chirp / harmonic rings
          const cx = nx - 0.5;
          const cy = ny - 0.5;
          const r = Math.sqrt(cx * cx + cy * cy) * 2;
          const ring = Math.cos(r * r * 20 * Math.PI);
          val = (ring + 1) * 127.5;
          break;
        }
      }

      data[idx] = Math.max(0, Math.min(255, Math.round(val)));
    }
  }

  return { w, h, data, L: 256 };
}

/**
 * Loads an uploaded image file, downscales to max dimension, and converts to grayscale
 */
export function loadUserImage(file: File, maxSize: number = 256): Promise<GrayImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) {
            h = Math.round((h * maxSize) / w);
            w = maxSize;
          } else {
            w = Math.round((w * maxSize) / h);
            h = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas 2d context'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const rgba = imgData.data;
        const grayData = new Uint8ClampedArray(w * h);

        for (let i = 0; i < w * h; i++) {
          const idx = i * 4;
          // Standard luminance weights
          const y = 0.299 * rgba[idx] + 0.587 * rgba[idx + 1] + 0.114 * rgba[idx + 2];
          grayData[i] = Math.round(y);
        }

        resolve({ w, h, data: grayData, L: 256 });
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
