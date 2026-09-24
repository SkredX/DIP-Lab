import React, { useState, useMemo } from 'react';
import { LabModule, LabStageProps } from './types';
import { CanvasImage } from '../components/plots/CanvasImage';
import { LinePlot } from '../components/plots/LinePlot';
import { BarPlot } from '../components/plots/BarPlot';
import { AreaPlot } from '../components/plots/AreaPlot';
import { PixelGrid } from '../components/plots/PixelGrid';
import {
  resampleImage,
  quantizeImage,
  computeMSEandPSNR,
} from '../engine/image/transforms';
import {
  computeHistogram,
  normalizeHistogram,
  computeCDF,
  computeStats,
} from '../engine/image/histogram';
import { applyLUT, lutFromFn } from '../engine/image/lut';
import {
  buildGammaDerivationSteps,
  buildLogDerivationSteps,
  buildDiscreteCDFSteps,
  formatNum,
} from '../engine/math/stepEngine';
import { Step } from '../engine/math/types';
import { KatexView } from '../components/math/KatexView';

// ==========================================
// TOPIC 1: Digital Image
// ==========================================
export const digitalImageLab: LabModule = {
  slug: 'digital-image',
  params: [
    { id: 'resolution', kind: 'slider', label: 'Sampling Grid (N×N)', min: 16, max: 128, step: 16, default: 64, unit: 'px' },
    { id: 'bits', kind: 'slider', label: 'Quantization Depth (k bits)', min: 1, max: 8, step: 1, default: 8, unit: 'bits' },
    { id: 'showMagnifier', kind: 'toggle', label: 'Pixel Magnifier Lens', default: false, advancedOnly: false },
  ],
  presets: [
    { label: 'High Fidelity', params: { resolution: 128, bits: 8 } },
    { label: 'Severe Pixelation', params: { resolution: 16, bits: 8 } },
    { label: 'Extreme 1-Bit', params: { resolution: 64, bits: 1 } },
  ],
  Stage: ({ params, image }) => {
    const res = params.resolution ?? 64;
    const bits = params.bits ?? 8;
    const showMag = params.showMagnifier ?? false;

    const processed = useMemo(() => {
      const down = resampleImage(image, res, res);
      const quant = quantizeImage(down, bits);
      return resampleImage(quant, 128, 128); // upscale for visual comparison
    }, [image, res, bits]);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <CanvasImage image={image} title="Continuous Analog Scene (High Res)" />
        <div className="flex flex-col items-center">
          <CanvasImage
            image={processed}
            title={`Sampled (${res}×${res}) & Quantized (${bits}-bit)`}
            showMagnifier={showMag}
          />
        </div>
      </div>
    );
  },
  Explain: ({ mode, params }) => {
    const N = params.resolution ?? 64;
    const k = params.bits ?? 8;
    const L = Math.pow(2, k);

    if (mode === 'advanced') {
      return (
        <>
          <p>
            An analog image <span className="font-mono text-accent">f(x, y)</span> is continuous in both spatial coordinates and amplitude. To process it digitally, two independent discretizations occur:
          </p>
          <ul className="list-disc list-inside space-y-1 my-1 text-xs">
            <li><strong>Spatial Sampling:</strong> Discretizes coordinates (x,y) into an N×N grid with interval Δx = W/N.</li>
            <li><strong>Amplitude Quantization:</strong> Discretizes continuous brightness into L = 2^k discrete levels with step Δ = 256/L.</li>
          </ul>
          <p className="text-xs text-text-muted">
            Reducing N below the Nyquist rate causes spatial aliasing (jagged edges). Reducing k causes intensity posterization (false contours).
          </p>
        </>
      );
    }
    return (
      <>
        <p>
          Think of a digital camera sensor: it places a grid of tiny light-sensitive buckets (pixels) over the real world.
        </p>
        <p>
          <strong>Sampling</strong> controls how many pixels you have (resolution). <strong>Quantization</strong> controls how many shades of gray each pixel can represent (bits).
        </p>
        <p className="text-xs text-accent font-medium">
          Try setting bits to 1: the image becomes pure black and white!
        </p>
      </>
    );
  },
  buildSteps: (params, image) => {
    const N = params.resolution ?? 64;
    const k = params.bits ?? 8;
    const L = Math.pow(2, k);
    const rawBits = N * N * k;
    const rawBytes = rawBits / 8;
    const delta = 256 / L;

    return [
      {
        id: 'sampling-interval',
        title: 'Spatial Sampling Interval',
        latex: `\\Delta x = \\frac{W}{N}`,
        substituted: `\\Delta x = \\frac{${image.w}\\text{ px}}{${N}} = ${formatNum(image.w / N, 2)}\\text{ pixels per sample}`,
        rationale: 'Distance between adjacent sensor elements.',
        value: image.w / N,
      },
      {
        id: 'quantization-step',
        title: 'Quantization Step Size',
        latex: `\\Delta = \\frac{L_{\\max}}{2^k} = \\frac{256}{${L}}`,
        substituted: `\\Delta = \\frac{256}{${L}} = ${formatNum(delta, 2)}\\text{ intensity units per level}`,
        rationale: 'Intensity interval mapped to a single integer code.',
        value: delta,
      },
      {
        id: 'storage-size',
        title: 'Raw Uncompressed Storage Footprint',
        latex: `b = M \\cdot N \\cdot k \\text{ bits} = \\frac{M \\cdot N \\cdot k}{8} \\text{ bytes}`,
        substituted: `b = ${N} \\times ${N} \\times ${k} = ${rawBits.toLocaleString()} \\text{ bits} = ${rawBytes.toLocaleString()} \\text{ bytes}`,
        rationale: 'Total digital memory required to store uncompressed raster buffer.',
        value: rawBytes,
      },
    ];
  },
};

// ==========================================
// TOPIC 2: Grayscale Image
// ==========================================
export const grayscaleImageLab: LabModule = {
  slug: 'grayscale-image',
  params: [
    { id: 'wR', kind: 'slider', label: 'Red Channel Weight (w_R)', min: 0, max: 1, step: 0.05, default: 0.299 },
    { id: 'wG', kind: 'slider', label: 'Green Channel Weight (w_G)', min: 0, max: 1, step: 0.05, default: 0.587 },
    { id: 'wB', kind: 'slider', label: 'Blue Channel Weight (w_B)', min: 0, max: 1, step: 0.05, default: 0.114 },
    { id: 'normalize', kind: 'toggle', label: 'Enforce Σw = 1', default: true },
  ],
  presets: [
    { label: 'Perceptual Luminance (ITU-R BT.601)', params: { wR: 0.299, wG: 0.587, wB: 0.114, normalize: true } },
    { label: 'Simple Average', params: { wR: 0.333, wG: 0.333, wB: 0.333, normalize: true } },
    { label: 'Green Emphasis (High Contrast)', params: { wR: 0.1, wG: 0.8, wB: 0.1, normalize: true } },
  ],
  Stage: ({ params, image }) => {
    let wr = params.wR ?? 0.299;
    let wg = params.wG ?? 0.587;
    let wb = params.wB ?? 0.114;

    if (params.normalize) {
      const sum = wr + wg + wb || 1;
      wr /= sum;
      wg /= sum;
      wb /= sum;
    }

    const processed = useMemo(() => {
      // Simulate synthetic RGB channels from base image
      const len = image.data.length;
      const out = new Uint8ClampedArray(len);
      for (let i = 0; i < len; i++) {
        const base = image.data[i];
        const r = Math.min(255, base * 1.1);
        const g = base;
        const b = Math.max(0, base * 0.85);
        out[i] = Math.round(wr * r + wg * g + wb * b);
      }
      return { w: image.w, h: image.h, data: out, L: 256 };
    }, [image, wr, wg, wb]);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <CanvasImage image={image} title="Source Reference" />
        <CanvasImage image={processed} title={`Weighted Luminance (Y = ${formatNum(wr,2)}R + ${formatNum(wg,2)}G + ${formatNum(wb,2)}B)`} />
      </div>
    );
  },
  Explain: ({ mode, params }) => {
    if (mode === 'advanced') {
      return (
        <>
          <p>
            Color images contain a vector of spectral intensities <span className="font-mono text-accent">[R, G, B]^T</span> at each coordinate. Converting to monochrome requires a projection onto a 1D luminance subspace:
          </p>
          <div className="font-mono text-xs bg-surface-mutedLight dark:bg-surface-mutedDark p-2 rounded-lg">
            Y = w_R \cdot R + w_G \cdot G + w_B \cdot B
          </div>
          <p className="text-xs text-text-muted">
            The standard ITU-R Recommendation BT.601 weights (0.299, 0.587, 0.114) reflect the human eye&apos;s peak photopic spectral sensitivity to green wavelengths.
          </p>
        </>
      );
    }
    return (
      <>
        <p>
          A color image has 3 color numbers for every dot: Red, Green, and Blue. Grayscale turns that into just one brightness number.
        </p>
        <p>
          Human eyes are much more sensitive to green than to blue. That is why green gets almost 60% of the weight in standard grayscale conversion!
        </p>
      </>
    );
  },
  buildSteps: (params) => {
    let wr = params.wR ?? 0.299;
    let wg = params.wG ?? 0.587;
    let wb = params.wB ?? 0.114;
    const sum = wr + wg + wb;

    return [
      {
        id: 'weights-sum',
        title: 'Channel Weight Normalization Check',
        latex: `\\sum w_c = w_R + w_G + w_B = 1.0`,
        substituted: `${formatNum(wr)} + ${formatNum(wg)} + ${formatNum(wb)} = ${formatNum(sum, 3)}`,
        rationale: sum === 1 ? 'Weights are properly normalized; dynamic range [0, 255] is preserved.' : 'Sum deviates from 1; image may be artificially brightened or dimmed.',
        value: sum,
      },
      {
        id: 'luminance-formula',
        title: 'Substituted Luminance Equation',
        latex: `Y(x,y) = w_R \\cdot R(x,y) + w_G \\cdot G(x,y) + w_B \\cdot B(x,y)`,
        substituted: `Y = ${formatNum(wr, 3)}R + ${formatNum(wg, 3)}G + ${formatNum(wb, 3)}B`,
        rationale: 'Linear combination applied to every RGB pixel vector.',
      },
    ];
  },
};

// ==========================================
// TOPIC 3: Pixel Intensity
// ==========================================
export const pixelIntensityLab: LabModule = {
  slug: 'pixel-intensity',
  params: [
    { id: 'profileRow', kind: 'slider', label: 'Scanline Row (Y)', min: 0, max: 127, step: 1, default: 64, unit: 'row' },
    { id: 'offset', kind: 'slider', label: 'Brightness Offset', min: -50, max: 50, step: 5, default: 0 },
  ],
  presets: [
    { label: 'Midline Profile', params: { profileRow: 64, offset: 0 } },
    { label: 'Top Highlights', params: { profileRow: 20, offset: 20 } },
    { label: 'Dark Floor', params: { profileRow: 110, offset: -25 } },
  ],
  Stage: ({ params, image }) => {
    const row = params.profileRow ?? 64;
    const offset = params.offset ?? 0;

    const modifiedImg = useMemo(() => {
      if (offset === 0) return image;
      const len = image.data.length;
      const out = new Uint8ClampedArray(len);
      for (let i = 0; i < len; i++) {
        out[i] = Math.max(0, Math.min(255, image.data[i] + offset));
      }
      return { w: image.w, h: image.h, data: out, L: 256 };
    }, [image, offset]);

    // Extract row data
    const rowData = useMemo(() => {
      const vals: number[] = [];
      const start = row * modifiedImg.w;
      for (let x = 0; x < modifiedImg.w; x++) {
        vals.push(modifiedImg.data[start + x]);
      }
      return vals;
    }, [modifiedImg, row]);

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <CanvasImage
            image={modifiedImg}
            title="Image with Active Scanline"
            lineProfileY={row}
          />
          <div className="w-full sm:w-[320px]">
            <LinePlot
              data={rowData}
              xLabel="Horizontal Pixel Position (X)"
              yLabel="Pixel Intensity f(x)"
              showIdentity={false}
            />
          </div>
        </div>
      </div>
    );
  },
  Explain: ({ mode, params }) => {
    return (
      <>
        <p>
          At its core, a digital image is a 2D spatial function <span className="font-mono text-accent">f(x, y)</span> whose value represents physical optical brightness at coordinate (x, y).
        </p>
        <p>
          The <strong>line profile plot</strong> cuts horizontally across the image at row {params.profileRow ?? 64}. Peaks correspond to bright structures and valleys correspond to dark shadows.
        </p>
      </>
    );
  },
  buildSteps: (params, image) => {
    const row = params.profileRow ?? 64;
    const start = row * image.w;
    let sum = 0;
    for (let x = 0; x < image.w; x++) {
      sum += image.data[start + x];
    }
    const mean = sum / image.w;

    return [
      {
        id: 'intensity-notation',
        title: 'Pixel Function Representation',
        latex: `r = f(x, y) \\in [0, L - 1]`,
        substituted: `f(x, ${row}) \\implies \\text{Row vector of } ${image.w} \\text{ scalar samples}`,
        rationale: 'Brightness represented as a 2D scalar field.',
      },
      {
        id: 'scanline-mean',
        title: 'Average Intensity of Active Scanline',
        latex: `\\bar{f}_y = \\frac{1}{W} \\sum_{x=0}^{W-1} f(x, y)`,
        substituted: `\\bar{f}_{${row}} = \\frac{${sum}}{${image.w}} = ${formatNum(mean, 2)}`,
        rationale: 'Mean gray level along the selected horizontal slice.',
        value: mean,
      },
    ];
  },
};

// ==========================================
// TOPIC 4: Intensity Levels (8-bit Image)
// ==========================================
export const intensityLevelsLab: LabModule = {
  slug: 'intensity-levels',
  params: [
    { id: 'bits', kind: 'slider', label: 'Bit Depth (k bits)', min: 1, max: 8, step: 1, default: 8, unit: 'bits' },
    { id: 'dither', kind: 'toggle', label: 'Floyd-Steinberg Dithering', default: false, advancedOnly: true },
  ],
  presets: [
    { label: '8-bit (Full 256 Levels)', params: { bits: 8, dither: false } },
    { label: '4-bit (16 Levels - Noticeable Banding)', params: { bits: 4, dither: false } },
    { label: '2-bit (4 Levels)', params: { bits: 2, dither: false } },
    { label: '1-bit with Dithering', params: { bits: 1, dither: true } },
  ],
  Stage: ({ params, image }) => {
    const bits = params.bits ?? 8;
    const dither = params.dither ?? false;

    const processed = useMemo(() => {
      return quantizeImage(image, bits, dither);
    }, [image, bits, dither]);

    const staircase = useMemo(() => {
      const levels = Math.pow(2, bits);
      const step = 256 / levels;
      const pts: number[] = [];
      for (let r = 0; r < 256; r++) {
        const lvl = Math.floor(r / step);
        pts.push(Math.min(255, Math.round((lvl + 0.5) * step)));
      }
      return pts;
    }, [bits]);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <CanvasImage image={processed} title={`Quantized Image (${Math.pow(2, bits)} Gray Levels)`} />
        <div className="w-full sm:w-[320px]">
          <LinePlot
            data={staircase}
            xLabel="Input Intensity (r)"
            yLabel="Quantized Output (s)"
            showIdentity={true}
          />
        </div>
      </div>
    );
  },
  Explain: ({ mode, params }) => {
    const k = params.bits ?? 8;
    const L = Math.pow(2, k);
    if (mode === 'advanced') {
      return (
        <>
          <p>
            An 8-bit image stores intensities using integers in <span className="font-mono text-accent">[0, 255]</span>, providing L = 256 distinct gray levels.
          </p>
          <p>
            When bit depth k drops below 6 bits (L &lt; 64), smooth gradients break into visible steps—a perceptual artifact called <strong>false contouring</strong> or <strong>posterization</strong>.
          </p>
          <p className="text-xs text-text-muted">
            The staircase plot visualizes the many-to-one quantization mapping <span className="font-mono">s = Q(r)</span>.
          </p>
        </>
      );
    }
    return (
      <>
        <p>
          Most regular digital photos are <strong>8-bit</strong>, meaning they have 256 shades of gray between black and white.
        </p>
        <p>
          Slide the bit depth down to 3 or 2: notice how smooth skies or gradients break into ugly stripes! This is called banding.
        </p>
      </>
    );
  },
  buildSteps: (params, image) => {
    const k = params.bits ?? 8;
    const L = Math.pow(2, k);
    const delta = 256 / L;
    const processed = quantizeImage(image, k, params.dither ?? false);
    const { mse, psnr } = computeMSEandPSNR(image, processed);

    return [
      {
        id: 'levels-count',
        title: 'Number of Discrete Intensity Levels',
        latex: `L = 2^k`,
        substituted: `L = 2^{${k}} = ${L} \\text{ levels}`,
        rationale: 'Total discrete quantization bins available.',
        value: L,
      },
      {
        id: 'quantization-step',
        title: 'Quantization Interval Step',
        latex: `\\Delta = \\frac{256}{L}`,
        substituted: `\\Delta = \\frac{256}{${L}} = ${formatNum(delta, 2)}`,
        rationale: 'Intensity range collapsed into each discrete level.',
        value: delta,
      },
      {
        id: 'psnr-metric',
        title: 'Peak Signal-to-Noise Ratio (PSNR)',
        latex: `\\text{PSNR} = 10 \\log_{10}\\left(\\frac{255^2}{\\text{MSE}}\\right)`,
        substituted: `\\text{MSE} = ${formatNum(mse, 2)} \\implies \\text{PSNR} = ${formatNum(psnr, 2)} \\text{ dB}`,
        rationale: 'Higher PSNR indicates lower quantization error distortion.',
        value: psnr,
      },
    ];
  },
};

// ==========================================
// TOPIC 5: Image Representation as a Matrix
// ==========================================
export const imageAsMatrixLab: LabModule = {
  slug: 'image-as-matrix',
  params: [
    { id: 'regionSize', kind: 'slider', label: 'Region Window Size', min: 4, max: 8, step: 1, default: 6, unit: '×' },
    { id: 'showNumbers', kind: 'toggle', label: 'Show Cell Intensity Numbers', default: true },
    { id: 'heatmap', kind: 'toggle', label: 'Pseudocolor Heatmap Mode', default: false },
    { id: 'brightnessShift', kind: 'slider', label: 'Scalar Brightness Shift (F + c)', min: -50, max: 50, step: 10, default: 0, advancedOnly: true },
  ],
  presets: [
    { label: '6×6 Default Region', params: { regionSize: 6, showNumbers: true, heatmap: false, brightnessShift: 0 } },
    { label: '8×8 Pseudocolor Heatmap', params: { regionSize: 8, showNumbers: true, heatmap: true, brightnessShift: 0 } },
    { label: 'Add Scalar +30', params: { regionSize: 6, showNumbers: true, heatmap: false, brightnessShift: 30 } },
  ],
  Stage: ({ params, image }) => {
    const size = params.regionSize ?? 6;
    const showNums = params.showNumbers ?? true;
    const heat = params.heatmap ?? false;
    const shift = params.brightnessShift ?? 0;

    const [customCells, setCustomCells] = useState<Record<string, number>>({});

    const matrix = useMemo(() => {
      const mat: number[][] = [];
      const startX = Math.floor((image.w - size) / 2);
      const startY = Math.floor((image.h - size) / 2);

      for (let r = 0; r < size; r++) {
        const row: number[] = [];
        for (let c = 0; c < size; c++) {
          const key = `${r}-${c}`;
          if (customCells[key] !== undefined) {
            row.push(customCells[key]);
          } else {
            const raw = image.data[(startY + r) * image.w + (startX + c)];
            row.push(Math.max(0, Math.min(255, raw + shift)));
          }
        }
        mat.push(row);
      }
      return mat;
    }, [image, size, shift, customCells]);

    const handleCellChange = (r: number, c: number, val: number) => {
      setCustomCells((prev) => ({ ...prev, [`${r}-${c}`]: val }));
    };

    return (
      <div className="flex flex-col items-center justify-center gap-6">
        <PixelGrid
          matrix={matrix}
          showNumbers={showNums}
          heatmap={heat}
          onCellChange={handleCellChange}
        />
      </div>
    );
  },
  Explain: ({ mode, params }) => {
    if (mode === 'advanced') {
      return (
        <>
          <p>
            Mathematically, a digital image is represented as an M×N matrix of real or integer intensity values:
          </p>
          <div className="py-1">
            <KatexView math="F = [f(i, j)]_{M \times N}" displayMode />
          </div>
          <p className="text-xs text-text-muted">
            Fundamental image transformations correspond to elementary matrix operations: scalar addition (F + c) shifts brightness, while scalar multiplication (αF) alters contrast.
          </p>
        </>
      );
    }
    return (
      <>
        <p>
          Under the hood, every image on your screen is just a spreadsheet of numbers between 0 and 255!
        </p>
        <p>
          <strong>Click any box above</strong> to change its number: watch how the pixel immediately changes shade!
        </p>
      </>
    );
  },
  buildSteps: (params, image) => {
    const size = params.regionSize ?? 6;
    const shift = params.brightnessShift ?? 0;
    const totalBytes = image.w * image.h;

    return [
      {
        id: 'matrix-dimension',
        title: 'Matrix Order and Storage',
        latex: `F \\in \\mathbb{R}^{M \\times N} \\quad M = ${image.h}, \\, N = ${image.w}`,
        substituted: `${image.h} \\times ${image.w} = ${totalBytes.toLocaleString()} \\text{ matrix elements (bytes)}`,
        rationale: '2D matrix containing scalar gray level entries.',
        value: totalBytes,
      },
      {
        id: 'matrix-operation',
        title: 'Linear Algebraic Point Operation',
        latex: `F' = F + c \\cdot J`,
        substituted: `F'_{i,j} = \\max(0, \\min(255, F_{i,j} + ${shift}))`,
        rationale: 'Adding a constant scalar shifts every matrix element uniformly.',
      },
    ];
  },
};

// ==========================================
// TOPIC 6: Intensity Transformation
// ==========================================
export const intensityTransformationLab: LabModule = {
  slug: 'intensity-transformation',
  params: [
    { id: 'type', kind: 'select', label: 'Function Family', options: [
      { value: 'gamma', label: 'Power-Law (Gamma: s = c·r^γ)' },
      { value: 'log', label: 'Logarithmic (s = c·ln(1+r))' },
      { value: 'negative', label: 'Image Negative (s = 255 - r)' },
    ], default: 'gamma' },
    { id: 'gamma', kind: 'slider', label: 'Gamma Exponent (γ)', min: 0.1, max: 3.5, step: 0.1, default: 0.6 },
    { id: 'c', kind: 'slider', label: 'Scale Factor (c)', min: 0.5, max: 1.5, step: 0.05, default: 1.0 },
    { id: 'probedR', kind: 'slider', label: 'Probe Intensity r', min: 0, max: 255, step: 1, default: 100, advancedOnly: true },
  ],
  presets: [
    { label: 'Brighten Shadows (γ = 0.5)', params: { type: 'gamma', gamma: 0.5, c: 1.0 } },
    { label: 'Darken Highlights (γ = 2.2)', params: { type: 'gamma', gamma: 2.2, c: 1.0 } },
    { label: 'Log Compression', params: { type: 'log', gamma: 1.0, c: 1.0 } },
    { label: 'Negative / Invert', params: { type: 'negative', gamma: 1.0, c: 1.0 } },
  ],
  Stage: ({ params, image }) => {
    const type = params.type ?? 'gamma';
    const gamma = params.gamma ?? 0.6;
    const c = params.c ?? 1.0;
    const probedR = params.probedR ?? 100;

    const lut = useMemo(() => {
      return lutFromFn((r) => {
        if (type === 'negative') return 255 - r;
        if (type === 'log') {
          const scaledC = (255 / Math.log(256)) * c;
          return scaledC * Math.log(1 + r);
        }
        // Power-law
        const norm = r / 255;
        return c * 255 * Math.pow(norm, gamma);
      });
    }, [type, gamma, c]);

    const transformed = useMemo(() => applyLUT(image, lut), [image, lut]);

    // Compute derivative slope at probedR for tangent display
    const tangentSlope = useMemo(() => {
      if (type === 'negative') return -1;
      if (type === 'log') {
        const scaledC = (255 / Math.log(256)) * c;
        return scaledC / (1 + probedR);
      }
      const norm = Math.max(0.001, probedR / 255);
      return c * gamma * Math.pow(norm, gamma - 1);
    }, [type, gamma, c, probedR]);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <CanvasImage image={transformed} title="Transformed Image s = T(r)" />
        <div className="w-full sm:w-[320px]">
          <LinePlot
            data={Array.from(lut)}
            xLabel="Input Intensity (r)"
            yLabel="Output Intensity (s)"
            probedX={probedR}
            tangentSlope={tangentSlope}
            showIdentity={true}
          />
        </div>
      </div>
    );
  },
  Explain: ({ mode, params }) => {
    const gamma = params.gamma ?? 0.6;
    if (mode === 'advanced') {
      return (
        <>
          <p>
            Spatial domain point processing applies a mapping function <span className="font-mono text-accent">s = T(r)</span> independently to every pixel.
          </p>
          <p>
            The derivative <span className="font-mono">T&apos;(r) = ds/dr</span> dictates local contrast behavior:
          </p>
          <ul className="list-disc list-inside space-y-1 my-1 text-xs">
            <li><strong>T&apos;(r) &gt; 1:</strong> Stretches contrast in that intensity band.</li>
            <li><strong>T&apos;(r) &lt; 1:</strong> Compresses contrast.</li>
          </ul>
        </>
      );
    }
    return (
      <>
        <p>
          An intensity curve maps every brightness level in the original image to a new brightness level.
        </p>
        <p>
          When the curve bows <strong>upward (γ &lt; 1)</strong>, dark shadows get brightened without blowing out highlights. When it bows <strong>downward (γ &gt; 1)</strong>, the image gets darker and more punchy.
        </p>
      </>
    );
  },
  buildSteps: (params) => {
    const type = params.type ?? 'gamma';
    const gamma = params.gamma ?? 0.6;
    const c = params.c ?? 1.0;
    const probedR = params.probedR ?? 100;

    if (type === 'log') {
      return buildLogDerivationSteps(c, probedR);
    }
    if (type === 'negative') {
      return [
        {
          id: 'negative-formula',
          title: 'Image Negative Transformation',
          latex: `s = T(r) = (L - 1) - r = 255 - r`,
          substituted: `s = 255 - ${probedR} = ${255 - probedR}`,
          rationale: 'Inverts intensity values, producing the photographic negative.',
          value: 255 - probedR,
          highlight: { plot: 'curve', kind: 'point', at: probedR },
        },
        {
          id: 'negative-deriv',
          title: 'Derivative of Negative Mapping',
          latex: `\\frac{ds}{dr} = \\frac{d}{dr}[255 - r] = -1`,
          substituted: `\\frac{ds}{dr} = -1 \\quad (\\text{constant slope across all } r)`,
          rationale: 'Slope is negative unity everywhere: contrast magnitude is preserved identically while reversing polarity.',
          value: -1,
          highlight: { plot: 'curve', kind: 'tangent', at: probedR },
        },
      ];
    }
    return buildGammaDerivationSteps(c, gamma, probedR);
  },
};

// ==========================================
// TOPIC 7: Image Histogram
// ==========================================
export const imageHistogramLab: LabModule = {
  slug: 'image-histogram',
  params: [
    { id: 'bins', kind: 'select', label: 'Bin Count', options: [
      { value: '256', label: '256 Bins (Full 1:1)' },
      { value: '128', label: '128 Bins' },
      { value: '64', label: '64 Bins' },
      { value: '32', label: '32 Bins (Coarse)' },
    ], default: '256' },
    { id: 'brushMin', kind: 'slider', label: 'Range Brush Min (r_min)', min: 0, max: 255, step: 5, default: 80 },
    { id: 'brushMax', kind: 'slider', label: 'Range Brush Max (r_max)', min: 0, max: 255, step: 5, default: 180 },
    { id: 'enableBrush', kind: 'toggle', label: 'Highlight Matching Pixels', default: true },
  ],
  presets: [
    { label: 'Mid-Tones Brush [80, 180]', params: { brushMin: 80, brushMax: 180, enableBrush: true, bins: '256' } },
    { label: 'Shadows Only [0, 60]', params: { brushMin: 0, brushMax: 60, enableBrush: true, bins: '256' } },
    { label: 'Highlights [200, 255]', params: { brushMin: 200, brushMax: 255, enableBrush: true, bins: '256' } },
  ],
  Stage: ({ params, image }) => {
    const bins = parseInt(params.bins ?? '256', 10);
    const minR = params.brushMin ?? 80;
    const maxR = params.brushMax ?? 180;
    const enableBrush = params.enableBrush ?? true;

    const hist = useMemo(() => computeHistogram(image, bins), [image, bins]);
    const brushedRange: [number, number] | null = enableBrush ? [Math.min(minR, maxR), Math.max(minR, maxR)] : null;

    const [probedBin, setProbedBin] = useState<number | null>(null);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <CanvasImage
          image={image}
          title="Image with Pixel Range Mask"
          brushedRange={brushedRange}
        />
        <div className="w-full sm:w-[340px]">
          <BarPlot
            data={hist}
            xLabel="Gray Level Intensity (r_k)"
            yLabel="Pixel Count h(r_k)"
            brushedRange={brushedRange}
            probedBin={probedBin}
            onHoverBin={setProbedBin}
          />
        </div>
      </div>
    );
  },
  Explain: ({ mode, params }) => {
    return (
      <>
        <p>
          The <strong>histogram</strong> <span className="font-mono text-accent">h(r_k) = n_k</span> counts how many pixels in the image have gray level <span className="font-mono">r_k</span>.
        </p>
        <p>
          Adjust the <strong>Range Brush sliders</strong>: see the corresponding pixels instantly light up in vibrant green on the image! This connects mathematical distribution directly to spatial content.
        </p>
      </>
    );
  },
  buildSteps: (params, image) => {
    const bins = parseInt(params.bins ?? '256', 10);
    const hist = computeHistogram(image, bins);
    const total = image.w * image.h;
    const stats = computeStats(hist, total);

    return [
      {
        id: 'total-pixel-conservation',
        title: 'Pixel Conservation Law',
        latex: `\\sum_{k=0}^{L-1} n_k = M \\cdot N`,
        substituted: `\\sum n_k = ${total.toLocaleString()} \\text{ pixels}`,
        rationale: 'Every pixel in the image belongs to exactly one histogram bin.',
        value: total,
      },
      {
        id: 'mean-intensity',
        title: 'Statistical Mean (Brightness)',
        latex: `\\mu = \\sum_{k=0}^{L-1} r_k \\cdot p(r_k) = \\frac{1}{MN} \\sum_{k=0}^{L-1} r_k \\cdot n_k`,
        substituted: `\\mu = ${formatNum(stats.mean, 2)} \\text{ (out of 255)}`,
        rationale: 'Average gray level across the entire scene.',
        value: stats.mean,
      },
      {
        id: 'variance-contrast',
        title: 'Variance & Contrast (Standard Deviation)',
        latex: `\\sigma^2 = \\sum_{k=0}^{L-1} (r_k - \\mu)^2 \\cdot p(r_k) \\implies \\sigma = \\sqrt{\\sigma^2}`,
        substituted: `\\sigma^2 = ${formatNum(stats.variance, 1)} \\implies \\sigma = ${formatNum(stats.stdDev, 2)}`,
        rationale: 'Standard deviation measures overall visual contrast spread.',
        value: stats.stdDev,
      },
      {
        id: 'shannon-entropy',
        title: 'Shannon Information Entropy',
        latex: `H = -\\sum_{k=0}^{L-1} p(r_k) \\log_2 p(r_k)`,
        substituted: `H = ${formatNum(stats.entropy, 3)} \\text{ bits per pixel}`,
        rationale: 'Measure of richness and unpredictability of image information.',
        value: stats.entropy,
      },
    ];
  },
};

// ==========================================
// TOPIC 8: Probability Distribution of Intensities
// ==========================================
export const intensityProbabilityLab: LabModule = {
  slug: 'intensity-probability',
  params: [
    { id: 'samples', kind: 'slider', label: 'Monte Carlo Sample Count', min: 100, max: 10000, step: 200, default: 1000, unit: 'pts' },
    { id: 'showTrue', kind: 'toggle', label: 'Overlay True Distribution', default: true },
  ],
  presets: [
    { label: 'Few Samples (N = 200)', params: { samples: 200, showTrue: true } },
    { label: 'Medium Samples (N = 2,000)', params: { samples: 2000, showTrue: true } },
    { label: 'High Fidelity (N = 10,000)', params: { samples: 10000, showTrue: true } },
  ],
  Stage: ({ params, image }) => {
    const numSamples = params.samples ?? 1000;
    const showTrue = params.showTrue ?? true;

    const total = image.w * image.h;
    const trueHist = useMemo(() => computeHistogram(image, 64), [image]);
    const truePdf = useMemo(() => normalizeHistogram(trueHist, total), [trueHist, total]);

    // Monte Carlo empirical sample
    const sampleHist = useMemo(() => {
      const h = new Float64Array(64);
      const data = image.data;
      const len = data.length;
      for (let i = 0; i < numSamples; i++) {
        const randIdx = Math.floor(Math.random() * len);
        const val = data[randIdx];
        const bin = Math.min(63, Math.floor((val / 256) * 64));
        h[bin]++;
      }
      for (let b = 0; b < 64; b++) {
        h[b] /= numSamples;
      }
      return h;
    }, [image, numSamples]);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <CanvasImage image={image} title="Source Image Scene" />
        <div className="w-full sm:w-[340px]">
          <BarPlot
            data={sampleHist}
            secondaryData={showTrue ? truePdf : undefined}
            xLabel="Intensity (r_k)"
            yLabel="Empirical Probability p(r_k)"
          />
        </div>
      </div>
    );
  },
  Explain: ({ mode, params }) => {
    const N = params.samples ?? 1000;
    if (mode === 'advanced') {
      return (
        <>
          <p>
            By treating intensity <span className="font-mono text-accent">r</span> as a discrete random variable, the normalized histogram represents the true probability mass function:
          </p>
          <div className="py-1">
            <KatexView math="p_r(r_k) = \frac{n_k}{M \cdot N}, \quad \sum p_r(r_k) = 1" displayMode />
          </div>
          <p className="text-xs text-text-muted">
            By the Law of Large Numbers, empirical sampling frequencies converge uniformly to true p_r(r_k) as sample size N → ∞.
          </p>
        </>
      );
    }
    return (
      <>
        <p>
          Imagine picking random pixels out of the image blindly like lottery balls.
        </p>
        <p>
          With only 100 samples, the bars look jagged and noisy. As you drag the slider to 5,000 or 10,000 samples, watch the blue bars settle down into the true orange curve!
        </p>
      </>
    );
  },
  buildSteps: (params, image) => {
    const total = image.w * image.h;
    const trueHist = computeHistogram(image, 256);
    const pdf = normalizeHistogram(trueHist, total);
    let sumP = 0;
    for (let i = 0; i < pdf.length; i++) sumP += pdf[i];

    return [
      {
        id: 'pmf-normalization',
        title: 'Probability Mass Axiom: Unit Sum',
        latex: `\\sum_{k=0}^{L-1} p_r(r_k) = \\sum_{k=0}^{L-1} \\frac{n_k}{MN} = 1.0`,
        substituted: `\\sum_{k=0}^{255} p_r(r_k) = ${formatNum(sumP, 4)}`,
        rationale: 'Total probability across the sample space equals 1.',
        value: sumP,
      },
      {
        id: 'law-of-large-numbers',
        title: 'Convergence Rate (Law of Large Numbers)',
        latex: `\\lim_{N \\to \\infty} \\hat{p}_N(r_k) = p_r(r_k)`,
        substituted: `N = ${params.samples ?? 1000} \\text{ samples drawn}`,
        rationale: 'Statistical error bounds shrink proportional to 1/√N.',
      },
    ];
  },
};

// ==========================================
// TOPIC 9: Probability Density Function (PDF)
// ==========================================
export const pdfLab: LabModule = {
  slug: 'pdf',
  params: [
    { id: 'boundA', kind: 'slider', label: 'Lower Bound (a)', min: 0, max: 255, step: 5, default: 60 },
    { id: 'boundB', kind: 'slider', label: 'Upper Bound (b)', min: 0, max: 255, step: 5, default: 190 },
    { id: 'smoothing', kind: 'slider', label: 'KDE Smoothing Bandwidth (σ)', min: 1, max: 15, step: 1, default: 5, advancedOnly: true },
  ],
  presets: [
    { label: 'Mid-Tones [60, 190]', params: { boundA: 60, boundB: 190, smoothing: 5 } },
    { label: 'Dark Shadows [0, 80]', params: { boundA: 0, boundB: 80, smoothing: 5 } },
    { label: 'Bright Highlights [180, 255]', params: { boundA: 180, boundB: 255, smoothing: 5 } },
  ],
  Stage: ({ params, image }) => {
    const a = Math.min(params.boundA ?? 60, params.boundB ?? 190);
    const b = Math.max(params.boundA ?? 60, params.boundB ?? 190);
    const sigma = params.smoothing ?? 5;

    const pdf = useMemo(() => {
      const hist = computeHistogram(image, 256);
      const rawPdf = normalizeHistogram(hist, image.w * image.h);
      // Gaussian kernel smoothing for continuous PDF
      const smoothed = new Float64Array(256);
      const radius = sigma * 3;
      for (let i = 0; i < 256; i++) {
        let weightSum = 0;
        let valSum = 0;
        for (let j = Math.max(0, i - radius); j <= Math.min(255, i + radius); j++) {
          const dist = i - j;
          const w = Math.exp(-(dist * dist) / (2 * sigma * sigma));
          weightSum += w;
          valSum += rawPdf[j] * w;
        }
        smoothed[i] = valSum / (weightSum || 1);
      }
      return smoothed;
    }, [image, sigma]);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <CanvasImage
          image={image}
          title="Scene Image"
          brushedRange={[a, b]}
        />
        <div className="w-full sm:w-[340px]">
          <AreaPlot
            data={pdf}
            range={[a, b]}
            xLabel="Intensity (r)"
            yLabel="Continuous Density p_r(r)"
          />
        </div>
      </div>
    );
  },
  Explain: ({ mode, params }) => {
    const a = params.boundA ?? 60;
    const b = params.boundB ?? 190;
    return (
      <>
        <p>
          In continuous image theory, the histogram smooths out into a <strong>Probability Density Function (PDF)</strong> <span className="font-mono text-accent">p_r(r)</span>.
        </p>
        <p>
          The probability that a pixel falls between intensities <strong>{a}</strong> and <strong>{b}</strong> is exactly the <strong>shaded area</strong> under the curve!
        </p>
      </>
    );
  },
  buildSteps: (params, image) => {
    const a = Math.min(params.boundA ?? 60, params.boundB ?? 190);
    const b = Math.max(params.boundA ?? 60, params.boundB ?? 190);
    const hist = computeHistogram(image, 256);
    const pdf = normalizeHistogram(hist, image.w * image.h);

    let area = 0;
    for (let r = a; r <= b; r++) {
      area += pdf[r];
    }

    return [
      {
        id: 'pdf-integral-def',
        title: 'Integral Definition of Probability',
        latex: `P(a \\le r \\le b) = \\int_a^b p_r(w) \\, dw`,
        substituted: `P(${a} \\le r \\le ${b}) = \\sum_{r=${a}}^{${b}} p_r(r) = ${formatNum(area, 4)} \\implies ${(area * 100).toFixed(2)}\\%`,
        rationale: 'The shaded area between bounds represents the exact portion of image pixels.',
        value: area,
        highlight: { plot: 'pdf', kind: 'range', at: [a, b] },
      },
      {
        id: 'total-area-unity',
        title: 'Total Integral Normalization',
        latex: `\\int_0^{L-1} p_r(w) \\, dw = 1.0`,
        substituted: `\\int_0^{255} p_r(w) \\, dw = 1.000`,
        rationale: 'Total area beneath the complete PDF curve is strictly 1.0.',
        value: 1.0,
      },
    ];
  },
};

// ==========================================
// TOPIC 10: Cumulative Distribution Function (CDF)
// ==========================================
export const cdfLab: LabModule = {
  slug: 'cdf',
  params: [
    { id: 'probeR', kind: 'slider', label: 'Threshold Intensity (r)', min: 0, max: 255, step: 1, default: 120 },
  ],
  presets: [
    { label: 'Lower Quartile (r = 64)', params: { probeR: 64 } },
    { label: 'Median Threshold (r = 128)', params: { probeR: 128 } },
    { label: 'Upper Quartile (r = 192)', params: { probeR: 192 } },
  ],
  Stage: ({ params, image }) => {
    const probe = params.probeR ?? 120;

    const hist = useMemo(() => computeHistogram(image, 256), [image]);
    const pdf = useMemo(() => normalizeHistogram(hist, image.w * image.h), [hist, image]);
    const cdf = useMemo(() => computeCDF(pdf), [pdf]);

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <CanvasImage
            image={image}
            title="Image (Pixels ≤ r highlighted)"
            brushedRange={[0, probe]}
          />
          <div className="w-full sm:w-[340px] space-y-4">
            <BarPlot
              data={pdf}
              xLabel="Intensity (r)"
              yLabel="PDF p_r(r)"
              probedBin={probe}
            />
            <LinePlot
              data={Array.from(cdf).map((c) => c * 255)}
              xLabel="Intensity (r)"
              yLabel="CDF c_r(r) × 255"
              probedX={probe}
              showIdentity={false}
            />
          </div>
        </div>
      </div>
    );
  },
  Explain: ({ mode, params }) => {
    const r = params.probeR ?? 120;
    return (
      <>
        <p>
          The <strong>CDF</strong> <span className="font-mono text-accent">c(r) = P(R ≤ r)</span> is the cumulative running sum of the PDF from 0 up to threshold r.
        </p>
        <p>
          Because probabilities are always non-negative, the CDF is <strong>strictly monotonically increasing</strong> from 0 up to 1.0!
        </p>
        <p className="text-xs text-text-muted">
          Notice how the slope of the CDF is steepest where the PDF is tallest: <span className="font-mono">dc/dr = p(r)</span>.
        </p>
      </>
    );
  },
  buildSteps: (params, image) => {
    const r = params.probeR ?? 120;
    const hist = computeHistogram(image, 256);
    const total = image.w * image.h;
    const pdf = normalizeHistogram(hist, total);
    const cdf = computeCDF(pdf);

    let cumCount = 0;
    for (let j = 0; j <= r; j++) {
      cumCount += hist[j];
    }

    return buildDiscreteCDFSteps(r, hist[r], total, cumCount, 256);
  },
};
