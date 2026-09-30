import { DualViewExplain } from '../components/shell/DualViewExplain';
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
    { id: 'px', kind: 'slider', label: 'Probe x', min: 0, max: 127, step: 1, default: 64, unit: 'px' },
    { id: 'py', kind: 'slider', label: 'Probe y', min: 0, max: 127, step: 1, default: 64, unit: 'px' },
    { id: 'showMagnifier', kind: 'toggle', label: 'Pixel Magnifier Lens', default: false, advancedOnly: true },
  ],
  presets: [
    { label: 'High Fidelity', params: { resolution: 128, bits: 8, px: 64, py: 64 } },
    { label: 'Severe Pixelation', params: { resolution: 16, bits: 8, px: 40, py: 40 } },
    { label: 'Extreme 1-Bit', params: { resolution: 64, bits: 1, px: 64, py: 64 } },
  ],
  Stage: ({ params, image, onParamChange }) => {
    const res = params.resolution ?? 64;
    const bits = params.bits ?? 8;
    const showMag = params.showMagnifier ?? false;
    const x = Math.min(image.w - 1, Math.max(0, params.px ?? 64));
    const y = Math.min(image.h - 1, Math.max(0, params.py ?? 64));

    const processed = useMemo(() => {
      const down = resampleImage(image, res, res);
      const quant = quantizeImage(down, bits);
      return resampleImage(quant, 128, 128); // upscale for visual comparison
    }, [image, res, bits]);

    const handleProbeChange = (pt: { x: number; y: number }) => {
      onParamChange?.('px', pt.x);
      onParamChange?.('py', pt.y);
    };

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <CanvasImage
          image={image}
          title="Continuous Analog Scene (High Res)"
          probePoint={{ x, y }}
          onProbePointChange={handleProbeChange}
        />
        <div className="flex flex-col items-center">
          <CanvasImage
            image={processed}
            title={`Sampled (${res}×${res}) & Quantized (${bits}-bit)`}
            showMagnifier={showMag}
            probePoint={{ x, y }}
            onProbePointChange={handleProbeChange}
          />
        </div>
      </div>
    );
  },
  Explain: ({ mode }) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <p>
            Think of a digital image like a massive mosaic made of tiny square tiles. From far away, it looks like a smooth photograph, but if you get really close, you can see the individual colored blocks!
          </p>
        ),
        controls: (
          <p>
            The controls on the right let you explore the image. When you hover over the image, you'll see exactly which 'tile' (pixel) you are pointing at and its specific position (X and Y coordinates).
          </p>
        ),
        whatToLookFor: (
          <p>
            Try moving your mouse across the image. Watch how the <strong>X coordinate</strong> changes as you move left-to-right, and the <strong>Y coordinate</strong> changes as you move up-and-down. Notice that Y=0 is at the very top!
          </p>
        ),
        whyItMatters: (
          <p>
            This grid system is how computers understand everything you see on a screen. Every photo you take with your phone is just millions of these little tiles packed tightly together.
          </p>
        ),
      }}
      advanced={{
        math: (
          <p>
            Formally, a digital image is defined as a 2D discrete function <span className="font-mono text-accent">f(x, y)</span>, where <span className="font-mono text-accent">x</span> and <span className="font-mono text-accent">y</span> are spatial coordinates, and the amplitude of <span className="font-mono text-accent">f</span> at any pair of coordinates is called the intensity or gray level.
          </p>
        ),
        algorithm: (
          <p>
            When an image is acquired, it undergoes <em>sampling</em> (digitizing spatial coordinates) and <em>quantization</em> (digitizing amplitude). The resulting array is an <span className="font-mono text-accent">M x N</span> matrix. Time complexity to traverse it is <span className="font-mono text-accent">O(M x N)</span>.
          </p>
        ),
        parameterImpact: (
          <p>
            Coordinate systems in image processing typically place the origin <span className="font-mono text-accent">(0,0)</span> at the top-left corner. Spatial resolution dictates how fine the details can be resolved.
          </p>
        ),
        applications: (
          <p>
            Digital matrices are the core of all machine vision algorithms. Whether it's satellite imagery (remote sensing) or analyzing CT scans in biomedical engineering, algorithms operate on these matrix structures.
          </p>
        ),
      }}
    />
  ),
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
        substituted: `b = ${N} \\times ${N} \\times ${k} = ${rawBits.toLocaleString().replace(/,/g, '{,}')} \\text{ bits} = ${rawBytes.toLocaleString().replace(/,/g, '{,}')} \\text{ bytes}`,
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
  Explain: ({ mode, params }) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <p>
            Imagine you have a single bucket of black paint and a bucket of white paint. A grayscale image is made by mixing these two paints in different amounts for each pixel tile to get different shades of gray.
          </p>
        ),
        controls: (
          <p>
            You can use the <strong>Threshold</strong> slider to split the image into just black and white. Anything darker than your threshold becomes pure black, and anything brighter becomes pure white.
          </p>
        ),
        whatToLookFor: (
          <p>
            Slowly drag the slider from left to right. Notice how more and more of the image turns black! It's like turning down the lights on the whole picture until everything is swallowed by darkness.
          </p>
        ),
        whyItMatters: (
          <p>
            This simple black-and-white trick is incredibly useful. It's how scanners grab text from a printed page without picking up background smudges, and it's a basic step in building Instagram filters!
          </p>
        ),
      }}
      advanced={{
        math: (
          <p>
            A continuous image function <span className="font-mono text-accent">f(x,y)</span> is converted to a discrete matrix. Grayscale intensity represents the scalar amplitude at each pixel, bounded typically between <span className="font-mono text-accent">[0, L-1]</span> where <span className="font-mono text-accent">L = 2^k</span>.
          </p>
        ),
        algorithm: (
          <p>
            Thresholding operation: <span className="font-mono text-accent">g(x,y) = 255</span> if <span className="font-mono text-accent">f(x,y) &gt; T</span> else <span className="font-mono text-accent">0</span>. This involves a simple <span className="font-mono text-accent">O(MN)</span> linear pass over the image matrix.
          </p>
        ),
        parameterImpact: (
          <p>
            The choice of threshold <span className="font-mono text-accent">T</span> dictates the segmentation of the image. Small variations in lighting can severely impact fixed-threshold segmentation, often requiring adaptive or Otsu's thresholding methods.
          </p>
        ),
        applications: (
          <p>
            Binarization (thresholding) is widely used in OCR (Optical Character Recognition) systems to separate text from background, and in medical imaging to isolate anatomical structures like bones in X-rays.
          </p>
        ),
      }}
    />
  ),
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
    { id: 'probeX', kind: 'slider', label: 'Probe Column (X)', min: 0, max: 127, step: 1, default: 64, unit: 'px' },
    { id: 'profileRow', kind: 'slider', label: 'Scanline Row (Y)', min: 0, max: 127, step: 1, default: 64, unit: 'row' },
    { id: 'offset', kind: 'slider', label: 'Brightness Offset', min: -50, max: 50, step: 5, default: 0 },
  ],
  presets: [
    { label: 'Midline Profile', params: { probeX: 64, profileRow: 64, offset: 0 } },
    { label: 'Top Highlights', params: { probeX: 85, profileRow: 20, offset: 20 } },
    { label: 'Dark Floor', params: { probeX: 30, profileRow: 110, offset: -25 } },
  ],
  Stage: ({ params, image, onParamChange }) => {
    const row = Math.min(image.h - 1, Math.max(0, params.profileRow ?? 64));
    const probeX = Math.min(image.w - 1, Math.max(0, params.probeX ?? 64));
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

    const handleProbeChange = (pt: { x: number; y: number }) => {
      onParamChange?.('probeX', pt.x);
      onParamChange?.('profileRow', pt.y);
    };

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <CanvasImage
            image={modifiedImg}
            title="Image with Active Scanline & Probe"
            lineProfileY={row}
            probePoint={{ x: probeX, y: row }}
            onProbePointChange={handleProbeChange}
          />
          <div className="w-full sm:w-[320px]">
            <LinePlot
              data={rowData}
              xLabel="Horizontal Pixel Position (X)"
              yLabel="Pixel Intensity f(x)"
              probedX={probeX}
              showIdentity={false}
            />
          </div>
        </div>
      </div>
    );
  },
  Explain: ({ mode, params }) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <p>
            Think of pixel intensity like a volume dial, but instead of sound, it controls brightness. A volume of 0 is pitch black (silence), and max volume is pure blinding white!
          </p>
        ),
        controls: (
          <p>
            The <strong>Intensity Offset</strong> slider lets you turn the brightness up or down for the entire image at once. It's like adding or taking away a little bit of light everywhere.
          </p>
        ),
        whatToLookFor: (
          <p>
            Move the slider up and down. See how adding a positive number washes out the dark areas and makes the bright areas pure white (clipping)? Notice what happens when you subtract!
          </p>
        ),
        whyItMatters: (
          <p>
            If you've ever taken a photo on your phone that turned out too dark, tweaking the exposure uses this exact idea—shifting all the intensity values up so you can actually see your friends' faces!
          </p>
        ),
      }}
      advanced={{
        math: (
          <p>
            Let <span className="font-mono text-accent">r</span> be the original intensity and <span className="font-mono text-accent">s</span> be the transformed intensity. A linear shift is defined as <span className="font-mono text-accent">s = r + C</span>. Due to hardware limits, we apply clamping: <span className="font-mono text-accent">s = max(0, min(255, r + C))</span>.
          </p>
        ),
        algorithm: (
          <p>
            The algorithm maps each input pixel to an output pixel. Due to clamping, the operation is irreversible if values exceed the <span className="font-mono text-accent">[0, 255]</span> boundary (loss of information).
          </p>
        ),
        parameterImpact: (
          <p>
            A high positive offset saturates pixels to 255 (clipping), destroying high-frequency detail in bright regions. A negative offset clips dark regions to 0, causing crushed shadows.
          </p>
        ),
        applications: (
          <p>
            Offset adjustments are primitive forms of exposure compensation in computational photography, often handled in the RAW domain before non-linear gamma compression to preserve dynamic range.
          </p>
        ),
      }}
    />
  ),
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
  Explain: ({ mode, params }) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <p>
            Imagine a staircase. A normal image has 256 tiny steps from black to white. But what if we replace those steps with just 4 giant leaps? That's what reducing intensity levels does!
          </p>
        ),
        controls: (
          <p>
            The <strong>Bit Depth</strong> slider controls how many shades of gray the image is allowed to use. 8 bits means 256 shades, while 2 bits means only 4 shades.
          </p>
        ),
        whatToLookFor: (
          <p>
            Lower the slider to 2 or 3 bits. See those weird blocky bands of color instead of smooth shading? That's called 'posterization' or 'false contouring' because we don't have enough gray shades to blend smoothly.
          </p>
        ),
        whyItMatters: (
          <p>
            This is super important for saving internet data! GIF images and old retro video games (like the GameBoy) used very few colors to keep the file size tiny.
          </p>
        ),
      }}
      advanced={{
        math: (
          <p>
            Quantization assigns a continuous or high-resolution intensity value to one of <span className="font-mono text-accent">L</span> discrete levels, where <span className="font-mono text-accent">L = 2^k</span> and <span className="font-mono text-accent">k</span> is the bit depth. 
          </p>
        ),
        algorithm: (
          <p>
            The uniform quantization mapping function divides the dynamic range <span className="font-mono text-accent">[0, 255]</span> into <span className="font-mono text-accent">L</span> uniform intervals. Complexity is <span className="font-mono text-accent">O(1)</span> per pixel.
          </p>
        ),
        parameterImpact: (
          <p>
            As <span className="font-mono text-accent">k</span> drops below 5 or 6, visual artifacts known as false contouring appear in smooth gradient regions because the intensity jump between levels exceeds the human visual system's Just Noticeable Difference (JND).
          </p>
        ),
        applications: (
          <p>
            Image compression algorithms (like JPEG) heavily rely on quantizing frequency coefficients. Understanding quantization noise is critical in digital communication and sensor hardware design.
          </p>
        ),
      }}
    />
  ),
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
  Explain: ({ mode, params }) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <p>
            Imagine looking through a magnifying glass at a newspaper photo. Instead of a smooth picture, you see a giant grid of tiny dots with numbers on them. That's exactly how the computer 'sees' the image!
          </p>
        ),
        controls: (
          <p>
            Hover your mouse over the big image to move the 'magnifying glass'. The <strong>Zoom Box</strong> shows you the actual grid of numbers hiding inside the image at that spot.
          </p>
        ),
        whatToLookFor: (
          <p>
            Find a spot in the image where there's a sharp edge between dark and light. Look at the numbers in the grid—you'll see them jump suddenly from low numbers (dark) to high numbers (bright).
          </p>
        ),
        whyItMatters: (
          <p>
            Because an image is just a giant math table (a matrix), programmers can use math to do amazing things, like blurring out license plates or using AI to detect faces!
          </p>
        ),
      }}
      advanced={{
        math: (
          <p>
            An image is formally a discrete matrix <span className="font-mono text-accent">F in R^(MxN)</span>. Each element <span className="font-mono text-accent">f(x, y)</span> represents the quantized irradiance captured by a sensor photodiode.
          </p>
        ),
        algorithm: (
          <p>
            Accessing a neighborhood (like a <span className="font-mono text-accent">3x3</span> region) involves matrix indexing operations <span className="font-mono text-accent">f(x+i, y+j)</span>. Boundary conditions must be handled (padding or mirroring) to prevent out-of-bounds errors.
          </p>
        ),
        parameterImpact: (
          <p>
            High frequency spatial transitions (edges) appear as large numerical gradients between adjacent matrix elements. Smooth areas have near-zero local variance.
          </p>
        ),
        applications: (
          <p>
            Matrix representations are the foundation of spatial filtering (convolution). Modern convolutional neural networks (CNNs) perform thousands of matrix multiplications per second to extract features from these numerical grids.
          </p>
        ),
      }}
    />
  ),
  buildSteps: (params, image) => {
    const size = params.regionSize ?? 6;
    const shift = params.brightnessShift ?? 0;
    const totalBytes = image.w * image.h;

    return [
      {
        id: 'matrix-dimension',
        title: 'Matrix Order and Storage',
        latex: `F \\in \\mathbb{R}^{M \\times N} \\quad M = ${image.h}, \\, N = ${image.w}`,
        substituted: `${image.h} \\times ${image.w} = ${totalBytes.toLocaleString().replace(/,/g, '{,}')} \\text{ matrix elements (bytes)}`,
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
  Explain: ({ mode, params }) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <p>
            Think of this like a magic translator. For every shade of gray going in (input), it spits out a different shade going out (output). If the translator curve goes up, things get brighter!
          </p>
        ),
        controls: (
          <p>
            The <strong>Gamma</strong> slider bends the translator line into a curve. The <strong>Contrast (a)</strong> slider makes the line steeper, stretching the difference between dark and light.
          </p>
        ),
        whatToLookFor: (
          <p>
            Make the Gamma curve bow upwards (gamma &lt; 1). See how the dark shadows suddenly light up? The math is taking low input numbers and boosting them up high!
          </p>
        ),
        whyItMatters: (
          <p>
            This is exactly how the 'Brightness' and 'Contrast' sliders work on your TV. Gamma correction is also used to fix images so they look correct on different types of screens (like phones vs. monitors).
          </p>
        ),
      }}
      advanced={{
        math: (
          <p>
            Intensity transformations operate strictly on single pixels: <span className="font-mono text-accent">s = T(r)</span>, where <span className="font-mono text-accent">r</span> is input and <span className="font-mono text-accent">s</span> is output. A power-law (Gamma) transform is <span className="font-mono text-accent">s = c * r^gamma</span>.
          </p>
        ),
        algorithm: (
          <p>
            Because <span className="font-mono text-accent">T(r)</span> only depends on the pixel value and not spatial coordinates, it can be optimized using a Look-Up Table (LUT) of size 256. This reduces an <span className="font-mono text-accent">O(MN)</span> floating-point operation to an <span className="font-mono text-accent">O(MN)</span> integer array lookup!
          </p>
        ),
        parameterImpact: (
          <p>
            When <span className="font-mono text-accent">gamma &lt; 1</span>, the mapping is compressive at higher intensities and expansive at lower intensities. A steep linear slope increases dynamic contrast but causes saturation (clipping) at the boundaries.
          </p>
        ),
        applications: (
          <p>
            Gamma correction compensates for the non-linear luminance response of display hardware (CRTs and LCDs). It's a fundamental part of the sRGB color space pipeline in modern digital imaging.
          </p>
        ),
      }}
    />
  ),
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
  Explain: ({ mode, params }) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <p>
            Imagine sorting a giant bucket of mixed change. You make a tall stack of pennies, a medium stack of nickels, and a short stack of quarters. A histogram does exactly this, but with pixel colors!
          </p>
        ),
        controls: (
          <p>
            The <strong>Brightness Shift</strong> and <strong>Contrast Mult</strong> sliders let you change the image. Watch how the histogram bars shift and stretch in response.
          </p>
        ),
        whatToLookFor: (
          <p>
            Push the brightness up. Notice how the entire 'mountain' of bars moves to the right (towards white)? If an image is too dark, all the bars will be huddled together on the left side!
          </p>
        ),
        whyItMatters: (
          <p>
            Professional photographers look at histograms on the back of their cameras all the time! It tells them instantly if a photo is too dark (underexposed) or too bright (overexposed) without needing to guess.
          </p>
        ),
      }}
      advanced={{
        math: (
          <p>
            A discrete histogram is defined as <span className="font-mono text-accent">h(r_k) = n_k</span>, where <span className="font-mono text-accent">r_k</span> is the <span className="font-mono text-accent">k</span>-th intensity level and <span className="font-mono text-accent">n_k</span> is the number of pixels with that intensity.
          </p>
        ),
        algorithm: (
          <p>
            Computing a histogram is a single pass over the image: initialize an array of size <span className="font-mono text-accent">L</span> to zero, and increment the bin for each pixel's intensity. Time complexity is <span className="font-mono text-accent">O(MN)</span>, space is <span className="font-mono text-accent">O(L)</span>.
          </p>
        ),
        parameterImpact: (
          <p>
            A brightness shift translates the histogram (convolution with a shifted impulse), while a contrast multiplier dilates or compresses the histogram. Multiplication creates 'gaps' (missing bins) due to discrete quantization.
          </p>
        ),
        applications: (
          <p>
            Histograms form the basis of global image enhancement techniques (like Histogram Equalization) and are used as feature descriptors in computer vision (e.g., HOG - Histogram of Oriented Gradients).
          </p>
        ),
      }}
    />
  ),
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
        substituted: `\\sum n_k = ${total.toLocaleString().replace(/,/g, '{,}')} \\text{ pixels}`,
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
  Explain: ({ mode, params }) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <p>
            Imagine drawing pixels out of a hat blindly, like lottery balls. If most of the balls in the hat are dark gray, you're most likely to draw a dark gray ball!
          </p>
        ),
        controls: (
          <p>
            The <strong>Sample Count</strong> slider controls how many lottery balls we pull from the hat to guess the image's true makeup.
          </p>
        ),
        whatToLookFor: (
          <p>
            With only 100 samples, the blue bars (our guess) look very jagged and don't match the smooth orange curve (the truth). As you drag the slider to 10,000, watch the blue bars magically settle down perfectly!
          </p>
        ),
        whyItMatters: (
          <p>
            This explains why political polls with only 10 people are terribly inaccurate, but polls with 10,000 people are usually spot on! More data means less random noise.
          </p>
        ),
      }}
      advanced={{
        math: (
          <p>
            Normalizing the histogram yields a Probability Mass Function (PMF): <span className="font-mono text-accent">p(r_k) = n_k / (MN)</span>. The sum of all probabilities must strictly equal <span className="font-mono text-accent">1.0</span> (Probability Axiom).
          </p>
        ),
        algorithm: (
          <p>
            Sampling pixels follows a uniform random distribution over spatial coordinates. The empirical distribution <span className="font-mono text-accent">p_hat</span> approaches the true PMF <span className="font-mono text-accent">p</span> as <span className="font-mono text-accent">N approaches infinity</span>.
          </p>
        ),
        parameterImpact: (
          <p>
            According to the Law of Large Numbers, the variance of our sample estimate decreases proportional to <span className="font-mono text-accent">1/N</span>. Low sample counts suffer from high variance (noise).
          </p>
        ),
        applications: (
          <p>
            Probabilistic image models are critical in Monte Carlo rendering, stochastic noise modeling in sensors, and Bayesian inference techniques for image restoration.
          </p>
        ),
      }}
    />
  ),
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
      <DualViewExplain
        mode={mode}
        beginner={{
          concept: (
            <p>
              Imagine melting down the chunky histogram bars into a smooth, continuous hill. This smooth hill is called a Probability Density Function (PDF).
            </p>
          ),
          controls: (
            <p>
              The <strong>Lower Bound</strong> and <strong>Upper Bound</strong> sliders let you slice a piece out of the hill, shading the area underneath it.
            </p>
          ),
          whatToLookFor: (
            <p>
              Watch the shaded area! If you want to know "What percentage of my image is between shade {a} and {b}?", you just measure the size of that shaded patch under the hill!
            </p>
          ),
          whyItMatters: (
            <p>
              This is how Photoshop's 'Select Color Range' tool works. By setting a range, you select a specific 'area under the curve' to grab all the skin tones or sky colors at once.
            </p>
          ),
        }}
        advanced={{
          math: (
            <p>
              In continuous theory, the histogram becomes a Probability Density Function (PDF) <span className="font-mono text-accent">p_r(r)</span>. The probability of an intensity falling in <span className="font-mono text-accent">[a, b]</span> is the integral: <span className="font-mono text-accent">Integral from a to b of p_r(w) dw</span>.
            </p>
          ),
          algorithm: (
            <p>
              To approximate a continuous PDF from discrete data, we apply Kernel Density Estimation (KDE), typically convoluting the histogram with a Gaussian kernel.
            </p>
          ),
          parameterImpact: (
            <p>
              The bandwidth parameter <span className="font-mono text-accent">sigma</span> controls the smoothing. A high <span className="font-mono text-accent">sigma</span> over-smooths, losing structural peaks (modes), while a low <span className="font-mono text-accent">sigma</span> leaves the PDF jagged and overfit to the discrete bins.
            </p>
          ),
          applications: (
            <p>
              Continuous PDFs are vital in information theory (calculating image entropy) and defining formal transfer functions for histogram specification algorithms.
            </p>
          ),
        }}
      />
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
      <DualViewExplain
        mode={mode}
        beginner={{
          concept: (
            <p>
              Imagine walking from left to right, scooping up all the pixels into a bag as you go. The CDF tells you exactly how full your bag is at any given point!
            </p>
          ),
          controls: (
            <p>
              The <strong>Threshold Intensity</strong> slider controls how far to the right you walk before checking your bag. The red line shows how the bag gets fuller and fuller.
            </p>
          ),
          whatToLookFor: (
            <p>
              Notice that the red line NEVER goes down! Because you're always adding pixels to the bag, the line only climbs up until it hits 100% (or 1.0) on the far right.
            </p>
          ),
          whyItMatters: (
            <p>
              This "running total" curve is the secret weapon behind Histogram Equalization, a magic algorithm that automatically fixes low-contrast images (like foggy photos or dark X-rays)!
            </p>
          ),
        }}
        advanced={{
          math: (
            <p>
              The Cumulative Distribution Function (CDF) <span className="font-mono text-accent">c(r) = P(R &lt;= r)</span> is defined as the definite integral of the PDF from 0 to <span className="font-mono text-accent">r</span>: <span className="font-mono text-accent">c(r) = Integral from 0 to r of p_r(w) dw</span>.
            </p>
          ),
          algorithm: (
            <p>
              For discrete images, the CDF is computed using a running prefix sum of the PMF array: <span className="font-mono text-accent">c_k = Sum from j=0 to k of p_r(r_j)</span>. This takes <span className="font-mono text-accent">O(L)</span> time where <span className="font-mono text-accent">L</span> is the number of bins.
            </p>
          ),
          parameterImpact: (
            <p>
              Because probabilities are non-negative, the CDF is strictly monotonically non-decreasing. The derivative (slope) of the CDF <span className="font-mono text-accent">dc/dr</span> is exactly the PDF <span className="font-mono text-accent">p(r)</span>.
            </p>
          ),
          applications: (
            <p>
              The CDF serves as the optimal transformation function <span className="font-mono text-accent">T(r) = c(r)</span> for Histogram Equalization, which maps the input distribution to an approximately uniform output distribution, maximizing image entropy.
            </p>
          ),
        }}
      />
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
