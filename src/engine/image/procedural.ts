import { GrayImage } from './types';

export type ProceduralPreset =
  | 'mountain' | 'dog' | 'portrait' | 'building'
  | 'lowContrast' | 'highContrast' | 'dark' | 'bright' | 'bimodal' | 'uneven'
  | 'gradient' | 'checker' | 'rings';

export interface PresetInfo { id: ProceduralPreset; name: string; description: string; photo?: boolean }

export const PRESETS: PresetInfo[] = [
  { id: 'mountain', name: 'Mountain lake', description: 'A sun, two peaks and their reflection — a normal, well-lit photo.', photo: true },
  { id: 'dog', name: 'Dog face', description: 'A simple cartoon dog — easy to recognise when the picture changes.', photo: true },
  { id: 'portrait', name: 'Portrait', description: 'A simple head-and-shoulders portrait, like a passport photo.', photo: true },
  { id: 'building', name: 'Monument', description: 'A tall building with columns, photographed against the sky.', photo: true },
  { id: 'lowContrast', name: 'Foggy mountain (flat)', description: 'The mountain photo taken in fog — everything looks washed-out grey.', photo: true },
  { id: 'highContrast', name: 'Monument (harsh sun)', description: 'The monument in strong midday sun — very dark shadows, very bright walls.', photo: true },
  { id: 'dark', name: 'Mountain at night', description: 'The same lake scene, badly under-lit — mostly black with a faint glow.', photo: true },
  { id: 'bright', name: 'Overexposed portrait', description: 'The portrait photo taken with too much flash — mostly white.', photo: true },
  { id: 'bimodal', name: 'Dog on white background', description: 'A dark dog face on a bright background — two clear brightness groups.', photo: true },
  { id: 'uneven', name: 'Monument, uneven lighting', description: 'The monument lit from one corner, like a lamp shining from the side.', photo: true },
  { id: 'gradient', name: 'Plain gradient (test pattern)', description: 'No photo — just black fading smoothly to white, left to right.' },
  { id: 'checker', name: 'Checkerboard (test pattern)', description: 'A repeating grid, useful for seeing sampling and resolution effects.' },
  { id: 'rings', name: 'Ripples (test pattern)', description: 'Circles that get tighter toward the edge, useful for testing fine detail.' },
];

// ---------- recognizable base scenes, drawn with simple shapes ----------
function mountainScene(nx: number, ny: number): number {
  const sky = 235 - ny * 90; // bright sky fading down
  const sun = Math.max(0, 1 - Math.hypot(nx - 0.78, ny - 0.18) / 0.09) * 60;
  const ridge = (cx: number, h: number, w: number) => Math.max(0, h - Math.abs(nx - cx) / w);
  const peakL = ridge(0.32, 0.62, 0.42), peakR = ridge(0.62, 0.72, 0.5);
  const mountains = Math.max(peakL, peakR);
  const isLake = ny > 0.72;
  if (isLake) {
    const wobble = Math.sin(nx * 40 + ny * 5) * 4;
    const reflection = Math.max(peakL, peakR) * 0.5;
    return Math.max(20, 130 - (ny - 0.72) * 60 - reflection * 90 + wobble);
  }
  if (mountains > ny) return 55 - (mountains - ny) * 40; // dark peak silhouette
  return Math.min(255, sky + sun);
}

function dogScene(nx: number, ny: number): number {
  const cx = nx - 0.5, cy = ny - 0.52;
  const face = Math.hypot(cx / 0.34, cy / 0.4) < 1;
  const earL = Math.hypot((nx - 0.24) / 0.16, (ny - 0.24) / 0.22) < 1 && ny < 0.4;
  const earR = Math.hypot((nx - 0.76) / 0.16, (ny - 0.24) / 0.22) < 1 && ny < 0.4;
  const eyeL = Math.hypot(nx - 0.38, ny - 0.46) < 0.035;
  const eyeR = Math.hypot(nx - 0.62, ny - 0.46) < 0.035;
  const nose = Math.hypot((nx - 0.5) / 1, (ny - 0.68) / 0.55) < 0.09;
  const snout = Math.hypot((nx - 0.5) / 0.22, (ny - 0.68) / 0.28) < 1;
  if (eyeL || eyeR || nose) return 15;
  if (snout) return 225;
  if (face || earL || earR) return 150 + Math.sin(nx * 30) * 6;
  return 235;
}

function portraitScene(nx: number, ny: number): number {
  const head = Math.hypot((nx - 0.5) / 0.24, (ny - 0.38) / 0.3) < 1 && ny < 0.62;
  const neck = Math.abs(nx - 0.5) < 0.08 && ny >= 0.55 && ny < 0.68;
  const shoulders = ny >= 0.66 && Math.abs(nx - 0.5) < 0.1 + (ny - 0.66) * 1.6;
  const eyeL = Math.hypot(nx - 0.42, ny - 0.36) < 0.025, eyeR = Math.hypot(nx - 0.58, ny - 0.36) < 0.025;
  const mouth = Math.abs(nx - 0.5) < 0.05 && Math.abs(ny - 0.5) < 0.012;
  if (eyeL || eyeR || mouth) return 30;
  if (head) return 190 + (nx - 0.5) * 40;
  if (neck) return 175;
  if (shoulders) return 90;
  return 235 - ny * 30;
}

function buildingScene(nx: number, ny: number): number {
  const sky = 210 - ny * 40;
  const tower = Math.abs(nx - 0.5) < 0.18 && ny > 0.22;
  const roof = ny > 0.14 && ny < 0.24 && Math.abs(nx - 0.5) < 0.22 - (ny - 0.14) * 0.4;
  const columns = tower && ny > 0.3 && (Math.round((nx - 0.32) * 26) % 3 === 0);
  const steps = ny > 0.88;
  if (steps) return 60;
  if (roof) return 200;
  if (columns) return 235;
  if (tower) return 120 - (0.9 - ny) * 10;
  return Math.max(30, sky);
}

const SCENES: Record<string, (nx: number, ny: number) => number> = {
  mountain: mountainScene, dog: dogScene, portrait: portraitScene, building: buildingScene,
};

export function generateProceduralImage(preset: ProceduralPreset, size: number = 160): GrayImage {
  const w = size, h = size;
  const data = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const ny = y / (h - 1);
    for (let x = 0; x < w; x++) {
      const nx = x / (w - 1);
      let val = 128;
      switch (preset) {
        case 'mountain': case 'dog': case 'portrait': case 'building':
          val = SCENES[preset](nx, ny); break;
        case 'lowContrast': // fog: compress the mountain scene into a narrow mid-grey band
          val = 110 + (mountainScene(nx, ny) - 128) * 0.22; break;
        case 'highContrast': { // harsh sun on the monument: push shadows to black, walls to white
          const b = buildingScene(nx, ny);
          val = b < 120 ? b * 0.25 : 210 + (b - 120) * 0.6; break; }
        case 'dark': // night: everything dim, a couple of lit windows/stars remain
          val = mountainScene(nx, ny) * 0.18 + (Math.hypot(nx - 0.78, ny - 0.18) < 0.06 ? 130 : 0); break;
        case 'bright': // overexposed: everything pushed toward white
          val = 190 + portraitScene(nx, ny) * 0.25; break;
        case 'bimodal': { // dog silhouette, but hard black/white split
          const d = dogScene(nx, ny);
          val = d < 100 ? 20 : d > 200 ? 235 : (nx * 71 + ny * 37) % 2 < 1 ? 30 : 220; break; }
        case 'uneven': { // building lit from one corner
          const spotlight = Math.max(0.25, 1.3 - Math.hypot(nx, ny) * 1.1);
          val = buildingScene(nx, ny) * spotlight; break; }
        case 'gradient':
          val = nx * 255; break;
        case 'checker': {
          const cellX = Math.floor(nx * 8), cellY = Math.floor(ny * 8);
          val = (cellX + cellY) % 2 === 0 ? 230 : 25; break; }
        case 'rings': {
          const cx = nx - 0.5, cy = ny - 0.5, r = Math.sqrt(cx * cx + cy * cy) * 2;
          val = (Math.cos(r * r * 20 * Math.PI) + 1) * 127.5; break; }
      }
      data[y * w + x] = Math.max(0, Math.min(255, Math.round(val)));
    }
  }
  return { w, h, data, L: 256 };
}

/** Shared step: draw a loaded <img>, downscale to max dimension, and flatten to grayscale. */
function imageElementToGray(img: HTMLImageElement, maxSize: number): GrayImage {
  let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  if (w > maxSize || h > maxSize) {
    if (w > h) { h = Math.round((h * maxSize) / w); w = maxSize; }
    else { w = Math.round((w * maxSize) / h); h = maxSize; }
  }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas 2d context');
  ctx.drawImage(img, 0, 0, w, h);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const grayData = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    grayData[i] = Math.round(0.299 * rgba[idx] + 0.587 * rgba[idx + 1] + 0.114 * rgba[idx + 2]);
  }
  return { w, h, data: grayData, L: 256 };
}

/** Loads an uploaded image file, downscales to max dimension, and converts to grayscale */
export function loadUserImage(file: File, maxSize: number = 256): Promise<GrayImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try { resolve(imageElementToGray(img, maxSize)); }
        catch (err) { reject(err); }
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Loads a real reference photo bundled with the app (from /public), downscales
 * it, and converts it to grayscale — same pipeline as an uploaded photo, just
 * sourced from a URL instead of a File.
 */
export function loadImageFromUrl(url: string, maxSize: number = 256): Promise<GrayImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try { resolve(imageElementToGray(img, maxSize)); }
      catch (err) { reject(err); }
    };
    img.onerror = reject;
    img.src = url;
  });
}

export interface RealSample { id: string; name: string; description: string; url: string }

/** Real reference photographs bundled with the app, shown alongside the generated presets. */
export const REAL_SAMPLES: RealSample[] = [
  { id: 'rose', name: 'Rose', description: 'Close-up rose flowers with soft, blurred petals and background.', url: '/samples/rose.jpg' },
  { id: 'taj-mahal', name: 'Taj Mahal', description: 'Wide architectural shot — domes, minarets and a long reflecting pool.', url: '/samples/taj-mahal.jpg' },
  { id: 'lamborghini', name: 'Sports car', description: 'A car on a plain studio background — flat, even lighting.', url: '/samples/lamborghini.jpg' },
  { id: 'bicycle', name: 'Bicycle', description: 'A bicycle against a textured wall, with strong directional shadow.', url: '/samples/bicycle.jpg' },
  { id: 'butterfly', name: 'Butterfly', description: 'A high-contrast butterfly on a near-black background — good for thresholding.', url: '/samples/butterfly.jpg' },
  { id: 'swan', name: 'Swan', description: 'A bright white swan on almost-black water — strong bimodal brightness.', url: '/samples/swan.jpg' },
];
