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
import { DualViewExplain } from '../components/shell/DualViewExplain';
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
  Explain: ({ mode, params }) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <>
            <p><strong>Histogram Equalization</strong> is like stretching a wrinkled piece of laundry so it's smooth and flat. It takes all the pixel brightness levels and spreads them evenly across the full spectrum from 0 to 255.</p>
          </>
        ),
        controls: (
          <>
            <ul>
              <li><strong>Equalization Blend (α):</strong> Acts like an opacity slider. 100% applies the full stretch, 0% leaves the image as is.</li>
              <li><strong>Show CDF Overlay:</strong> Shows the cumulative path of pixel brightness (the "S-curve" that serves as the mapping function).</li>
            </ul>
          </>
        ),
        whatToLookFor: (
          <>
            <p>1. Start with the 'Original (0%)' preset to see the washed-out contrast.</p>
            <p>2. Drag the Blend slider up to 100% and watch how the dense cluster in the histogram spreads outward!</p>
          </>
        ),
        whyItMatters: (
          <>
            <p><strong>Night Mode Photography:</strong> Phone cameras use localized equalization to pull detail out of pitch-black shadows without overexposing streetlights.</p>
          </>
        )
      }}
      advanced={{
        math: (
          <>
            <p>The continuous transformation function is <span className="font-mono text-accent">{`T(r) = (L-1)\int_0^r p_r(w)dw`}</span>.</p>
            <p>In discrete form, <span className="font-mono text-accent">{`s_k = T(r_k) = (L-1)\sum_{j=0}^k p_r(r_j)`}</span>.</p>
          </>
        ),
        algorithm: (
          <>
            <p>1. Compute PMF <span className="font-mono text-accent">{`p_r(r)`}</span> in <span className="font-mono text-accent">{`O(MN)`}</span>.</p>
            <p>2. Compute CDF in <span className="font-mono text-accent">{`O(L)`}</span>.</p>
            <p>3. Apply lookup table (LUT) mapping in <span className="font-mono text-accent">{`O(MN)`}</span>.</p>
          </>
        ),
        parameterImpact: (
          <>
            <p>The transformation guarantees the output CDF is strictly linear, maximizing entropy <span className="font-mono text-accent">{`H = -\sum p(s)\log p(s)`}</span> for a flat PMF.</p>
          </>
        ),
        applications: (
          <>
            <p>Used heavily in <strong>medical radiography</strong> (X-rays) to enhance low-contrast tissue structures for diagnosis.</p>
          </>
        )
      }}
    />
  ),
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
  Explain: ({ mode, params }) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <>
            <p>Think of the <strong>Equalization Mapping</strong> like a funhouse mirror for pixels. Where the mirror curves outward rapidly (steep slope), small differences in gray become huge contrast jumps.</p>
          </>
        ),
        controls: (
          <>
            <ul>
              <li><strong>Probe Intensity r:</strong> Moves a flashlight across the input brightness levels to inspect exactly how that specific gray value gets transformed.</li>
            </ul>
          </>
        ),
        whatToLookFor: (
          <>
            <p>1. Move the probe to a tall spike on the left (Input PDF).</p>
            <p>2. Notice how the mapping curve on the right is steepest exactly at that spot, spreading those pixels apart!</p>
          </>
        ),
        whyItMatters: (
          <>
            <p><strong>Airport X-Ray Scanners:</strong> Baggage scanners apply mapping curves that aggressively stretch mid-tones, making subtle density differences (like organic vs inorganic materials) pop out instantly.</p>
          </>
        )
      }}
      advanced={{
        math: (
          <>
            <p>By the Fundamental Theorem of Calculus, the derivative of the transfer function is proportional to the source PDF: <span className="font-mono text-accent">{`dT/dr = (L-1)p_r(r)`}</span>.</p>
          </>
        ),
        algorithm: (
          <>
            <p>The LUT formulation requires evaluating the partial sum. Time complexity is purely bounded by histogram generation <span className="font-mono text-accent">{`O(MN)`}</span>.</p>
          </>
        ),
        parameterImpact: (
          <>
            <p>Where <span className="font-mono text-accent">{`p_r(r) \approx 0`}</span>, the derivative <span className="font-mono text-accent">{`dT/dr \approx 0`}</span>, leading to "dead zones" in the output histogram (missing bins).</p>
          </>
        ),
        applications: (
          <>
            <p>Foundational in establishing monotonic point operations for multi-spectral satellite imagery to normalize sensor response.</p>
          </>
        )
      }}
    />
  ),
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
  Explain: ({ mode, params }) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <>
            <p>A <strong>Normalized Histogram</strong> is like switching from saying "15 people like apples" to "50% of people like apples". It turns raw pixel counts into percentages (probabilities).</p>
          </>
        ),
        controls: (
          <>
            <ul>
              <li><strong>Resolution Scale:</strong> Shrinks or grows the image size (total number of pixels).</li>
              <li><strong>Normalize to Probability p(r):</strong> Toggles between showing raw pixel counts and percentage values.</li>
            </ul>
          </>
        ),
        whatToLookFor: (
          <>
            <p>1. Turn off 'Normalize' and change the resolution. See how the Y-axis numbers change drastically.</p>
            <p>2. Turn 'Normalize' ON and do it again. The Y-axis stays exactly the same!</p>
          </>
        ),
        whyItMatters: (
          <>
            <p><strong>Image Recognition AI:</strong> Neural networks need consistent inputs. By normalizing histograms, an AI can recognize the lighting of a scene regardless of whether the photo is 4K or low-res.</p>
          </>
        )
      }}
      advanced={{
        math: (
          <>
            <p>The normalized PMF is defined as <span className="font-mono text-accent">{`p(r_k) = n_k / (M \cdot N)`}</span>, ensuring <span className="font-mono text-accent">{`\sum_{k=0}^{L-1} p(r_k) = 1`}</span>.</p>
          </>
        ),
        algorithm: (
          <>
            <p>Requires an additional pass over the histogram bins <span className="font-mono text-accent">{`O(L)`}</span> to divide by the total area <span className="font-mono text-accent">{`MN`}</span>. Total complexity remains <span className="font-mono text-accent">{`O(MN + L)`}</span>.</p>
          </>
        ),
        parameterImpact: (
          <>
            <p>Sub-sampling reduces <span className="font-mono text-accent">{`M \cdot N`}</span> but preserves the statistical distribution of <span className="font-mono text-accent">{`p(r_k)`}</span> assuming the image is wide-sense stationary over space.</p>
          </>
        ),
        applications: (
          <>
            <p>Used in <strong>Image retrieval systems (CBIR)</strong> to compute distances (e.g., Bhattacharyya distance) between images independent of their resolution.</p>
          </>
        )
      }}
    />
  ),
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
        substituted: `p(r_k) = \\frac{n_k}{${newW} \\times ${newH}} = \\frac{n_k}{${total.toLocaleString().replace(/,/g, '{,}')}}`,
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
  Explain: ({ mode, params }) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <>
            <p><strong>Histogram Transformation</strong> is like reshaping a pile of sand by dragging a tool over it. As you change how bright an input pixel becomes, the entire histogram "pile" shifts and squishes.</p>
          </>
        ),
        controls: (
          <>
            <ul>
              <li><strong>Transformation Exponent (γ):</strong> Bends the mapping curve. γ &lt; 1 lifts shadows, γ &gt; 1 compresses highlights.</li>
            </ul>
          </>
        ),
        whatToLookFor: (
          <>
            <p>1. Select 'Expand Shadows' (γ = 0.5) and watch the dark pixels in the left histogram spread out evenly on the right.</p>
            <p>2. Notice how flat parts of the curve cause output bins to merge and pile up tall!</p>
          </>
        ),
        whyItMatters: (
          <>
            <p><strong>Display Calibration:</strong> Monitors apply physical gamma curves to light output. We do this exact mathematical inverse transformation so the final image looks perfectly natural to human eyes.</p>
          </>
        )
      }}
      advanced={{
        math: (
          <>
            <p>By the change of variables theorem, <span className="font-mono text-accent">{`p_s(s) = p_r(r) \cdot \left| \frac{dr}{ds} \right|`}</span>.</p>
          </>
        ),
        algorithm: (
          <>
            <p>For a non-linear <span className="font-mono text-accent">{`T(r)`}</span>, discrete bins might split or merge. Time complexity is <span className="font-mono text-accent">{`O(MN)`}</span> via LUT.</p>
          </>
        ),
        parameterImpact: (
          <>
            <p>When <span className="font-mono text-accent">{`\gamma &gt; 1`}</span>, the derivative <span className="font-mono text-accent">{`ds/dr`}</span> is small near 0, meaning large regions of dark inputs collapse into a single output bin, destroying low-level contrast.</p>
          </>
        ),
        applications: (
          <>
            <p>Crucial for <strong>radiometric calibration</strong> in underwater vision to correct for wavelength-dependent attenuation (water absorbs red light faster than blue).</p>
          </>
        )
      }}
    />
  ),
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
  Explain: ({ mode, params }) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <>
            <p>An <strong>Inverse Transformation</strong> is like having an "Undo" button for your brightness changes. If you darken an image, the inverse function exactly calculates how to brighten it back up to its original state.</p>
          </>
        ),
        controls: (
          <>
            <ul>
              <li><strong>Forward Exponent (γ):</strong> The initial damage/change done to the image.</li>
              <li><strong>Probe Intensity s:</strong> Pick a spot on the "changed" image to trace it back to its original color.</li>
            </ul>
          </>
        ),
        whatToLookFor: (
          <>
            <p>1. Set γ to a low number. See how the blue curve bows upwards.</p>
            <p>2. Notice how the dashed orange inverse curve bows downwards—an exact mirror reflection across the diagonal!</p>
          </>
        ),
        whyItMatters: (
          <>
            <p><strong>Decryption & Forensics:</strong> When analyzing obfuscated or poorly transmitted satellite signals, engineers must derive and apply a perfect inverse mathematical function to recover the true original signal.</p>
          </>
        )
      }}
      advanced={{
        math: (
          <>
            <p>The inverse function <span className="font-mono text-accent">{`T^{-1}(s)`}</span> must be single-valued. Thus, <span className="font-mono text-accent">{`T(r)`}</span> must be strictly monotonically increasing: <span className="font-mono text-accent">{`T(r_2) &gt; T(r_1)`}</span> for <span className="font-mono text-accent">{`r_2 &gt; r_1`}</span>.</p>
          </>
        ),
        algorithm: (
          <>
            <p>Discrete inversion is <span className="font-mono text-accent">{`O(L)`}</span>: for each <span className="font-mono text-accent">{`r`}</span>, map <span className="font-mono text-accent">{`s = T(r)`}</span>. The inverse table maps <span className="font-mono text-accent">{`LUT_{inv}[s] = r`}</span> with linear interpolation for unmapped bins.</p>
          </>
        ),
        parameterImpact: (
          <>
            <p>If quantization occurs before inversion, round-trip error <span className="font-mono text-accent">{`|r - T^{-1}(Q(T(r)))|`}</span> is bounded by the local derivative of the inverse function.</p>
          </>
        ),
        applications: (
          <>
            <p>Applied in <strong>HDR imaging pipelines</strong> where raw sensor data is log-encoded, transmitted, and then inverse-transformed before local tone-mapping.</p>
          </>
        )
      }}
    />
  ),
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
  Explain: ({ mode, params }) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <>
            <p><strong>Histogram Matching</strong> is like forcing your photo to match a paint swatch book. Instead of just "flattening" everything, you command the image to take on a specific mood—like dark, bright, or split contrast.</p>
          </>
        ),
        controls: (
          <>
            <ul>
              <li><strong>Target Distribution Preset:</strong> Pick the "mood" you want to force onto the image.</li>
              <li><strong>Matching Strength (α):</strong> Blend between the original image and the fully matched image.</li>
            </ul>
          </>
        ),
        whatToLookFor: (
          <>
            <p>1. Pick the "Dark Mood" preset.</p>
            <p>2. See how the final histogram shifts all its bulk to the left, actively forcing the bright image into the shadows!</p>
          </>
        ),
        whyItMatters: (
          <>
            <p><strong>Cinema Color Grading:</strong> When editing a movie, directors use histogram matching to make a shot filmed at noon look exactly like a shot filmed at dusk, ensuring scene consistency.</p>
          </>
        )
      }}
      advanced={{
        math: (
          <>
            <p>Matching finds a mapping <span className="font-mono text-accent">{`z = T_{match}(r)`}</span> such that <span className="font-mono text-accent">{`p_z(z) \approx p_{target}(z)`}</span>.</p>
            <p>Derived via double equalization: <span className="font-mono text-accent">{`z = G^{-1}(T(r))`}</span>.</p>
          </>
        ),
        algorithm: (
          <>
            <p>1. Equalize source: <span className="font-mono text-accent">{`s = T(r)`}</span> in <span className="font-mono text-accent">{`O(MN)`}</span>.</p>
            <p>2. Equalize target: <span className="font-mono text-accent">{`v = G(z)`}</span> in <span className="font-mono text-accent">{`O(L)`}</span>.</p>
            <p>3. Map source to target: <span className="font-mono text-accent">{`z = G^{-1}(s)`}</span> in <span className="font-mono text-accent">{`O(L)`}</span>.</p>
          </>
        ),
        parameterImpact: (
          <>
            <p>Discrete quantization means exact continuous matching is impossible. Bins cannot be split, so the achieved histogram will show localized gaps or spikes compared to the ideal target PDF.</p>
          </>
        ),
        applications: (
          <>
            <p>Extensively used in <strong>remote sensing and mosaic stitching</strong> to radiometrically align multi-pass drone imagery before stitching them together.</p>
          </>
        )
      }}
    />
  ),
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
  Explain: ({ mode, params }) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <>
            <p><strong>Histogram Specification</strong> is taking total control! You are literally drawing the target shape by mixing Gaussian curves (like clay hills) and forcing the image to conform to those hills.</p>
          </>
        ),
        controls: (
          <>
            <ul>
              <li><strong>Gaussian Mode Centers (μ1, μ2):</strong> Moves the "hills" left (darker) or right (brighter).</li>
              <li><strong>Gaussian Width (σ):</strong> Makes the hills sharper (harsh contrast) or wider (smooth transitions).</li>
            </ul>
          </>
        ),
        whatToLookFor: (
          <>
            <p>1. Move the sliders to create two separate peaks (bimodal).</p>
            <p>2. The achieved histogram will clump pixels strictly under those two hills, creating a stark, high-contrast look!</p>
          </>
        ),
        whyItMatters: (
          <>
            <p><strong>Astrophotography:</strong> When capturing nebulas, scientists specify custom histograms that isolate the black background (peak 1) and stretch the faint starlight (peak 2) to reveal invisible galaxies.</p>
          </>
        )
      }}
      advanced={{
        math: (
          <>
            <p>The target PDF is formulated as a Gaussian Mixture Model (GMM):</p>
            <p><span className="font-mono text-accent">{`p_z(z) \propto \sum w_i \exp\left(-\frac{(z - \mu_i)^2}{2\sigma_i^2}\right)`}</span></p>
          </>
        ),
        algorithm: (
          <>
            <p>Target CDF requires numerical integration (cumulative sum) of the sampled continuous GMM over <span className="font-mono text-accent">{`[0, 255]`}</span>, followed by <span className="font-mono text-accent">{`O(L)`}</span> normalization.</p>
          </>
        ),
        parameterImpact: (
          <>
            <p>If <span className="font-mono text-accent">{`\sigma`}</span> is exceedingly small (Dirac delta approximation), the transformation collapses the image into binary/ternary quantization, drastically reducing entropy.</p>
          </>
        ),
        applications: (
          <>
            <p>Used in <strong>infrared thermography</strong> to standardize heat signatures, mapping specific temperature ranges (cold vs hot zones) into specified color bands.</p>
          </>
        )
      }}
    />
  ),
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
  Explain: ({ mode, params }) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <>
            <p><strong>CDF Matching</strong> is the secret engine behind histogram matching. It asks: "If a pixel is in the top 10% brightest of the original image, what value represents the top 10% in the target shape?"</p>
          </>
        ),
        controls: (
          <>
            <ul>
              <li><strong>Probe Input Intensity (r):</strong> Moves the crosshair to trace the mathematical path from source, across to target, and down to the output.</li>
            </ul>
          </>
        ),
        whatToLookFor: (
          <>
            <p>1. Drag the probe and watch the staircase line.</p>
            <p>2. It goes UP from the blue line (finding its percentile), ACROSS to the orange line (finding the matching percentile), and DOWN to get the new pixel value!</p>
          </>
        ),
        whyItMatters: (
          <>
            <p><strong>Standardized Testing (Grading on a Curve):</strong> This is exactly how test scores are curved! If you are in the 90th percentile of test-takers (source CDF), you get matched to an 'A' grade (target CDF).</p>
          </>
        )
      }}
      advanced={{
        math: (
          <>
            <p>The exact mapping resolves to: <span className="font-mono text-accent">{`z = \min \{ z \in [0, L-1] \mid c_{tgt}(z) \ge c_{src}(r) \}`}</span>.</p>
          </>
        ),
        algorithm: (
          <>
            <p>Executed via a forward search or binary search on the pre-computed monotonic CDF arrays. In practice, a two-pointer walk completes the LUT in <span className="font-mono text-accent">{`O(L)`}</span> time.</p>
          </>
        ),
        parameterImpact: (
          <>
            <p>The inequality <span className="font-mono text-accent">{`\ge`}</span> resolves discrete plateaus in <span className="font-mono text-accent">{`c_{tgt}`}</span>, guaranteeing that all pixels mapping to a flat region in the target CDF collapse to the lowest valid intensity <span className="font-mono text-accent">{`z`}</span>.</p>
          </>
        ),
        applications: (
          <>
            <p>Integral to optimal quantization schemes like Lloyd-Max, driving efficient bit-allocation in video compression codecs.</p>
          </>
        )
      }}
    />
  ),
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
  Explain: ({ mode, params }) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <>
            <p><strong>Global Processing</strong> is a "one-size-fits-all" approach. It applies the exact same brightness rule to every pixel, whether that pixel is in a pitch-black shadow or staring straight into the sun.</p>
          </>
        ),
        controls: (
          <>
            <ul>
              <li><strong>Global Operation:</strong> Try different one-size-fits-all rules.</li>
              <li><strong>Highlight Over/Under-Exposed:</strong> Turns problem areas bright green so you can see where the algorithm destroyed detail.</li>
            </ul>
          </>
        ),
        whatToLookFor: (
          <>
            <p>1. Select 'Global Equalization' and turn on the highlight toggle.</p>
            <p>2. Notice how massive chunks of the image turn green—the dark areas were brightened nicely, but the already-bright areas got blown out entirely!</p>
          </>
        ),
        whyItMatters: (
          <>
            <p><strong>Flash Photography Flaws:</strong> When taking a flash photo indoors, the subject is bright but the room is dark. Global edits will either ruin the subject to fix the room, or ruin the room to fix the subject.</p>
          </>
        )
      }}
      advanced={{
        math: (
          <>
            <p>The transformation is spatially invariant: <span className="font-mono text-accent">{`g(x, y) = T(f(x, y)) \quad \forall (x, y) \in M \times N`}</span>.</p>
          </>
        ),
        algorithm: (
          <>
            <p>Calculates a single LUT based on the global PDF. Space complexity is merely <span className="font-mono text-accent">{`O(L)`}</span> memory footprint for the transformation array.</p>
          </>
        ),
        parameterImpact: (
          <>
            <p>Bimodal lighting conditions cause the global CDF to have massive jumps, resulting in a steep <span className="font-mono text-accent">{`T(r)`}</span> that forcefully clips intermediate local textures into saturation bounds (0 or 255).</p>
          </>
        ),
        applications: (
          <>
            <p>Used primarily as a pre-processing step in <strong>OCR (Optical Character Recognition)</strong> pipelines for flat-lit document scans where spatial lighting variation is strictly zero.</p>
          </>
        )
      }}
    />
  ),
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
    { id: 'px', kind: 'slider', label: 'Probe x', min: 0, max: 127, step: 1, default: 64, unit: 'px' },
    { id: 'py', kind: 'slider', label: 'Probe y', min: 0, max: 127, step: 1, default: 64, unit: 'px' },
  ],
  presets: [
    { label: 'CLAHE Smooth (Grid 8, Clip 2.0)', params: { mode: 'clahe', clipLimit: 2.0, gridSize: 8, px: 64, py: 64 } },
    { label: 'Tiled Seams Visible (No Interp)', params: { mode: 'tiled', clipLimit: 2.0, gridSize: 16, px: 64, py: 64 } },
    { label: 'Global Comparison', params: { mode: 'global', clipLimit: 2.0, gridSize: 8, px: 64, py: 64 } },
  ],
  Stage: ({ params, image, onParamChange }) => {
    const mode = params.mode ?? 'clahe';
    const clip = params.clipLimit ?? 2.0;
    const grid = params.gridSize ?? 8;
    const x = Math.min(image.w - 1, Math.max(0, params.px ?? 64));
    const y = Math.min(image.h - 1, Math.max(0, params.py ?? 64));

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

    const handleProbeChange = (pt: { x: number; y: number }) => {
      onParamChange?.('px', pt.x);
      onParamChange?.('py', pt.y);
    };

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <CanvasImage
          image={image}
          title="Original Image"
          probePoint={{ x, y }}
          kernelSize={grid}
          onProbePointChange={handleProbeChange}
        />
        <CanvasImage
          image={processed}
          title={mode === 'clahe' ? 'CLAHE (Local Adaptive + Bilinear)' : mode === 'tiled' ? 'Tiled Equalization (Tile Seams)' : 'Global Equalization'}
          probePoint={{ x, y }}
          kernelSize={grid}
          onProbePointChange={handleProbeChange}
        />
      </div>
    );
  },
  Explain: ({ mode, params }) => {
    const px = params.px ?? 64;
    const py = params.py ?? 64;
    return (
      <DualViewExplain
        mode={mode}
        beginner={{
          concept: (
            <>
              <p><strong>CLAHE (Adaptive Local Equalization)</strong> is the smart solution. Instead of one rule for the whole image, it divides the image into a grid of tiny tiles and calculates a custom contrast rule for each tile individually.</p>
            </>
          ),
          controls: (
            <>
              <ul>
                <li><strong>Processing Algorithm:</strong> Compare CLAHE (smooth), Tiled (blocky), and Global (washed out).</li>
                <li><strong>Tile Grid Size:</strong> How small the contextual blocks should be.</li>
                <li><strong>CLAHE Clip Limit:</strong> Prevents pure noise (like a flat gray sky) from being over-amplified.</li>
              </ul>
            </>
          ),
          whatToLookFor: (
            <>
              <p>1. Switch to 'Tiled Without Interpolation' and observe the grid lines (seams).</p>
              <p>2. Switch back to 'CLAHE'—it uses smart blending (interpolation) to melt those seams away!</p>
            </>
          ),
          whyItMatters: (
            <>
              <p><strong>Medical MRI & Ultrasound:</strong> Doctors rely on CLAHE. It reveals hidden tumors in dark tissue regions without destroying the bright bone structures right next to them.</p>
            </>
          )
        }}
        advanced={{
          math: (
            <>
              <p>Bilinear tile interpolation for a pixel at normalized coordinate <span className="font-mono text-accent">{`(s, t)`}</span>:</p>
              <p><span className="font-mono text-accent">{`f(x, y) = (1-s)(1-t) T_{TL} + s(1-t) T_{TR} + (1-s)t T_{BL} + st T_{BR}`}</span></p>
            </>
          ),
          algorithm: (
            <>
              <p>Complexity increases to <span className="font-mono text-accent">{`O(MN + (M/B)(N/B)L)`}</span> where <span className="font-mono text-accent">{`B`}</span> is the tile block size. The clipping mechanism redistributes excess probability mass equally across all <span className="font-mono text-accent">{`L`}</span> bins.</p>
            </>
          ),
          parameterImpact: (
            <>
              <p>A higher Clip Limit behaves closer to pure local AHE (noise amplification). As Grid Size approaches <span className="font-mono text-accent">{`M \times N`}</span>, the algorithm converges back to Global Equalization.</p>
            </>
          ),
          applications: (
            <>
              <p>Crucial for <strong>underwater robot vision</strong> to counter extreme non-uniform illumination scattering, and in autonomous vehicle pipelines to handle stark headlight/shadow contrasts.</p>
            </>
          )
        }}
      />
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
