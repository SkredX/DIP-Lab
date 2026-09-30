import React, { useMemo } from 'react';
import { DualViewExplain } from '../components/shell/DualViewExplain';
import { LabModule, LabStageProps, ParamDef, PresetDef } from './types';
import { CanvasImage } from '../components/plots/CanvasImage';
import { LinePlot } from '../components/plots/LinePlot';
import { Step } from '../engine/math/types';
import { formatNum as f } from '../engine/math/stepEngine';
import { computeMSEandPSNR } from '../engine/image/transforms';
import { Kernel, KERNELS, box, gaussK, gauss2, kSum, convolve, patch, addNoise, edgeWidth } from '../engine/image/filters';

// ---------- shared params ----------
const P = {
  size: { id: 'size', kind: 'slider', label: 'Kernel size (n × n)', min: 3, max: 11, step: 2, default: 3 } as ParamDef,
  sigma: { id: 'sigma', kind: 'slider', label: 'Std. deviation (σ)', min: 0.5, max: 5, step: 0.1, default: 1.2 } as ParamDef,
  noise: { id: 'noise', kind: 'slider', label: 'Noise level (σₙ)', min: 0, max: 60, step: 1, default: 0 } as ParamDef,
  px: { id: 'px', kind: 'slider', label: 'Probe x', min: 2, max: 125, step: 1, default: 64 } as ParamDef,
  py: { id: 'py', kind: 'slider', label: 'Probe y', min: 2, max: 125, step: 1, default: 64 } as ParamDef,
  kernel: { id: 'kernel', kind: 'select', label: 'Kernel', default: 'box3', options: [
    { value: 'identity', label: 'Identity' }, { value: 'box3', label: 'Box 3×3' }, { value: 'gauss3', label: 'Gaussian 3×3' },
    { value: 'sharpen', label: 'Sharpen' }, { value: 'edge', label: 'Edge (zero-sum)' }, { value: 'emboss', label: 'Emboss' }] } as ParamDef,
};

// ---------- tiny visual helpers ----------
const Grid: React.FC<{ m: number[][]; title: string; d?: number; hi?: [number, number] }> = ({ m, title, d = 2, hi }) => {
  const max = Math.max(...m.flat().map(Math.abs), 1e-9);
  return (
    <figure className="flex flex-col items-center gap-2">
      <div className="inline-grid gap-px rounded-xl overflow-hidden border border-border-light dark:border-border-dark bg-border-light dark:bg-border-dark"
        style={{ gridTemplateColumns: `repeat(${m[0].length}, minmax(0, 1fr))` }}>
        {m.flatMap((r, i) => r.map((v, j) => (
          <span key={`${i}-${j}`} className="px-1.5 py-1 text-[10px] font-mono text-center min-w-[30px] text-text-light dark:text-text-dark"
            style={{ background: `rgba(10,132,255,${0.06 + 0.4 * Math.abs(v) / max})`, outline: hi && hi[0] === i && hi[1] === j ? '2px solid #0A84FF' : undefined }}>
            {Number.isInteger(v) ? v : v.toFixed(d)}
          </span>)))}
      </div>
      <figcaption className="text-[11px] text-text-muted">{title}</figcaption>
    </figure>
  );
};
const resample = (row: ArrayLike<number>) => Array.from({ length: 256 }, (_, i) => row[Math.min(row.length - 1, Math.floor((i / 255) * (row.length - 1)))]);
const rowOf = (im: { w: number; data: Uint8ClampedArray }, y: number) => im.data.slice(y * im.w, (y + 1) * im.w);
const clampP = (p: Record<string, any>, im: { w: number; h: number }) => ({ x: Math.min(im.w - 3, p.px ?? 64), y: Math.min(im.h - 3, p.py ?? 64) });

// ---------- shared math: weighted sum at a probed pixel ----------
function convSteps(k: Kernel, src: LabStageProps['image'], x: number, y: number, flip: boolean): Step[] {
  const n = k.length, pt = patch(src, x, y, n), kk = flip ? k.map((r) => [...r].reverse()).reverse() : k;
  const terms = kk.flatMap((r, i) => r.map((w, j) => ({ w, v: pt[i][j] })));
  const val = terms.reduce((a, t) => a + t.w * t.v, 0);
  const shown = terms.slice(0, 9).map((t) => `${f(t.w)}\\cdot ${t.v}`).join(' + ') + (terms.length > 9 ? ' + \\cdots' : '');
  return [
    { id: 'def', title: 'Filtering as a weighted sum', latex: 'g(x,y)=\\sum_{s=-a}^{a}\\sum_{t=-b}^{b} w(s,t)\\,f(x+s,\\,y+t)',
      rationale: `Slide the ${n}×${n} kernel over every pixel, multiply overlapping values, add them.` },
    { id: 'sub', title: `Substitute the patch at (${x}, ${y})`, latex: `g(${x},${y})=${'\\ldots'}`, substituted: `g=${shown}`,
      rationale: flip ? 'True convolution flips the kernel 180° first (identical for symmetric kernels).' : 'Correlation: kernel used as-is.' },
    { id: 'res', title: 'Result', latex: `g(${x},${y})=${f(val, 2)}`, value: val, rationale: `Kernel weights sum to ${f(kSum(k), 3)}${Math.abs(kSum(k) - 1) < 1e-6 ? ' → overall brightness preserved.' : Math.abs(kSum(k)) < 1e-6 ? ' → zero-sum: flat regions go to 0 (high-pass).' : '.'}` },
  ];
}

// ---------- lab factory ----------
interface Cfg {
  slug: string; params: ParamDef[]; presets: PresetDef[];
  kernel: (p: Record<string, any>) => Kernel;
  view?: 'compare' | 'profile' | 'gauss' | 'patch';
  explain: (p: Record<string, any>, mode: 'beginner' | 'advanced') => React.ReactNode;
  steps?: (p: Record<string, any>, im: LabStageProps['image'], k: Kernel) => Step[];
  unnormBox?: boolean;
}

const make = (c: Cfg): LabModule => ({
  slug: c.slug, params: c.params, presets: c.presets,
  Stage: ({ params: p, image, onParamChange }) => {
    const k = c.kernel(p), key = JSON.stringify(k);
    const src = useMemo(() => addNoise(image, p.noise ?? 0), [image, p.noise]);
    const out = useMemo(() => convolve(src, k, true), [src, key]);
    const { x, y } = clampP(p, image);
    const mse = useMemo(() => computeMSEandPSNR(image, out), [image, out]);
    const pt = useMemo(() => patch(src, x, y, k.length), [src, x, y, k.length]);
    const view = c.view ?? 'compare';

    const handleProbeChange = (point: { x: number; y: number }) => {
      onParamChange?.('px', point.x);
      onParamChange?.('py', point.y);
    };

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <CanvasImage
            image={src}
            title={p.noise > 0 ? 'Input f + noise' : 'Input f(x,y)'}
            probePoint={{ x, y }}
            kernelSize={k.length}
            lineProfileY={view === 'profile' ? y : undefined}
            onProbePointChange={handleProbeChange}
          />
          <CanvasImage
            image={out}
            title="Output g(x,y)"
            probePoint={{ x, y }}
            kernelSize={k.length}
            lineProfileY={view === 'profile' ? y : undefined}
            onProbePointChange={handleProbeChange}
          />
        </div>
        <div className="flex flex-wrap items-start justify-center gap-6">
          {(view === 'patch' || view === 'compare') && <Grid m={pt} title={`Neighbourhood at (${x}, ${y})`} d={0} />}
          <Grid m={k} title={`Kernel · Σw = ${f(kSum(k), 3)}`} d={k.length > 5 ? 3 : 2} />
          {view === 'gauss' && (
            <LinePlot data={Array.from({ length: 256 }, (_, i) => (gauss2((i / 255) * 10 - 5, 0, p.sigma ?? 1.2) / 0.8) * 255)}
              xLabel="Offset from center (−5 … 5)" yLabel="G(x) (scaled)" showIdentity={false} />)}
          {view === 'profile' && (
            <LinePlot data={resample(rowOf(src, y))} secondaryData={resample(rowOf(out, y))} probedX={x} xLabel={`Row y = ${y} (orange = filtered)`} yLabel="Intensity" showIdentity={false} />)}
        </div>
        <p className="text-center text-[11px] font-mono text-text-muted">MSE vs. clean image {f(mse.mse, 1)} · PSNR {Number.isFinite(mse.psnr) ? f(mse.psnr, 1) : '∞'} dB</p>
      </div>
    );
  },
  Explain: ({ mode, params }) => <>{c.explain(params, mode)}</>,
  buildSteps: (p, image) => {
    const k = c.kernel(p), { x, y } = clampP(p, image);
    return c.steps ? c.steps(p, addNoise(image, p.noise ?? 0), k) : convSteps(k, addNoise(image, p.noise ?? 0), x, y, true).map((s) => s);
  },
});

const M = (s: string) => <span className="font-mono text-accent">{"{s}"}</span>;
const sizePre = (label: string, n: number, extra: Record<string, any> = {}): PresetDef => ({ label, params: { size: n, ...extra } });

// ==========================================
// 21. Spatial Filtering
// ==========================================
export const spatialFilteringLab = make({
  slug: 'spatial-filtering', params: [P.kernel, P.px, P.py],
  presets: [{ label: 'Blur', params: { kernel: 'box3' } }, { label: 'Sharpen', params: { kernel: 'sharpen' } }, { label: 'Find edges', params: { kernel: 'edge' } }],
  kernel: (p) => KERNELS[p.kernel ?? 'box3'],
  explain: (p, mode) => (
  <DualViewExplain
    mode={mode}
    beginner={{
      concept: <><p>Think of looking through a frosty glass—the frost blends neighboring points of light. A spatial filter does this mathematically by mixing a pixel with its neighbors to compute a new color or brightness.</p></>,
      controls: <><p>The Kernel drop-down acts like a stamp: 'Box' averages things (blurring), 'Sharpen' enhances differences, and 'Edge' looks for boundaries.</p></>,
      whatToLookFor: <><p>1. Choose the 'Box 3x3' kernel to see everything soften. 2. Switch to 'Find edges' and notice how flat areas turn gray while boundaries pop out.</p></>,
      whyItMatters: <><p>Our brains do this naturally to make sense of what we see. Digital cameras use spatial filtering to reduce noise in low light or to blur the background in portrait mode.</p></>,
    }}
    advanced={{
      math: <><p>The filter performs a 2D discrete convolution (or correlation) over the image plane: <span className="font-mono text-accent">{"g(x,y) = \\sum_{s,t} w(s,t) f(x+s, y+t)"}</span>.</p></>,
      algorithm: <><p>The kernel window slides over each pixel in the image. At each position, a dot product between the kernel weights and the underlying image patch is computed.</p></>,
      parameterImpact: <><p>A kernel whose weights sum to 1 preserves the DC component (average brightness). A zero-sum kernel acts as a high-pass filter, blocking DC and highlighting high frequencies.</p></>,
      applications: <><p>Spatial filters are foundational in computer vision for noise removal (low-pass) and feature extraction like edges/corners (high-pass) in convolutional neural networks (CNNs).</p></>,
    }}
  />
),
});

// 22. Neighborhood Processing
export const neighborhoodProcessingLab = make({
  slug: 'neighborhood-processing', view: 'patch',
  params: [P.size, { id: 'op', kind: 'select', label: 'Operation', default: 'mean', options: [{ value: 'mean', label: 'Mean' }, { value: 'identity', label: 'Centre only (point op)' }] }, P.px, P.py],
  presets: [sizePre('Tight 3×3', 3), sizePre('Wide 9×9', 9)],
  kernel: (p) => (p.op === 'identity' ? KERNELS.identity : box(p.size ?? 3)),
  explain: (p, mode) => (
  <DualViewExplain
    mode={mode}
    beginner={{
      concept: <><p>Imagine trying to guess a student's grade by only looking at them, versus looking at their study group. Neighborhood processing uses the surrounding 'group' of pixels to make better decisions.</p></>,
      controls: <><p>Size controls how big the 'study group' is. A 3x3 group looks at immediate neighbors; a larger group takes a broader consensus.</p></>,
      whatToLookFor: <><p>Watch the highlighted patch as you drag the probe. See how the output pixel reacts not just to the center value, but to the surrounding block of pixels.</p></>,
      whyItMatters: <><p>This context-awareness is key for things like removing 'salt and pepper' static from old TV broadcasts or scanned documents.</p></>,
    }}
    advanced={{
      math: <><p>Neighborhood processing defines a local operator mapping a sub-image to a single output value, distinct from global or point-wise operations.</p></>,
      algorithm: <><p>For an N×N kernel, the algorithm visits each pixel, extracts an N×N spatial patch, applies the operator (e.g. mean, median), and writes the result to the output.</p></>,
      parameterImpact: <><p>As the neighborhood size N increases, the filter's spatial frequency cutoff drops. A larger window aggregates more samples, lowering variance but increasing bias (blur).</p></>,
      applications: <><p>Local operations are crucial for morphological filtering, adaptive thresholding, and spatially-varying illumination correction.</p></>,
    }}
  />
),
});

// 23. Kernel / Mask
export const kernelMaskLab = make({
  slug: 'kernel-mask', params: [P.kernel, P.px, P.py],
  presets: [{ label: 'Identity (no-op)', params: { kernel: 'identity' } }, { label: 'Emboss', params: { kernel: 'emboss' } }],
  kernel: (p) => KERNELS[p.kernel ?? 'identity'],
  explain: (p, mode) => (
  <DualViewExplain
    mode={mode}
    beginner={{
      concept: <><p>Think of a kernel like a cookie cutter moving over a sheet of dough. The shape and numbers inside the cutter dictate what happens to the dough beneath it.</p></>,
      controls: <><p>The Kernel drop-down swaps out the 'cookie cutter'. 'Identity' leaves the image untouched, while 'Emboss' creates a 3D shadow effect.</p></>,
      whatToLookFor: <><p>Look at the kernel grid numbers below the image. For 'Identity', it's just a 1 in the middle. For others, notice the negative and positive numbers working together.</p></>,
      whyItMatters: <><p>Kernels are the secret sauce in Instagram filters. By simply changing a small 3x3 grid of numbers, you can instantly change the mood of a photo.</p></>,
    }}
    advanced={{
      math: <><p>A kernel is a spatial matrix of weights representing the impulse response of a 2D linear shift-invariant (LSI) system.</p></>,
      algorithm: <><p>The matrix weights define a discrete convolution kernel. When applied via sliding window, the output is the linear combination of local neighborhood intensities.</p></>,
      parameterImpact: <><p>Kernels with negative weights on one side and positive on the other approximate discrete spatial derivatives (gradients), essential for edge detection.</p></>,
      applications: <><p>Custom kernels are used in industrial inspection to detect specific textures or defects, matching the pattern of the flaw.</p></>,
    }}
  />
),
});

// 24. Convolution / Filtering
export const convolutionLab = make({
  slug: 'convolution-filtering', view: 'patch', params: [P.kernel, { id: 'noise', kind: 'toggle', label: '', default: false, advancedOnly: true } as ParamDef, P.px, P.py].filter((q) => q.label),
  presets: [{ label: 'Box blur', params: { kernel: 'box3', px: 64, py: 64 } }, { label: 'Sharpen at an edge', params: { kernel: 'sharpen', px: 40, py: 40 } }],
  kernel: (p) => KERNELS[p.kernel ?? 'box3'],
  explain: (p, mode) => (
  <DualViewExplain
    mode={mode}
    beginner={{
      concept: <><p>It's like calculating an average score for a team, where some players are weighted more heavily than others. We multiply each neighbor by a weight, then add them up.</p></>,
      controls: <><p>Move the Probe X and Y to see the math happen in real-time on different parts of the image.</p></>,
      whatToLookFor: <><p>Look at the patch values and the kernel values. Mentally multiply overlapping numbers and sum them up—the result becomes the new center pixel.</p></>,
      whyItMatters: <><p>This exact mathematical sliding operation powers almost all modern AI image recognition, helping cars see lanes and phones recognize faces.</p></>,
    }}
    advanced={{
      math: <><p>The continuous 2D convolution integral <span className="font-mono text-accent">{"g(x,y) = f(x,y) * h(x,y)"}</span> becomes a discrete double summation over the kernel domain.</p></>,
      algorithm: <><p>Strictly, convolution requires mirroring the kernel horizontally and vertically before sliding. If the kernel is symmetric (like box or Gaussian), convolution and correlation are identical.</p></>,
      parameterImpact: <><p>Boundary handling is critical: at the image edges, the kernel extends beyond the data. Common solutions include zero-padding, mirror reflection, or nearest-neighbor replication.</p></>,
      applications: <><p>Hardware accelerators (GPUs/TPUs) are optimized specifically for massively parallel 2D discrete convolutions in deep learning pipelines.</p></>,
    }}
  />
),
});

// 25. Box Filter
export const boxFilterLab = make({
  slug: 'box-filter', params: [P.size, { id: 'norm', kind: 'toggle', label: 'Normalize (÷ n²)', default: true, advancedOnly: true }, P.px, P.py],
  presets: [sizePre('3×3', 3), sizePre('7×7', 7), sizePre('11×11', 11)],
  kernel: (p) => { const n = p.size ?? 3; return p.norm === false ? box(n).map((r) => r.map(() => 1)) : box(n); },
  explain: (p, mode) => (
  <DualViewExplain
    mode={mode}
    beginner={{
      concept: <><p>Imagine looking at a mosaic up close. If you squint, the tiles blend together equally. A box filter replaces every pixel with a simple, equal average of its neighborhood.</p></>,
      controls: <><p>The Kernel size determines how many tiles you blur together. A larger size means a wider squint, blurring more.</p></>,
      whatToLookFor: <><p>Increase the Kernel size from 3x3 to 11x11. Notice how the image becomes blurrier, but also watch for a subtle 'blocky' or square artifact in the blur.</p></>,
      whyItMatters: <><p>Box filters are quick and easy to calculate, often used in real-time video games for fast depth-of-field or motion blur effects.</p></>,
    }}
    advanced={{
      math: <><p>The box filter kernel is a constant matrix: <span className="font-mono text-accent">{"K = (1/N^2) \\cdot 1_{N \\times N}"}</span>, acting as a spatial moving average.</p></>,
      algorithm: <><p>Naively, it takes O(N^2) operations per pixel. However, it can be computed in O(1) time per pixel using an Integral Image (Summed Area Table), independent of N.</p></>,
      parameterImpact: <><p>In the frequency domain, the box filter's Fourier transform is a 2D Sinc function. This causes 'ringing' artifacts because it doesn't smoothly attenuate high frequencies.</p></>,
      applications: <><p>Used in Viola-Jones face detection and fast shadow mapping because of its O(1) integral image implementation.</p></>,
    }}
  />
),
  steps: (p, src, k) => { const n = k.length, x = Math.min(src.w - 3, p.px ?? 64), y = Math.min(src.h - 3, p.py ?? 64);
    const v = patch(src, x, y, n).flat(); const s = v.reduce((a, b) => a + b, 0);
    return [{ id: 'k', title: 'Box kernel', latex: `K=\\frac{1}{${n * n}}\\begin{bmatrix}1&\\cdots&1\\\\ \\vdots&\\ddots&\\vdots\\\\1&\\cdots&1\\end{bmatrix}`, rationale: `All ${n * n} weights equal.` },
      { id: 's', title: 'Sum the window', latex: `\\sum f = ${s}`, value: s },
      { id: 'g', title: 'Divide by n²', latex: `g(${x},${y})=\\frac{${s}}{${n * n}}=${f(s / (n * n), 2)}`, value: s / (n * n), rationale: 'Just the neighbourhood average.' }]; },
});

// 26. Mean / Averaging Filter
export const meanFilterLab = make({
  slug: 'mean-filter', view: 'profile', params: [P.size, P.noise, P.px, P.py],
  presets: [{ label: 'Noisy → 3×3', params: { size: 3, noise: 25, px: 64, py: 64 } }, { label: 'Very noisy → 7×7', params: { size: 7, noise: 45, px: 64, py: 64 } }],
  kernel: (p) => box(p.size ?? 3),
  explain: (p, mode) => (
  <DualViewExplain
    mode={mode}
    beginner={{
      concept: <><p>When a radio station has static, you might try to guess the real song by listening to a few seconds of it. The mean filter smooths out 'static' (noise) by averaging out the random spikes.</p></>,
      controls: <><p>Noise level adds random 'static' to the image. Kernel size controls how aggressively the filter averages out that static.</p></>,
      whatToLookFor: <><p>Add noise, then increase the kernel size. The static disappears, but unfortunately, the sharp edges of the image also get smeared out.</p></>,
      whyItMatters: <><p>This is the most basic form of noise reduction used in cheap digital cameras when shooting in the dark.</p></>,
    }}
    advanced={{
      math: <><p>The mean filter is a linear unbiased estimator. By averaging N^2 independent noise samples, the noise variance is reduced by a factor of N^2: <span className="font-mono text-accent">{"\\sigma_{out}^2 = \\sigma_{in}^2 / N^2"}</span>.</p></>,
      algorithm: <><p>It assumes the underlying signal is locally constant. Where the signal changes rapidly (edges), this assumption fails, introducing significant bias (blur).</p></>,
      parameterImpact: <><p>The trade-off between variance reduction (noise suppression) and bias (edge blurring) is fundamental to all linear low-pass filters.</p></>,
      applications: <><p>Applied in synthetic aperture radar (SAR) and ultrasound imaging to reduce speckle noise, though more advanced edge-preserving filters are often preferred.</p></>,
    }}
  />
),
  steps: (p, src, k) => { const n = k.length, x = Math.min(src.w - 3, p.px ?? 64), y = Math.min(src.h - 3, p.py ?? 64);
    const v = patch(src, x, y, n).flat(); const m = v.reduce((a, b) => a + b, 0) / v.length;
    return [{ id: 'm', title: 'Mean of the window', latex: `g(x,y)=\\frac{1}{n^2}\\sum f`, substituted: `g=\\frac{${v.reduce((a, b) => a + b, 0)}}{${n * n}}=${f(m, 2)}`, value: m },
      { id: 'v', title: 'Noise variance reduction', latex: `\\sigma_g^2=\\frac{\\sigma_n^2}{n^2}`, substituted: `\\frac{${p.noise ?? 0}^2}{${n * n}}=${f(((p.noise ?? 0) ** 2) / (n * n), 1)}`, rationale: 'Assumes independent noise per pixel.' }]; },
});

// 27. Smoothing
export const smoothingLab = make({
  slug: 'smoothing', view: 'profile',
  params: [{ id: 'type', kind: 'select', label: 'Smoother', default: 'gauss', options: [{ value: 'box', label: 'Box' }, { value: 'gauss', label: 'Gaussian' }] }, P.size, P.sigma, P.noise, P.px, P.py],
  presets: [{ label: 'Denoise (Gaussian)', params: { type: 'gauss', size: 7, sigma: 1.5, noise: 30, px: 64, py: 64 } }, { label: 'Denoise (Box)', params: { type: 'box', size: 7, noise: 30, px: 64, py: 64 } }],
  kernel: (p) => (p.type === 'box' ? box(p.size ?? 3) : gaussK(p.size ?? 3, p.sigma ?? 1.2)),
  explain: (p, mode) => (
  <DualViewExplain
    mode={mode}
    beginner={{
      concept: <><p>Think of smoothing like sanding down rough wood. You want to remove the splinters (noise) without destroying the carved details (edges).</p></>,
      controls: <><p>The Smoother type lets you switch between 'Box' (a flat sanding block) and 'Gaussian' (a soft, flexible sponge).</p></>,
      whatToLookFor: <><p>Toggle between Box and Gaussian smoothing. Notice how the Gaussian blur looks more natural and less 'blocky', especially around sharp edges.</p></>,
      whyItMatters: <><p>Gaussian smoothing is universally preferred in photo editing software (like Photoshop's Gaussian Blur) because it mimics how the human eye naturally perceives out-of-focus objects.</p></>,
    }}
    advanced={{
      math: <><p>Smoothing filters attenuate high spatial frequencies. The Box filter is a hard cutoff in space (Sinc in frequency), while the Gaussian is a Gaussian in both domains.</p></>,
      algorithm: <><p>Because the Fourier transform of a Gaussian is another Gaussian, it has no side-lobes in the frequency domain, completely avoiding the ringing artifacts (Gibbs phenomenon) typical of Box filters.</p></>,
      parameterImpact: <><p>Increasing the spatial variance <span className="font-mono text-accent">{"\\sigma^2"}</span> shrinks the frequency domain variance (bandwidth), lowering the cutoff frequency of the low-pass filter.</p></>,
      applications: <><p>Essential pre-processing step in Canny edge detection and scale-space representation for SIFT/SURF feature matching.</p></>,
    }}
  />
),
});

// 28. Gaussian Filtering
export const gaussianFilteringLab = make({
  slug: 'gaussian-filtering', view: 'gauss', params: [P.size, P.sigma, P.noise, P.px, P.py],
  presets: [{ label: 'Light (σ=0.8)', params: { size: 5, sigma: 0.8, px: 64, py: 64 } }, { label: 'Strong (σ=3)', params: { size: 11, sigma: 3, px: 64, py: 64 } }],
  kernel: (p) => gaussK(p.size ?? 3, p.sigma ?? 1.2),
  explain: (p, mode) => (
  <DualViewExplain
    mode={mode}
    beginner={{
      concept: <><p>Imagine dropping a pebble in a pond. The ripples are strongest in the middle and fade out. A Gaussian filter weights the center pixel the most and fades out smoothly in a circle.</p></>,
      controls: <><p>Std. deviation (σ) controls the size of the 'pebble'. A larger σ means the ripples travel further, creating a wider, softer blur.</p></>,
      whatToLookFor: <><p>Watch the kernel grid below as you increase σ. See how the numbers spread out from the center, creating a gentle gradient instead of a harsh cliff.</p></>,
      whyItMatters: <><p>This circular, smooth drop-off makes Gaussian blur perfect for rendering realistic shadows and glowing light effects in 3D animation.</p></>,
    }}
    advanced={{
      math: <><p>The continuous 2D Gaussian kernel is: <span className="font-mono text-accent">{"G(x,y) = (1 / 2\\pi\\sigma^2) e^{{-(x^2+y^2)/(2\\sigma^2)}}"}</span>. It is rotationally symmetric (isotropic).</p></>,
      algorithm: <><p>The kernel must be discretized and truncated for a digital image. The size N is typically chosen as odd, with N ≥ 6σ to capture 99.7% of the curve's energy and avoid truncation artifacts.</p></>,
      parameterImpact: <><p>After sampling the continuous function, the discrete kernel weights must be explicitly normalized so they sum exactly to 1.0, preserving DC gain.</p></>,
      applications: <><p>Used extensively in creating image pyramids (Gaussian/Laplacian pyramids) for multi-scale analysis and computer graphics mipmapping.</p></>,
    }}
  />
),
});

// 29. Gaussian Function
export const gaussianFunctionLab = make({
  slug: 'gaussian-function', view: 'gauss', params: [P.sigma, P.size, P.px, P.py].map((q) => ({ ...q })),
  presets: [{ label: 'Narrow σ=0.7', params: { sigma: 0.7, size: 7, px: 64, py: 64 } }, { label: 'Wide σ=3', params: { sigma: 3, size: 11, px: 64, py: 64 } }],
  kernel: (p) => gaussK(p.size ?? 7, p.sigma ?? 1.2),
  explain: (p, mode) => (
  <DualViewExplain
    mode={mode}
    beginner={{
      concept: <><p>This is the famous 'bell curve'. It shows exactly how the blur 'fades out'. A tall, skinny bell means a tight blur; a wide, flat bell means a broad blur.</p></>,
      controls: <><p>Change the Std. deviation (σ). Watch the plot of the curve below physically stretch out or squeeze together.</p></>,
      whatToLookFor: <><p>Notice that no matter how wide or skinny the curve gets, it always smoothly touches zero at the edges—no sudden jumps.</p></>,
      whyItMatters: <><p>The bell curve isn't just for images; it describes everything from heights in a population to errors in a physics experiment. It's nature's favorite way to spread things out.</p></>,
    }}
    advanced={{
      math: <><p>The Gaussian function represents the probability density function (PDF) of a normally distributed random variable. In filtering, it acts as the impulse response.</p></>,
      algorithm: <><p>The Full-Width at Half-Maximum (FWHM) relates to σ by <span className="font-mono text-accent">{"FWHM \\approx 2.355\\sigma"}</span>. This is often used to characterize the resolution limit of an optical system.</p></>,
      parameterImpact: <><p>The derivative of a Gaussian is used in edge detection (e.g., Canny). It acts as an optimal smoothing-derivative operator, regularizing the ill-posed problem of numerical differentiation.</p></>,
      applications: <><p>Fundamental in optics representing the Point Spread Function (PSF) of a defocused lens, and in heat equations representing diffusion over time.</p></>,
    }}
  />
),
  steps: (p) => { const s = p.sigma ?? 1.2, c = 1 / (2 * Math.PI * s * s);
    return [{ id: 'g', title: 'Gaussian function', latex: 'G(x,y)=\\frac{1}{2\\pi\\sigma^2}\\,e^{-\\frac{x^2+y^2}{2\\sigma^2}}' },
      { id: 'c', title: 'Peak value at (0,0)', latex: `G(0,0)=\\frac{1}{2\\pi\\sigma^2}`, substituted: `\\frac{1}{2\\pi(${f(s)})^2}=${f(c, 4)}`, value: c, rationale: 'Shrinking σ raises the peak.' },
      { id: 'h', title: 'Half-width (FWHM)', latex: `\\mathrm{FWHM}=2\\sqrt{2\\ln 2}\\,\\sigma`, substituted: `=${f(2.3548 * s, 2)}\\ \\text{px}`, value: 2.3548 * s },
      { id: 'd', title: 'Derivative (slope of the bell)', latex: `\\frac{dG}{dx}=-\\frac{x}{\\sigma^2}G(x)`, rationale: 'Steepest at x = ±σ; zero at the peak.' }]; },
});

// 30. Gaussian Weighting
export const gaussianWeightingLab = make({
  slug: 'gaussian-weighting', view: 'gauss',
  params: [P.sigma, P.size, { id: 'dx', kind: 'slider', label: 'Neighbour offset Δx', min: -5, max: 5, step: 1, default: 1 }, { id: 'dy', kind: 'slider', label: 'Neighbour offset Δy', min: -5, max: 5, step: 1, default: 1 }, P.px, P.py],
  presets: [{ label: 'Adjacent (1,0)', params: { dx: 1, dy: 0, px: 64, py: 64 } }, { label: 'Far corner (4,4)', params: { dx: 4, dy: 4, px: 64, py: 64 } }],
  kernel: (p) => gaussK(p.size ?? 7, p.sigma ?? 1.2),
  explain: (p, mode) => (
  <DualViewExplain
    mode={mode}
    beginner={{
      concept: <><p>Think of this as calculating the 'friendship strength' between pixels. The further away a neighbor is (measured by Δx and Δy), the weaker the friendship (weight).</p></>,
      controls: <><p>Use the Δx and Δy sliders to pick a specific neighbor relative to the center. See how its weight drops as you move further away.</p></>,
      whatToLookFor: <><p>Set Δx=1 and Δy=0, then set Δx=0 and Δy=1. Notice the weight is identical because the distance is the same—it's a perfect circle!</p></>,
      whyItMatters: <><p>This distance-based weighting is exactly how GPS systems calculate your likely position by blending signals from multiple satellites based on how far away they are.</p></>,
    }}
    advanced={{
      math: <><p>The unnormalized weight for a pixel at offset (Δx, Δy) is given by <span className="font-mono text-accent">{"w = \\exp(-(\\Delta x^2 + \\Delta y^2) / 2\\sigma^2)"}</span>.</p></>,
      algorithm: <><p>Because <span className="font-mono text-accent">{"e^{{A+B}} = e^A \\cdot e^B"}</span>, the 2D Gaussian can be factored: <span className="font-mono text-accent">{"\\exp(-x^2/2\\sigma^2) \\cdot \\exp(-y^2/2\\sigma^2)"}</span>. This separability is its most crucial computational property.</p></>,
      parameterImpact: <><p>The Euclidean distance metric squared <span className="font-mono text-accent">{"d^2 = \\Delta x^2 + \\Delta y^2"}</span> ensures the filter is perfectly isotropic (rotationally invariant) in the continuous domain.</p></>,
      applications: <><p>Understanding this weighting is key to extending the concept to non-spatial dimensions, like the range (intensity) kernel used in bilateral filtering.</p></>,
    }}
  />
),
  steps: (p, _s, k) => { const s = p.sigma ?? 1.2, dx = p.dx ?? 1, dy = p.dy ?? 1, d2 = dx * dx + dy * dy, raw = Math.exp(-d2 / (2 * s * s));
    const c = (k.length - 1) / 2, w = k[Math.max(0, Math.min(k.length - 1, c + dy))]?.[Math.max(0, Math.min(k.length - 1, c + dx))] ?? 0;
    return [{ id: 'd', title: 'Distance²', latex: `d^2=\\Delta x^2+\\Delta y^2`, substituted: `${dx}^2+${dy}^2=${d2}`, value: d2 },
      { id: 'r', title: 'Unnormalized weight', latex: `w=e^{-d^2/2\\sigma^2}`, substituted: `e^{-${d2}/(2\\cdot${f(s)}^2)}=${f(raw, 4)}`, value: raw },
      { id: 'n', title: 'Normalized weight (kernel entry)', latex: `w_{norm}=\\frac{w}{\\sum w}`, substituted: `=${f(w, 4)}`, value: w, rationale: 'Divides by the sum over the whole n×n window.' }]; },
});

// 31. Gaussian Smoothing
export const gaussianSmoothingLab = make({
  slug: 'gaussian-smoothing', view: 'profile', params: [P.sigma, P.size, P.noise, P.px, P.py],
  presets: [{ label: 'Denoise σ=1.5', params: { sigma: 1.5, size: 9, noise: 30, px: 64, py: 64 } }, { label: 'Heavy σ=3.5', params: { sigma: 3.5, size: 11, noise: 45, px: 64, py: 64 } }],
  kernel: (p) => gaussK(p.size ?? 9, p.sigma ?? 1.5),
  explain: (p, mode) => (
  <DualViewExplain
    mode={mode}
    beginner={{
      concept: <><p>This is where it all comes together to clean up an image. We apply the bell-curve weights to every single pixel in the image to wash away the noise gently.</p></>,
      controls: <><p>Watch the 'MSE' and 'PSNR' numbers at the bottom. Try to find the 'sweet spot' for σ that gives the highest PSNR (the cleanest image).</p></>,
      whatToLookFor: <><p>Look at the line profile below. See how the noisy blue zig-zags are ironed out into a smooth orange line.</p></>,
      whyItMatters: <><p>Astronomers use this exact technique to clean up grainy photos of distant galaxies, separating the real stars from random camera sensor noise.</p></>,
    }}
    advanced={{
      math: <><p>Because the 2D Gaussian kernel is separable, <span className="font-mono text-accent">{"G(x,y) = g(x)g(y)"}</span>, the 2D convolution can be implemented as two sequential 1D convolutions.</p></>,
      algorithm: <><p>A direct 2D convolution with an N×N kernel requires O(N^2) multiplications per pixel. The separable 1D approach requires O(2N). For a 15×15 kernel, this reduces multiplications from 225 to 30.</p></>,
      parameterImpact: <><p>The cascading property states that applying a Gaussian with σ_1 then σ_2 is mathematically equivalent to a single Gaussian with <span className="font-mono text-accent">{"\\sigma^2 = \\sigma_1^2 + \\sigma_2^2"}</span>.</p></>,
      applications: <><p>Crucial optimization for real-time video processing pipelines on mobile devices where computing power and battery are strictly limited.</p></>,
    }}
  />
),
  steps: (p) => { const s = p.sigma ?? 1.5, n = p.size ?? 9;
    return [{ id: 's', title: 'Separable form', latex: `G(x,y)=g(x)\\,g(y),\\quad g(t)=\\frac{1}{\\sqrt{2\\pi}\\sigma}e^{-t^2/2\\sigma^2}`, rationale: `One ${n}×${n} pass = two 1-D passes: ${n * n} → ${2 * n} multiplies per pixel.`, value: 2 * n },
      { id: 'w', title: 'Recommended kernel width', latex: `n\\ge 6\\sigma`, substituted: `6\\cdot${f(s)}=${f(6 * s, 1)}\\ \\Rightarrow\\ n=${n}${n >= 6 * s ? '\\ \\checkmark' : '\\ \\text{(truncated!)}'}`, value: 6 * s }]; },
});

// 32. Edge Blurring
export const edgeBlurringLab = make({
  slug: 'edge-blurring', view: 'profile',
  params: [{ id: 'type', kind: 'select', label: 'Filter', default: 'gauss', options: [{ value: 'box', label: 'Box' }, { value: 'gauss', label: 'Gaussian' }] }, P.size, P.sigma, P.px, P.py],
  presets: [{ label: 'Mild', params: { size: 5, sigma: 1, px: 64, py: 64 } }, { label: 'Heavy', params: { size: 11, sigma: 3.5, px: 64, py: 64 } }],
  kernel: (p) => (p.type === 'box' ? box(p.size ?? 5) : gaussK(p.size ?? 5, p.sigma ?? 1)),
  explain: (p, mode) => (
  <DualViewExplain
    mode={mode}
    beginner={{
      concept: <><p>Imagine trying to wipe away a small smudge, but you end up smearing the ink across the whole page. That's the main problem with basic smoothing: it destroys sharp edges.</p></>,
      controls: <><p>Move the probe exactly onto the boundary between the dark and light shapes. Increase the blur and watch the sharp step turn into a long, slow slope.</p></>,
      whatToLookFor: <><p>Check the 'Edge rise distance' step below. A higher number means the edge has been smeared over a wider physical area on the screen.</p></>,
      whyItMatters: <><p>This is why cheap photo filters make faces look like plastic. They blur the skin to remove blemishes, but accidentally blur away the sharp details of the eyes and lips.</p></>,
    }}
    advanced={{
      math: <><p>Linear shift-invariant (LSI) filters suffer from an unavoidable trade-off between noise variance reduction and structural bias (edge blurring).</p></>,
      algorithm: <><p>The step response of a Gaussian filter is the error function (erf). The 10%-90% rise time of this step response increases linearly with σ, mathematically proving the edge degradation.</p></>,
      parameterImpact: <><p>Because the kernel weights depend solely on spatial distance <span className="font-mono text-accent">{"w(\\Delta x, \\Delta y)"}</span>, the filter cannot 'shut off' when it crosses an intensity discontinuity.</p></>,
      applications: <><p>This limitation directly motivates non-linear, edge-preserving filters like the Bilateral filter, Non-local Means, or anisotropic diffusion in medical imaging (MRI/CT) where boundaries are critical.</p></>,
    }}
  />
),
  steps: (p, src, k) => { const y = Math.min(src.h - 3, p.py ?? 64), a = rowOf(src, y), b = rowOf(convolve(src, k, true), y);
    const wa = edgeWidth(a), wb = edgeWidth(b);
    return [{ id: 'a', title: 'Edge rise distance before', latex: `\\Delta_{10\\text{–}90}=${wa}\\ \\text{px}`, value: wa, rationale: 'Pixels needed to go from 10% to 90% of the step.' },
      { id: 'b', title: 'Edge rise distance after', latex: `\\Delta_{10\\text{–}90}=${wb}\\ \\text{px}`, value: wb, rationale: wb > wa ? `The edge is ${wb - wa} px softer.` : 'No visible blur on this row.' },
      { id: 'c', title: 'Why it happens', latex: `g=\\sum w_{ij}f_j,\\ \\ w_{ij}=w(\\lVert i-j\\rVert)`, rationale: 'Weights ignore intensity, so bright and dark pixels are mixed alike.' }]; },
});
