import React, { useState, useMemo } from 'react';
import { LabModule } from './types';
import { CanvasImage } from '../components/plots/CanvasImage';
import { LinePlot } from '../components/plots/LinePlot';
import { BarPlot } from '../components/plots/BarPlot';
import {
  computeHistogram,
  normalizeHistogram,
  computeCDF,
  computeStats,
} from '../engine/image/histogram';
import {
  applyLUT,
  equalizeLUT,
  matchLUT,
  invertMonotoneLUT,
  lutFromFn,
} from '../engine/image/lut';
import {
  localEqualize,
  resampleImage,
} from '../engine/image/transforms';
import {
  buildEqualizationMathSteps,
  formatNum,
} from '../engine/math/stepEngine';
import { Step } from '../engine/math/types';
import { KatexView } from '../components/math/KatexView';

// ==========================================
// TOPIC 11: Histogram Equalization
// ==========================================
export const histogramEqualizationLab: LabModule = {
  slug: 'histogram-equalization',
  params: [
    { id: 'blend', kind: 'slider', label: 'Equalization Blend (α)', min: 0, max: 1, step: 0.05, default: 1.0 },
    { id: 'showCDF', kind: 'toggle', label: 'Show CDF Overlay', default: true },
    { id: 'probeR', kind: 'slider', label: 'Probe Intensity r', min: 0, max: 255, step: 1, default: 120, advancedOnly: true },
  ],
  presets: [
    { label: 'Full Equalization (100%)', params: { blend: 1.0, showCDF: true } },
    { label: 'Moderate Contrast (50%)', params: { blend: 0.5, showCDF: true } },
    { label: 'Original (0%)', params: { blend: 0.0, showCDF: false } },
  ],
  Stage: ({ params, image }) => {
    const alpha = params.blend ?? 1.0;
    const showC = params.showCDF ?? true;
    const probe = params.probeR ?? 120;

    const total = image.w * image.h;
    const origHist = useMemo(() => computeHistogram(image, 256), [image]);
    const origPdf = useMemo(() => normalizeHistogram(origHist, total), [origHist, total]);
    const cdf = useMemo(() => computeCDF(origPdf), [origPdf]);

    const lut = useMemo(() => {
      const eqLut = equalizeLUT(cdf, 256);
      if (alpha >= 0.99) return eqLut;
      // Linear blend with identity
      const blended = new Uint8ClampedArray(256);
      for (let r = 0; r < 256; r++) {
        blended[r] = Math.round((1 - alpha) * r + alpha * eqLut[r]);
      }
      return blended;
    }, [cdf, alpha]);

    const equalizedImg = useMemo(() => applyLUT(image, lut), [image, lut]);
    const eqHist = useMemo(() => computeHistogram(equalizedImg, 256), [equalizedImg]);

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <CanvasImage image={image} title="Original Low Contrast" />
          <CanvasImage image={equalizedImg} title={`Equalized (Blend α = ${Math.round(alpha * 100)}%)`} />
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <div className="w-full sm:w-[320px]">
            <BarPlot
              data={origHist}
              cdfData={showC ? cdf : undefined}
              xLabel="Original Intensity (r)"
              yLabel="Pixel Count"
              probedBin={probe}
            />
          </div>
          <div className="w-full sm:w-[320px]">
            <BarPlot
              data={eqHist}
              xLabel="Equalized Intensity (s)"
              yLabel="Pixel Count"
              probedBin={lut[probe]}
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
          <strong>Histogram Equalization</strong> stretches the intensity levels to span the full dynamic range [0, 255], dramatically boosting contrast in washed-out or dark images.
        </p>
        <p>
          Notice how the mapping allocates more gray levels to populous bins and fewer levels to rare ones. The CDF curve serves directly as the transformation curve!
        </p>
      </>
    );
  },
  buildSteps: (params, image) => {
    const probe = params.probeR ?? 120;
    const total = image.w * image.h;
    const hist = computeHistogram(image, 256);
    const pdf = normalizeHistogram(hist, total);
    const cdf = computeCDF(pdf);

    return buildEqualizationMathSteps(probe, pdf[probe], cdf[probe], 256);
  },
};

// ==========================================
// TOPIC 12: Equalization Mapping Function
// ==========================================
export const equalizationMappingLab: LabModule = {
  slug: 'equalization-mapping',
  params: [
    { id: 'probeR', kind: 'slider', label: 'Probe Intensity r', min: 0, max: 255, step: 1, default: 110 },
  ],
  presets: [
    { label: 'Low Shadow (r = 45)', params: { probeR: 45 } },
    { label: 'Median (r = 128)', params: { probeR: 128 } },
    { label: 'Bright Peak (r = 200)', params: { probeR: 200 } },
  ],
  Stage: ({ params, image }) => {
    const probe = params.probeR ?? 110;
    const total = image.w * image.h;
    const hist = useMemo(() => computeHistogram(image, 256), [image]);
    const pdf = useMemo(() => normalizeHistogram(hist, total), [hist, total]);
    const cdf = useMemo(() => computeCDF(pdf), [pdf]);
    const lut = useMemo(() => equalizeLUT(cdf, 256), [cdf]);

    const tangent = useMemo(() => {
      return 255 * pdf[probe];
    }, [pdf, probe]);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <div className="w-full sm:w-[320px]">
          <BarPlot
            data={pdf}
            xLabel="Input Intensity (r)"
            yLabel="PDF p_r(r)"
            probedBin={probe}
          />
        </div>
        <div className="w-full sm:w-[320px]">
          <LinePlot
            data={Array.from(lut)}
            xLabel="Input Intensity (r)"
            yLabel="Equalization Mapping T(r)"
            probedX={probe}
            tangentSlope={tangent}
            showIdentity={true}
          />
        </div>
      </div>
    );
  },
  Explain: ({ mode, params }) => {
    return (
      <>
        <p>
          The equalization function <span className="font-mono text-accent">T(r) = (L - 1) \int_0^r p_r(w) dw</span> is strictly proportional to the cumulative distribution.
        </p>
        <p>
          By the <strong>Fundamental Theorem of Calculus</strong>, the slope <span className="font-mono">dT/dr = (L - 1) p_r(r)</span>. Wherever the input image has lots of pixels (tall PDF), the curve is steepest, expanding local contrast!
        </p>
      </>
    );
  },
  buildSteps: (params, image) => {
    const probe = params.probeR ?? 110;
    const total = image.w * image.h;
    const hist = computeHistogram(image, 256);
    const pdf = normalizeHistogram(hist, total);
    const cdf = computeCDF(pdf);
    return buildEqualizationMathSteps(probe, pdf[probe], cdf[probe], 256);
  },
};

// ==========================================
// TOPIC 13: Normalized Histogram
// ==========================================
export const normalizedHistogramLab: LabModule = {
  slug: 'normalized-histogram',
  params: [
    { id: 'scale', kind: 'slider', label: 'Resolution Scale', min: 0.25, max: 1.5, step: 0.25, default: 1.0, unit: '×' },
    { id: 'normalize', kind: 'toggle', label: 'Normalize to Probability p(r)', default: true },
  ],
  presets: [
    { label: 'Full Resolution (1.0× Normalized)', params: { scale: 1.0, normalize: true } },
    { label: 'Quarter Resolution (0.25× Normalized)', params: { scale: 0.25, normalize: true } },
    { label: 'Raw Pixel Counts (Scale Comparison)', params: { scale: 0.5, normalize: false } },
  ],
  Stage: ({ params, image }) => {
    const scale = params.scale ?? 1.0;
    const isNorm = params.normalize ?? true;

    const scaledImg = useMemo(() => {
      const newW = Math.max(16, Math.round(image.w * scale));
      const newH = Math.max(16, Math.round(image.h * scale));
      return resampleImage(image, newW, newH);
    }, [image, scale]);

    const total = scaledImg.w * scaledImg.h;
    const hist = useMemo(() => computeHistogram(scaledImg, 64), [scaledImg]);
    const pdf = useMemo(() => normalizeHistogram(hist, total), [hist, total]);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <CanvasImage image={scaledImg} title={`Image Size: ${scaledImg.w}×${scaledImg.h} (${total.toLocaleString()} px)`} />
        <div className="w-full sm:w-[340px]">
          <BarPlot
            data={isNorm ? pdf : hist}
            xLabel="Gray Level (r_k)"
            yLabel={isNorm ? 'Normalized Probability p(r_k)' : 'Raw Pixel Count n_k'}
          />
        </div>
      </div>
    );
  },
  Explain: ({ mode, params }) => {
    return (
      <>
        <p>
          Dividing counts by total pixels <span className="font-mono text-accent">M · N</span> yields the normalized histogram <span className="font-mono">p(r_k) = n_k / (M · N)</span>.
        </p>
        <p>
          Toggle <strong>Normalize</strong> on and change the resolution slider: the shape and values of the normalized histogram remain <strong>completely invariant</strong> to image size!
        </p>
      </>
    );
  },
  buildSteps: (params, image) => {
    const scale = params.scale ?? 1.0;
    const newW = Math.max(16, Math.round(image.w * scale));
    const newH = Math.max(16, Math.round(image.h * scale));
    const total = newW * newH;
    const hist = computeHistogram(image, 256);
    const pdf = normalizeHistogram(hist, total);

    return [
      {
        id: 'norm-equation',
        title: 'Normalization by Image Dimensions',
        latex: `p(r_k) = \\frac{n_k}{M \\cdot N}`,
        substituted: `p(r_k) = \\frac{n_k}{${newW} \\times ${newH}} = \\frac{n_k}{${total.toLocaleString()}}`,
        rationale: 'Scales raw counts into unit-sum probabilities.',
        value: total,
      },
      {
        id: 'resolution-invariance',
        title: 'Resolution Invariance Principle',
        latex: `\\sum_{k=0}^{L-1} p(r_k) = 1.0 \\quad \\forall M, N`,
        substituted: `\\sum p(r_k) = 1.000`,
        rationale: 'Permits fair visual and quantitative comparison across different image resolutions.',
        value: 1.0,
      },
    ];
  },
};

// ==========================================
// TOPIC 14: Histogram Transformation
// ==========================================
export const histogramTransformationLab: LabModule = {
  slug: 'histogram-transformation',
  params: [
    { id: 'gamma', kind: 'slider', label: 'Transformation Exponent (γ)', min: 0.2, max: 3.0, step: 0.1, default: 0.7 },
    { id: 'probeS', kind: 'slider', label: 'Probe Output Level s', min: 0, max: 255, step: 1, default: 128, advancedOnly: true },
  ],
  presets: [
    { label: 'Expand Shadows (γ = 0.5)', params: { gamma: 0.5 } },
    { label: 'Identity Linear (γ = 1.0)', params: { gamma: 1.0 } },
    { label: 'Compress Highlights (γ = 2.0)', params: { gamma: 2.0 } },
  ],
  Stage: ({ params, image }) => {
    const gamma = params.gamma ?? 0.7;
    const probeS = params.probeS ?? 128;

    const lut = useMemo(() => {
      return lutFromFn((r) => 255 * Math.pow(r / 255, gamma));
    }, [gamma]);

    const transformed = useMemo(() => applyLUT(image, lut), [image, lut]);

    const inHist = useMemo(() => computeHistogram(image, 64), [image]);
    const outHist = useMemo(() => computeHistogram(transformed, 64), [transformed]);

    return (
      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div className="w-full">
            <BarPlot data={inHist} xLabel="Input Intensity (r)" yLabel="Input p_r(r)" />
          </div>
          <div className="w-full">
            <LinePlot data={Array.from(lut)} xLabel="Input (r)" yLabel="Output (s)" showIdentity={true} />
          </div>
          <div className="w-full">
            <BarPlot data={outHist} xLabel="Output Intensity (s)" yLabel="Output p_s(s)" />
          </div>
        </div>
      </div>
    );
  },
  Explain: ({ mode, params }) => {
    return (
      <>
        <p>
          Applying an intensity mapping <span className="font-mono text-accent">s = T(r)</span> reshapes the histogram according to the change-of-variables theorem:
        </p>
        <div className="py-1">
          <KatexView math="p_s(s) = p_r(r) \cdot \left| \frac{dr}{ds} \right|" displayMode />
        </div>
        <p className="text-xs text-text-muted">
          Where the curve is steep, probability mass is dispersed over many output bins. Where the curve is flat, bins merge together and pile up!
        </p>
      </>
    );
  },
  buildSteps: (params, image) => {
    const gamma = params.gamma ?? 0.7;
    const probeS = params.probeS ?? 128;
    const rVal = Math.round(255 * Math.pow(probeS / 255, 1 / gamma));
    const dr_ds = (1 / gamma) * Math.pow(probeS / 255, 1 / gamma - 1);

    return [
      {
        id: 'change-of-variables',
        title: 'Fundamental Law of Probability Transformation',
        latex: `p_s(s) = p_r(r) \\cdot \\left| \\frac{dr}{ds} \\right| = p_r(T^{-1}(s)) \\cdot \\left| \\frac{1}{T'(r)} \\right|`,
        substituted: `p_s(${probeS}) = p_r(${rVal}) \\cdot |${formatNum(dr_ds, 3)}|`,
        rationale: 'Conservation of probability mass across differential intervals.',
        value: dr_ds,
      },
    ];
  },
};

// ==========================================
// TOPIC 15: Inverse Histogram Transformation
// ==========================================
export const inverseHistogramTransformationLab: LabModule = {
  slug: 'inverse-histogram-transformation',
  params: [
    { id: 'gamma', kind: 'slider', label: 'Forward Exponent (γ)', min: 0.3, max: 3.0, step: 0.1, default: 0.6 },
    { id: 'probeS', kind: 'slider', label: 'Probe Intensity s', min: 0, max: 255, step: 1, default: 140 },
  ],
  presets: [
    { label: 'Well-Behaved (γ = 0.6)', params: { gamma: 0.6, probeS: 140 } },
    { label: 'Linear Identity (γ = 1.0)', params: { gamma: 1.0, probeS: 128 } },
    { label: 'Steep Highlight (γ = 2.4)', params: { gamma: 2.4, probeS: 180 } },
  ],
  Stage: ({ params, image }) => {
    const gamma = params.gamma ?? 0.6;
    const probeS = params.probeS ?? 140;

    const forwardLut = useMemo(() => {
      return lutFromFn((r) => 255 * Math.pow(r / 255, gamma));
    }, [gamma]);

    const { invLut, isStrictlyMonotonic } = useMemo(() => {
      return invertMonotoneLUT(forwardLut, 256);
    }, [forwardLut]);

    // Round-trip test: r -> s -> r'
    const roundTripImg = useMemo(() => {
      const sImg = applyLUT(image, forwardLut);
      return applyLUT(sImg, invLut);
    }, [image, forwardLut, invLut]);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <CanvasImage image={roundTripImg} title="Round-Trip Restored Image r' = T⁻¹(T(r))" />
        <div className="w-full sm:w-[320px]">
          <LinePlot
            data={Array.from(forwardLut)}
            secondaryData={Array.from(invLut)}
            xLabel="Intensity (r or s)"
            yLabel="Mapped Intensity"
            probedX={probeS}
            showIdentity={true}
          />
        </div>
      </div>
    );
  },
  Explain: ({ mode, params }) => {
    return (
      <>
        <p>
          For a transformation <span className="font-mono text-accent">s = T(r)</span> to be invertible, it must be <strong>strictly monotonically increasing</strong>: <span className="font-mono">T(r_2) &gt; T(r_1)</span> for <span className="font-mono">r_2 &gt; r_1</span>.
        </p>
        <p>
          The inverse curve <span className="font-mono">r = T⁻¹(s)</span> (dashed orange) is the exact reflection of the forward curve (blue) across the identity diagonal!
        </p>
      </>
    );
  },
  buildSteps: (params) => {
    const gamma = params.gamma ?? 0.6;
    const probeS = params.probeS ?? 140;
    const invR = Math.round(255 * Math.pow(probeS / 255, 1 / gamma));

    return [
      {
        id: 'forward-eqn',
        title: 'Forward Transformation',
        latex: `s = 255 \\cdot \\left(\\frac{r}{255}\\right)^\\gamma`,
        substituted: `s = 255 \\cdot \\left(\\frac{r}{255}\\right)^{${formatNum(gamma)}}`,
        rationale: 'Original monotonic mapping function.',
      },
      {
        id: 'inverse-derivation',
        title: 'Algebraic Inverse Isolation',
        latex: `r = T^{-1}(s) = 255 \\cdot \\left(\\frac{s}{255}\\right)^{\\frac{1}{\\gamma}}`,
        substituted: `r = 255 \\cdot \\left(\\frac{${probeS}}{255}\\right)^{\\frac{1}{${formatNum(gamma)}}} = ${invR}`,
        rationale: 'Inverting the function recovers the original intensity level.',
        value: invR,
        highlight: { plot: 'curve', kind: 'point', at: probeS },
      },
    ];
  },
};

// ==========================================
// TOPIC 16: Histogram Matching
// ==========================================
export const histogramMatchingLab: LabModule = {
  slug: 'histogram-matching',
  params: [
    { id: 'targetShape', kind: 'select', label: 'Target Distribution Preset', options: [
      { value: 'bimodal', label: 'Bimodal (Two Peaks)' },
      { value: 'dark', label: 'Dark Mood (Shadow Weighted)' },
      { value: 'bright', label: 'Bright High-Key' },
      { value: 'uniform', label: 'Flat Uniform' },
    ], default: 'bimodal' },
    { id: 'blend', kind: 'slider', label: 'Matching Strength (α)', min: 0, max: 1, step: 0.1, default: 1.0 },
    { id: 'probeR', kind: 'slider', label: 'Probe Intensity r', min: 0, max: 255, step: 1, default: 90, advancedOnly: true },
  ],
  presets: [
    { label: 'Match Bimodal Target', params: { targetShape: 'bimodal', blend: 1.0 } },
    { label: 'Match Dark Mood', params: { targetShape: 'dark', blend: 1.0 } },
    { label: 'Subtle 50% Match', params: { targetShape: 'bimodal', blend: 0.5 } },
  ],
  Stage: ({ params, image }) => {
    const target = params.targetShape ?? 'bimodal';
    const alpha = params.blend ?? 1.0;
    const probe = params.probeR ?? 90;

    const srcHist = useMemo(() => computeHistogram(image, 256), [image]);
    const srcPdf = useMemo(() => normalizeHistogram(srcHist, image.w * image.h), [srcHist, image]);
    const srcCdf = useMemo(() => computeCDF(srcPdf), [srcPdf]);

    // Synthetic target CDF
    const tgtCdf = useMemo(() => {
      const pdf = new Float64Array(256);
      for (let i = 0; i < 256; i++) {
        if (target === 'bimodal') {
          const d1 = i - 60;
          const d2 = i - 190;
          pdf[i] = Math.exp(-(d1 * d1) / 800) + Math.exp(-(d2 * d2) / 800);
        } else if (target === 'dark') {
          pdf[i] = Math.exp(-i / 40);
        } else if (target === 'bright') {
          pdf[i] = Math.exp(-(255 - i) / 40);
        } else {
          pdf[i] = 1.0; // uniform
        }
      }
      let sum = 0;
      for (let i = 0; i < 256; i++) sum += pdf[i];
      for (let i = 0; i < 256; i++) pdf[i] /= sum;
      return computeCDF(pdf);
    }, [target]);

    const lut = useMemo(() => {
      const match = matchLUT(srcCdf, tgtCdf, 256);
      if (alpha >= 0.99) return match;
      const b = new Uint8ClampedArray(256);
      for (let i = 0; i < 256; i++) {
        b[i] = Math.round((1 - alpha) * i + alpha * match[i]);
      }
      return b;
    }, [srcCdf, tgtCdf, alpha]);

    const matchedImg = useMemo(() => applyLUT(image, lut), [image, lut]);
    const outHist = useMemo(() => computeHistogram(matchedImg, 64), [matchedImg]);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <CanvasImage image={matchedImg} title="Histogram-Matched Image" />
        <div className="w-full sm:w-[340px]">
          <BarPlot
            data={outHist}
            xLabel="Intensity (z)"
            yLabel="Achieved Matched Histogram"
            probedBin={lut[probe]}
          />
        </div>
      </div>
    );
  },
  Explain: ({ mode, params }) => {
    return (
      <>
        <p>
          While equalization forces a uniform shape, <strong>Histogram Matching (Specification)</strong> forces the image into <em>any desired custom target distribution</em>!
        </p>
        <p>
          The algorithm equalizes the source <span className="font-mono">s = T(r)</span>, equalizes the target <span className="font-mono">v = G(z)</span>, and then reverses the target map: <span className="font-mono text-accent">z = G⁻¹(T(r))</span>.
        </p>
      </>
    );
  },
  buildSteps: (params, image) => {
    const probe = params.probeR ?? 90;
    const hist = computeHistogram(image, 256);
    const pdf = normalizeHistogram(hist, image.w * image.h);
    const cdf = computeCDF(pdf);
    const s = Math.round(255 * cdf[probe]);

    return [
      {
        id: 'match-step1',
        title: 'Step 1: Equalize Source Image',
        latex: `s = T(r) = (L - 1) \\sum_{j=0}^r p_r(r_j)`,
        substituted: `s = 255 \\cdot ${formatNum(cdf[probe], 4)} = ${s}`,
        rationale: 'Maps source intensity to its intermediate uniform representation.',
        value: s,
      },
      {
        id: 'match-step2',
        title: 'Step 2: Inverse Target Equalization',
        latex: `z = G^{-1}(s) = G^{-1}(T(r))`,
        substituted: `z = G^{-1}(${s}) \\implies \\text{Find } z \\text{ where } G(z) \\approx ${s}`,
        rationale: 'Finds the target gray level whose cumulative probability matches s.',
      },
    ];
  },
};

// ==========================================
// TOPIC 17: Histogram Specification
// ==========================================
export const histogramSpecificationLab: LabModule = {
  slug: 'histogram-specification',
  params: [
    { id: 'peak1', kind: 'slider', label: 'Gaussian Mode 1 Center (μ1)', min: 30, max: 120, step: 5, default: 60 },
    { id: 'peak2', kind: 'slider', label: 'Gaussian Mode 2 Center (μ2)', min: 130, max: 220, step: 5, default: 190 },
    { id: 'spread', kind: 'slider', label: 'Gaussian Width (σ)', min: 10, max: 50, step: 5, default: 25 },
  ],
  presets: [
    { label: 'Bimodal Peaks (μ1=60, μ2=190)', params: { peak1: 60, peak2: 190, spread: 25 } },
    { label: 'High Key Dramatic (μ1=100, μ2=215)', params: { peak1: 100, peak2: 215, spread: 20 } },
  ],
  Stage: ({ params, image }) => {
    const p1 = params.peak1 ?? 60;
    const p2 = params.peak2 ?? 190;
    const sigma = params.spread ?? 25;

    const tgtPdf = useMemo(() => {
      const pdf = new Float64Array(256);
      for (let i = 0; i < 256; i++) {
        const d1 = i - p1;
        const d2 = i - p2;
        pdf[i] = Math.exp(-(d1 * d1) / (2 * sigma * sigma)) + 0.8 * Math.exp(-(d2 * d2) / (2 * sigma * sigma));
      }
      let sum = 0;
      for (let i = 0; i < 256; i++) sum += pdf[i];
      for (let i = 0; i < 256; i++) pdf[i] /= sum;
      return pdf;
    }, [p1, p2, sigma]);

    const tgtCdf = useMemo(() => computeCDF(tgtPdf), [tgtPdf]);
    const srcHist = useMemo(() => computeHistogram(image, 256), [image]);
    const srcCdf = useMemo(() => computeCDF(normalizeHistogram(srcHist, image.w * image.h)), [srcHist, image]);

    const lut = useMemo(() => matchLUT(srcCdf, tgtCdf, 256), [srcCdf, tgtCdf]);
    const matchedImg = useMemo(() => applyLUT(image, lut), [image, lut]);
    const achievedHist = useMemo(() => computeHistogram(matchedImg, 64), [matchedImg]);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <CanvasImage image={matchedImg} title="Specified Image Output" />
        <div className="w-full sm:w-[340px]">
          <BarPlot
            data={achievedHist}
            xLabel="Intensity (z)"
            yLabel="Achieved vs Target Distribution"
          />
        </div>
      </div>
    );
  },
  Explain: ({ mode, params }) => {
    return (
      <>
        <p>
          In <strong>Histogram Specification</strong>, you design the target profile as a parametric mixture of Gaussians:
        </p>
        <div className="py-1">
          <KatexView math="p_z(z) \propto \sum w_i \exp\left(-\frac{(z - \mu_i)^2}{2\sigma_i^2}\right)" displayMode />
        </div>
        <p className="text-xs text-text-muted">
          Adjust the sliders to shift the peaks around. Digital discretization prevents an exact continuous match, but the general shape is closely reproduced.
        </p>
      </>
    );
  },
  buildSteps: (params) => {
    const p1 = params.peak1 ?? 60;
    const p2 = params.peak2 ?? 190;
    const s = params.spread ?? 25;

    return [
      {
        id: 'specified-pdf',
        title: 'Mixture of Gaussians Formulation',
        latex: `p_z(z) = \\frac{1}{Z} \\left[ \\exp\\left(-\\frac{(z - \\mu_1)^2}{2\\sigma^2}\\right) + \\exp\\left(-\\frac{(z - \\mu_2)^2}{2\\sigma^2}\\right) \\right]`,
        substituted: `\\mu_1 = ${p1}, \\quad \\mu_2 = ${p2}, \\quad \\sigma = ${s}`,
        rationale: 'Parametrically specifies the target probability density.',
      },
    ];
  },
};

// ==========================================
// TOPIC 18: CDF Matching
// ==========================================
export const cdfMatchingLab: LabModule = {
  slug: 'cdf-matching',
  params: [
    { id: 'probeR', kind: 'slider', label: 'Probe Input Intensity (r)', min: 0, max: 255, step: 1, default: 85 },
  ],
  presets: [
    { label: 'Walk at r = 50', params: { probeR: 50 } },
    { label: 'Walk at r = 120', params: { probeR: 120 } },
    { label: 'Walk at r = 200', params: { probeR: 200 } },
  ],
  Stage: ({ params, image }) => {
    const probe = params.probeR ?? 85;

    const srcHist = useMemo(() => computeHistogram(image, 256), [image]);
    const srcCdf = useMemo(() => computeCDF(normalizeHistogram(srcHist, image.w * image.h)), [srcHist, image]);

    // Target CDF (steep sigmoid)
    const tgtCdf = useMemo(() => {
      const pdf = new Float64Array(256);
      for (let i = 0; i < 256; i++) {
        pdf[i] = Math.exp(-Math.pow(i - 160, 2) / 1200);
      }
      let sum = 0;
      for (let i = 0; i < 256; i++) sum += pdf[i];
      for (let i = 0; i < 256; i++) pdf[i] /= sum;
      return computeCDF(pdf);
    }, []);

    const srcVal = srcCdf[probe];
    // Find smallest z with tgtCdf[z] >= srcVal
    let bestZ = 0;
    for (let z = 0; z < 256; z++) {
      if (tgtCdf[z] >= srcVal) {
        bestZ = z;
        break;
      }
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <div className="w-full sm:w-[360px]">
          <LinePlot
            data={Array.from(srcCdf).map((v) => v * 255)}
            secondaryData={Array.from(tgtCdf).map((v) => v * 255)}
            xLabel="Intensity (r or z)"
            yLabel="CDF Value × 255"
            probedX={probe}
            showIdentity={false}
          />
        </div>
        <div className="bg-surface-mutedLight dark:bg-surface-mutedDark p-5 rounded-2xl border border-border-light dark:border-border-dark space-y-3 font-mono text-xs max-w-xs">
          <div className="text-text-muted text-[11px] font-bold uppercase tracking-wider">
            Staircase Walk Path
          </div>
          <div>1. Input Intensity: <span className="font-bold text-accent">r = {probe}</span></div>
          <div>2. Source CDF: <span className="font-bold text-accent">c_src({probe}) = {formatNum(srcVal, 4)}</span></div>
          <div>3. Match Target CDF: <span className="text-secondary font-bold">c_tgt(z) ≥ {formatNum(srcVal, 4)}</span></div>
          <div className="pt-2 border-t border-border-light dark:border-border-dark text-sm">
            Mapped Output: <span className="text-emerald-500 font-bold">z = {bestZ}</span>
          </div>
        </div>
      </div>
    );
  },
  Explain: ({ mode, params }) => {
    return (
      <>
        <p>
          Matching is fundamentally about <strong>lining up cumulative percentiles</strong>.
        </p>
        <p>
          Drag the probe intensity slider: a horizontal ray travels from the source CDF (blue) across to the target CDF (orange), and then drops straight down to determine the new pixel value <span className="font-mono text-accent">z</span>!
        </p>
      </>
    );
  },
  buildSteps: (params, image) => {
    const probe = params.probeR ?? 85;
    const srcHist = computeHistogram(image, 256);
    const srcCdf = computeCDF(normalizeHistogram(srcHist, image.w * image.h));
    const srcVal = srcCdf[probe];

    return [
      {
        id: 'cdf-walk-equation',
        title: 'CDF Percentile Equivalence Rule',
        latex: `z = \\min \\{ z \\in [0, L-1] \\mid c_{\\text{tgt}}(z) \\ge c_{\\text{src}}(r) \\}`,
        substituted: `c_{\\text{src}}(${probe}) = ${formatNum(srcVal, 4)} \\implies \\text{Find smallest } z`,
        rationale: 'Exact integer matching rule resolving plateaus and discrete quantizations.',
      },
    ];
  },
};

// ==========================================
// TOPIC 19: Global Histogram Processing
// ==========================================
export const globalHistogramProcessingLab: LabModule = {
  slug: 'global-histogram-processing',
  params: [
    { id: 'op', kind: 'select', label: 'Global Operation', options: [
      { value: 'equalize', label: 'Global Equalization' },
      { value: 'stretch', label: 'Global Contrast Stretch' },
      { value: 'gamma', label: 'Global Gamma Brighten' },
    ], default: 'equalize' },
    { id: 'highlightProblem', kind: 'toggle', label: 'Highlight Over/Under-Exposed Regions', default: true },
  ],
  presets: [
    { label: 'Global Equalization (Washout Artifacts)', params: { op: 'equalize', highlightProblem: true } },
    { label: 'Global Gamma 0.5', params: { op: 'gamma', highlightProblem: true } },
  ],
  Stage: ({ params, image }) => {
    const op = params.op ?? 'equalize';
    const showProb = params.highlightProblem ?? true;

    const lut = useMemo(() => {
      if (op === 'gamma') {
        return lutFromFn((r) => 255 * Math.pow(r / 255, 0.5));
      }
      if (op === 'stretch') {
        return lutFromFn((r) => Math.max(0, Math.min(255, (r - 40) * 1.5)));
      }
      const hist = computeHistogram(image, 256);
      const cdf = computeCDF(normalizeHistogram(hist, image.w * image.h));
      return equalizeLUT(cdf, 256);
    }, [image, op]);

    const processed = useMemo(() => applyLUT(image, lut), [image, lut]);

    // Problem mask: pixels washed out (>= 245) or crushed (<= 10)
    const problemRange: [number, number] | null = showProb ? [240, 255] : null;

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <CanvasImage image={image} title="Original Uneven Scene" />
        <CanvasImage image={processed} title="Global Transform (Washed Out in Green)" brushedRange={problemRange} />
      </div>
    );
  },
  Explain: ({ mode, params }) => {
    return (
      <>
        <p>
          <strong>Global processing</strong> uses one single transformation function for every single pixel in the entire image, completely ignoring spatial location.
        </p>
        <p>
          In scenes with mixed bright spots and deep shadows (like a flashlight or sunny window), global equalization over-amplifies noise in background areas and washes out bright areas!
        </p>
      </>
    );
  },
  buildSteps: (params, image) => {
    return [
      {
        id: 'global-lut-def',
        title: 'Spatially Invariant Mapping',
        latex: `g(x, y) = T(f(x, y)) \\quad \\forall (x, y) \\in M \\times N`,
        substituted: `T \\text{ depends solely on the aggregate global image histogram}`,
        rationale: 'Fails to adapt to local regional lighting differences across the scene.',
      },
    ];
  },
};

// ==========================================
// TOPIC 20: Local vs Global (CLAHE)
// ==========================================
export const localVsGlobalLab: LabModule = {
  slug: 'local-vs-global',
  params: [
    { id: 'mode', kind: 'select', label: 'Processing Algorithm', options: [
      { value: 'clahe', label: 'CLAHE (Tile Grid + Bilinear Interp)' },
      { value: 'tiled', label: 'Tiled Without Interpolation' },
      { value: 'global', label: 'Standard Global Equalization' },
    ], default: 'clahe' },
    { id: 'clipLimit', kind: 'slider', label: 'CLAHE Clip Limit', min: 1.0, max: 4.0, step: 0.5, default: 2.0 },
    { id: 'gridSize', kind: 'slider', label: 'Tile Grid Size', min: 4, max: 16, step: 4, default: 8, unit: 'px' },
  ],
  presets: [
    { label: 'CLAHE Smooth (Grid 8, Clip 2.0)', params: { mode: 'clahe', clipLimit: 2.0, gridSize: 8 } },
    { label: 'Tiled Seams Visible (No Interp)', params: { mode: 'tiled', clipLimit: 2.0, gridSize: 16 } },
    { label: 'Global Comparison', params: { mode: 'global', clipLimit: 2.0, gridSize: 8 } },
  ],
  Stage: ({ params, image }) => {
    const mode = params.mode ?? 'clahe';
    const clip = params.clipLimit ?? 2.0;
    const grid = params.gridSize ?? 8;

    const processed = useMemo(() => {
      if (mode === 'global') {
        const hist = computeHistogram(image, 256);
        const cdf = computeCDF(normalizeHistogram(hist, image.w * image.h));
        const lut = equalizeLUT(cdf, 256);
        return applyLUT(image, lut);
      }
      const interpolate = mode === 'clahe';
      return localEqualize(image, grid, clip, interpolate);
    }, [image, mode, clip, grid]);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <CanvasImage image={image} title="Original Image" />
        <CanvasImage
          image={processed}
          title={mode === 'clahe' ? 'CLAHE (Local Adaptive + Bilinear)' : mode === 'tiled' ? 'Tiled Equalization (Tile Seams)' : 'Global Equalization'}
        />
      </div>
    );
  },
  Explain: ({ mode, params }) => {
    return (
      <>
        <p>
          <strong>CLAHE</strong> (Contrast-Limited Adaptive Histogram Equalization) splits the image into small contextual tiles, equalizes each tile locally, clips tall histogram spikes to avoid amplifying noise, and bilinearly blends tile borders to remove seams!
        </p>
        <p className="text-xs text-text-muted">
          Compare <em>CLAHE</em> against <em>Tiled Without Interpolation</em>: notice how bilinear interpolation completely eliminates visible tile borders.
        </p>
      </>
    );
  },
  buildSteps: (params, image) => {
    const clip = params.clipLimit ?? 2.0;
    const grid = params.gridSize ?? 8;

    return [
      {
        id: 'clahe-clip-formula',
        title: 'CLAHE Clipping Threshold',
        latex: `C_{\\text{clip}} = \\frac{N_{\\text{tile}}}{L} \\cdot \\text{ClipLimit}`,
        substituted: `C_{\\text{clip}} = \\frac{(${grid} \\times ${grid})}{256} \\times ${clip} = ${formatNum((grid * grid * clip) / 256, 2)}`,
        rationale: 'Histogram counts exceeding this limit are shaved and redistributed equally among all bins.',
        value: (grid * grid * clip) / 256,
      },
      {
        id: 'bilinear-blending',
        title: 'Bilinear Tile Interpolation',
        latex: `f(x, y) = (1-s)(1-t) T_1 + s(1-t) T_2 + (1-s)t T_3 + st T_4`,
        substituted: `\\text{Blends 4 neighboring tile mappings based on relative distance } (s, t)`,
        rationale: 'Completely eliminates rectangular tile boundary artifacts.',
      },
    ];
  },
};
