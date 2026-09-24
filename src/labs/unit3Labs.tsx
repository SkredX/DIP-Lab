import React, { useMemo } from 'react';
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
  explain: (p: Record<string, any>, adv: boolean) => React.ReactNode;
  steps?: (p: Record<string, any>, im: LabStageProps['image'], k: Kernel) => Step[];
  unnormBox?: boolean;
}

const make = (c: Cfg): LabModule => ({
  slug: c.slug, params: c.params, presets: c.presets,
  Stage: ({ params: p, image }) => {
    const k = c.kernel(p), key = JSON.stringify(k);
    const src = useMemo(() => addNoise(image, p.noise ?? 0), [image, p.noise]);
    const out = useMemo(() => convolve(src, k, true), [src, key]);
    const { x, y } = clampP(p, image);
    const mse = useMemo(() => computeMSEandPSNR(image, out), [image, out]);
    const pt = useMemo(() => patch(src, x, y, k.length), [src, x, y, k.length]);
    const view = c.view ?? 'compare';
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <CanvasImage image={src} title={p.noise > 0 ? 'Input f + noise' : 'Input f(x,y)'} />
          <CanvasImage image={out} title="Output g(x,y)" />
        </div>
        <div className="flex flex-wrap items-start justify-center gap-6">
          {(view === 'patch' || view === 'compare') && <Grid m={pt} title={`Neighbourhood at (${x}, ${y})`} d={0} />}
          <Grid m={k} title={`Kernel · Σw = ${f(kSum(k), 3)}`} d={k.length > 5 ? 3 : 2} />
          {view === 'gauss' && (
            <LinePlot data={Array.from({ length: 256 }, (_, i) => (gauss2((i / 255) * 10 - 5, 0, p.sigma ?? 1.2) / 0.8) * 255)}
              xLabel="Offset from center (−5 … 5)" yLabel="G(x) (scaled)" showIdentity={false} />)}
          {view === 'profile' && (
            <LinePlot data={resample(rowOf(src, y))} secondaryData={resample(rowOf(out, y))} xLabel={`Row y = ${y} (orange = filtered)`} yLabel="Intensity" showIdentity={false} />)}
        </div>
        <p className="text-center text-[11px] font-mono text-text-muted">MSE vs. clean image {f(mse.mse, 1)} · PSNR {Number.isFinite(mse.psnr) ? f(mse.psnr, 1) : '∞'} dB</p>
      </div>
    );
  },
  Explain: ({ mode, params }) => <>{c.explain(params, mode === 'advanced')}</>,
  buildSteps: (p, image) => {
    const k = c.kernel(p), { x, y } = clampP(p, image);
    return c.steps ? c.steps(p, addNoise(image, p.noise ?? 0), k) : convSteps(k, addNoise(image, p.noise ?? 0), x, y, true).map((s) => s);
  },
});

const M = (s: string) => <span className="font-mono text-accent">{s}</span>;
const sizePre = (label: string, n: number, extra: Record<string, any> = {}): PresetDef => ({ label, params: { size: n, ...extra } });

// ==========================================
// 21. Spatial Filtering
// ==========================================
export const spatialFilteringLab = make({
  slug: 'spatial-filtering', params: [P.kernel, P.px, P.py],
  presets: [{ label: 'Blur', params: { kernel: 'box3' } }, { label: 'Sharpen', params: { kernel: 'sharpen' } }, { label: 'Find edges', params: { kernel: 'edge' } }],
  kernel: (p) => KERNELS[p.kernel ?? 'box3'],
  explain: (p, adv) => (<><p>A <strong>spatial filter</strong> computes each output pixel from the input pixel <em>and its neighbours</em>. The kernel decides what "neighbours" contribute.</p>
    {adv && <p>{M('g(x,y) = Σ w(s,t) f(x+s, y+t)')} — linear, shift-invariant.</p>}</>),
});

// 22. Neighborhood Processing
export const neighborhoodProcessingLab = make({
  slug: 'neighborhood-processing', view: 'patch',
  params: [P.size, { id: 'op', kind: 'select', label: 'Operation', default: 'mean', options: [{ value: 'mean', label: 'Mean' }, { value: 'identity', label: 'Centre only (point op)' }] }, P.px, P.py],
  presets: [sizePre('Tight 3×3', 3), sizePre('Wide 9×9', 9)],
  kernel: (p) => (p.op === 'identity' ? KERNELS.identity : box(p.size ?? 3)),
  explain: (p, adv) => (<><p>Point operations (gamma, histogram) look at one pixel. <strong>Neighbourhood processing</strong> looks at an {p.size ?? 3}×{p.size ?? 3} window around it — so context matters.</p>
    {adv && <p>Same intensity, different neighbours ⇒ different output. That is exactly what global histogram methods cannot do.</p>}</>),
});

// 23. Kernel / Mask
export const kernelMaskLab = make({
  slug: 'kernel-mask', params: [P.kernel, P.px, P.py],
  presets: [{ label: 'Identity (no-op)', params: { kernel: 'identity' } }, { label: 'Emboss', params: { kernel: 'emboss' } }],
  kernel: (p) => KERNELS[p.kernel ?? 'identity'],
  explain: (p, adv) => (<><p>A <strong>kernel</strong> (mask) is just a small matrix of weights. Change the numbers, change the effect.</p>
    {adv && <p>Weights summing to 1 preserve brightness; summing to 0 give a high-pass filter (flat areas → 0, shown on mid-gray).</p>}</>),
});

// 24. Convolution / Filtering
export const convolutionLab = make({
  slug: 'convolution-filtering', view: 'patch', params: [P.kernel, { id: 'noise', kind: 'toggle', label: '', default: false, advancedOnly: true } as ParamDef, P.px, P.py].filter((q) => q.label),
  presets: [{ label: 'Box blur', params: { kernel: 'box3', px: 64, py: 64 } }, { label: 'Sharpen at an edge', params: { kernel: 'sharpen', px: 40, py: 40 } }],
  kernel: (p) => KERNELS[p.kernel ?? 'box3'],
  explain: (p, adv) => (<><p>Drag the probe: at each spot, <strong>multiply</strong> kernel and neighbourhood cell by cell, then <strong>add</strong>.</p>
    {adv && <p>True convolution rotates the kernel 180°; correlation doesn't. Symmetric kernels (box, Gaussian) give identical results.</p>}</>),
});

// 25. Box Filter
export const boxFilterLab = make({
  slug: 'box-filter', params: [P.size, { id: 'norm', kind: 'toggle', label: 'Normalize (÷ n²)', default: true, advancedOnly: true }, P.px, P.py],
  presets: [sizePre('3×3', 3), sizePre('7×7', 7), sizePre('11×11', 11)],
  kernel: (p) => { const n = p.size ?? 3; return p.norm === false ? box(n).map((r) => r.map(() => 1)) : box(n); },
  explain: (p, adv) => (<><p>The <strong>box filter</strong> gives every neighbour the <em>same</em> weight. Bigger box → stronger blur.</p>
    {adv && <p>{M('K = (1/n²)·1')}. Without the 1/n² factor the image saturates, because Σw = n² instead of 1.</p>}</>),
  steps: (p, src, k) => { const n = k.length, x = Math.min(src.w - 3, p.px ?? 64), y = Math.min(src.h - 3, p.py ?? 64);
    const v = patch(src, x, y, n).flat(); const s = v.reduce((a, b) => a + b, 0);
    return [{ id: 'k', title: 'Box kernel', latex: `K=\\frac{1}{${n * n}}\\begin{bmatrix}1&\\cdots&1\\\\ \\vdots&\\ddots&\\vdots\\\\1&\\cdots&1\\end{bmatrix}`, rationale: `All ${n * n} weights equal.` },
      { id: 's', title: 'Sum the window', latex: `\\sum f = ${s}`, value: s },
      { id: 'g', title: 'Divide by n²', latex: `g(${x},${y})=\\frac{${s}}{${n * n}}=${f(s / (n * n), 2)}`, value: s / (n * n), rationale: 'Just the neighbourhood average.' }]; },
});

// 26. Mean / Averaging Filter
export const meanFilterLab = make({
  slug: 'mean-filter', view: 'profile', params: [P.size, P.noise, P.py],
  presets: [{ label: 'Noisy → 3×3', params: { size: 3, noise: 25 } }, { label: 'Very noisy → 7×7', params: { size: 7, noise: 45 } }],
  kernel: (p) => box(p.size ?? 3),
  explain: (p, adv) => (<><p>The <strong>mean (averaging) filter</strong> replaces each pixel by its neighbourhood average. Random noise cancels out — watch PSNR climb.</p>
    {adv && <p>Averaging N independent samples cuts noise variance by N: {M('σ² → σ²/n²')}. The price: fine detail blurs too.</p>}</>),
  steps: (p, src, k) => { const n = k.length, x = Math.min(src.w - 3, p.px ?? 64), y = Math.min(src.h - 3, p.py ?? 64);
    const v = patch(src, x, y, n).flat(); const m = v.reduce((a, b) => a + b, 0) / v.length;
    return [{ id: 'm', title: 'Mean of the window', latex: `g(x,y)=\\frac{1}{n^2}\\sum f`, substituted: `g=\\frac{${v.reduce((a, b) => a + b, 0)}}{${n * n}}=${f(m, 2)}`, value: m },
      { id: 'v', title: 'Noise variance reduction', latex: `\\sigma_g^2=\\frac{\\sigma_n^2}{n^2}`, substituted: `\\frac{${p.noise ?? 0}^2}{${n * n}}=${f(((p.noise ?? 0) ** 2) / (n * n), 1)}`, rationale: 'Assumes independent noise per pixel.' }]; },
});

// 27. Smoothing
export const smoothingLab = make({
  slug: 'smoothing', view: 'profile',
  params: [{ id: 'type', kind: 'select', label: 'Smoother', default: 'gauss', options: [{ value: 'box', label: 'Box' }, { value: 'gauss', label: 'Gaussian' }] }, P.size, P.sigma, P.noise, P.py],
  presets: [{ label: 'Denoise (Gaussian)', params: { type: 'gauss', size: 7, sigma: 1.5, noise: 30 } }, { label: 'Denoise (Box)', params: { type: 'box', size: 7, noise: 30 } }],
  kernel: (p) => (p.type === 'box' ? box(p.size ?? 3) : gaussK(p.size ?? 3, p.sigma ?? 1.2)),
  explain: (p, adv) => (<><p><strong>Smoothing</strong> = low-pass filtering: suppress rapid intensity changes (noise) and keep slow ones. Compare box vs. Gaussian on the same noise.</p>
    {adv && <p>Every smoother is a low-pass; the trade-off is noise reduction vs. blur. Check the profile plot near an edge.</p>}</>),
});

// 28. Gaussian Filtering
export const gaussianFilteringLab = make({
  slug: 'gaussian-filtering', view: 'gauss', params: [P.size, P.sigma, P.noise, P.px, P.py],
  presets: [{ label: 'Light (σ=0.8)', params: { size: 5, sigma: 0.8 } }, { label: 'Strong (σ=3)', params: { size: 11, sigma: 3 } }],
  kernel: (p) => gaussK(p.size ?? 3, p.sigma ?? 1.2),
  explain: (p, adv) => (<><p>A <strong>Gaussian filter</strong> weights neighbours by distance — closer pixels matter more. σ controls how far the influence reaches.</p>
    {adv && <p>Make the kernel at least ≈ 6σ wide, else it truncates the bell: {M('n ≥ 6σ')}.</p>}</>),
});

// 29. Gaussian Function
export const gaussianFunctionLab = make({
  slug: 'gaussian-function', view: 'gauss', params: [P.sigma, P.size, P.px, P.py].map((q) => ({ ...q })),
  presets: [{ label: 'Narrow σ=0.7', params: { sigma: 0.7, size: 7 } }, { label: 'Wide σ=3', params: { sigma: 3, size: 11 } }],
  kernel: (p) => gaussK(p.size ?? 7, p.sigma ?? 1.2),
  explain: (p, adv) => (<><p>The bell curve behind the filter. Small σ → tall, narrow; large σ → low, wide. Area stays 1.</p>
    {adv && <p>{M('G(x,y) = (1/2πσ²) e^{−(x²+y²)/2σ²}')}</p>}</>),
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
  presets: [{ label: 'Adjacent (1,0)', params: { dx: 1, dy: 0 } }, { label: 'Far corner (4,4)', params: { dx: 4, dy: 4 } }],
  kernel: (p) => gaussK(p.size ?? 7, p.sigma ?? 1.2),
  explain: (p, adv) => (<><p>Pick a neighbour with Δx, Δy: <strong>greater distance ⇒ smaller weight</strong>. The centre pixel always has the largest vote.</p>
    {adv && <p>Weights are normalized so they sum to 1, so brightness is preserved.</p>}</>),
  steps: (p, _s, k) => { const s = p.sigma ?? 1.2, dx = p.dx ?? 1, dy = p.dy ?? 1, d2 = dx * dx + dy * dy, raw = Math.exp(-d2 / (2 * s * s));
    const c = (k.length - 1) / 2, w = k[Math.max(0, Math.min(k.length - 1, c + dy))]?.[Math.max(0, Math.min(k.length - 1, c + dx))] ?? 0;
    return [{ id: 'd', title: 'Distance²', latex: `d^2=\\Delta x^2+\\Delta y^2`, substituted: `${dx}^2+${dy}^2=${d2}`, value: d2 },
      { id: 'r', title: 'Unnormalized weight', latex: `w=e^{-d^2/2\\sigma^2}`, substituted: `e^{-${d2}/(2\\cdot${f(s)}^2)}=${f(raw, 4)}`, value: raw },
      { id: 'n', title: 'Normalized weight (kernel entry)', latex: `w_{norm}=\\frac{w}{\\sum w}`, substituted: `=${f(w, 4)}`, value: w, rationale: 'Divides by the sum over the whole n×n window.' }]; },
});

// 31. Gaussian Smoothing
export const gaussianSmoothingLab = make({
  slug: 'gaussian-smoothing', view: 'profile', params: [P.sigma, P.size, P.noise, P.py],
  presets: [{ label: 'Denoise σ=1.5', params: { sigma: 1.5, size: 9, noise: 30 } }, { label: 'Heavy σ=3.5', params: { sigma: 3.5, size: 11, noise: 45 } }],
  kernel: (p) => gaussK(p.size ?? 9, p.sigma ?? 1.5),
  explain: (p, adv) => (<><p><strong>Gaussian smoothing</strong> removes noise while treating neighbours by distance. Tune σ: too small does little, too large erases detail.</p>
    {adv && <p>Gaussian blurs compose: two passes with σ₁, σ₂ equal one with {M('√(σ₁²+σ₂²)')}. It is also separable into two 1-D passes.</p>}</>),
  steps: (p) => { const s = p.sigma ?? 1.5, n = p.size ?? 9;
    return [{ id: 's', title: 'Separable form', latex: `G(x,y)=g(x)\\,g(y),\\quad g(t)=\\frac{1}{\\sqrt{2\\pi}\\sigma}e^{-t^2/2\\sigma^2}`, rationale: `One ${n}×${n} pass = two 1-D passes: ${n * n} → ${2 * n} multiplies per pixel.`, value: 2 * n },
      { id: 'w', title: 'Recommended kernel width', latex: `n\\ge 6\\sigma`, substituted: `6\\cdot${f(s)}=${f(6 * s, 1)}\\ \\Rightarrow\\ n=${n}${n >= 6 * s ? '\\ \\checkmark' : '\\ \\text{(truncated!)}'}`, value: 6 * s }]; },
});

// 32. Edge Blurring
export const edgeBlurringLab = make({
  slug: 'edge-blurring', view: 'profile',
  params: [{ id: 'type', kind: 'select', label: 'Filter', default: 'gauss', options: [{ value: 'box', label: 'Box' }, { value: 'gauss', label: 'Gaussian' }] }, P.size, P.sigma, P.py],
  presets: [{ label: 'Mild', params: { size: 5, sigma: 1 } }, { label: 'Heavy', params: { size: 11, sigma: 3.5 } }],
  kernel: (p) => (p.type === 'box' ? box(p.size ?? 5) : gaussK(p.size ?? 5, p.sigma ?? 1)),
  explain: (p, adv) => (<><p>Smoothing has a cost: a sharp dark|bright edge is averaged with both sides and becomes a <strong>ramp</strong>. Scrub the row (Probe y) to an edge and compare orange vs. blue.</p>
    {adv && <p>Because weights depend only on distance, the filter cannot tell an edge from noise — the motivation for the <em>bilateral</em> filter, which adds an intensity-similarity weight.</p>}</>),
  steps: (p, src, k) => { const y = Math.min(src.h - 3, p.py ?? 64), a = rowOf(src, y), b = rowOf(convolve(src, k, true), y);
    const wa = edgeWidth(a), wb = edgeWidth(b);
    return [{ id: 'a', title: 'Edge rise distance before', latex: `\\Delta_{10\\text{–}90}=${wa}\\ \\text{px}`, value: wa, rationale: 'Pixels needed to go from 10% to 90% of the step.' },
      { id: 'b', title: 'Edge rise distance after', latex: `\\Delta_{10\\text{–}90}=${wb}\\ \\text{px}`, value: wb, rationale: wb > wa ? `The edge is ${wb - wa} px softer.` : 'No visible blur on this row.' },
      { id: 'c', title: 'Why it happens', latex: `g=\\sum w_{ij}f_j,\\ \\ w_{ij}=w(\\lVert i-j\\rVert)`, rationale: 'Weights ignore intensity, so bright and dark pixels are mixed alike.' }]; },
});
