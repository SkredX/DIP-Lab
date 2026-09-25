import React, { useMemo } from 'react';
import { LabModule, LabStageProps, ParamDef, PresetDef } from './types';
import { CanvasImage } from '../components/plots/CanvasImage';
import { LinePlot } from '../components/plots/LinePlot';
import { Step } from '../engine/math/types';
import { formatNum as f } from '../engine/math/stepEngine';
import { computeMSEandPSNR } from '../engine/image/transforms';
import {
  patch, patchSSD, addNoise, edgeWidth, bilateralFilter, spatialWeight, rangeWeight, gauss2,
} from '../engine/image/filters';

const M = (s: string) => <span className="font-mono text-accent">{s}</span>;

// ---------- shared params ----------
const P = {
  radius: { id: 'radius', kind: 'slider', label: 'Neighbourhood radius (px)', min: 1, max: 6, step: 1, default: 2 } as ParamDef,
  sigmaS: { id: 'sigmaS', kind: 'slider', label: 'Spatial σₛ', min: 0.5, max: 6, step: 0.1, default: 2 } as ParamDef,
  sigmaR: { id: 'sigmaR', kind: 'slider', label: 'Range σᵣ', min: 2, max: 100, step: 1, default: 25 } as ParamDef,
  noise: { id: 'noise', kind: 'slider', label: 'Noise level (σₙ)', min: 0, max: 60, step: 1, default: 15 } as ParamDef,
  px: { id: 'px', kind: 'slider', label: 'Probe x', min: 2, max: 125, step: 1, default: 64 } as ParamDef,
  py: { id: 'py', kind: 'slider', label: 'Probe y', min: 2, max: 125, step: 1, default: 64 } as ParamDef,
  dx: { id: 'dx', kind: 'slider', label: 'Neighbour offset Δx', min: -5, max: 5, step: 1, default: 2 } as ParamDef,
  dy: { id: 'dy', kind: 'slider', label: 'Neighbour offset Δy', min: -5, max: 5, step: 1, default: 0 } as ParamDef,
  patchSize: { id: 'patchSize', kind: 'slider', label: 'Patch size (n × n)', min: 3, max: 9, step: 2, default: 5 } as ParamDef,
};

const clampP = (p: Record<string, any>, im: { w: number; h: number }) => ({ x: Math.min(im.w - 7, Math.max(6, p.px ?? 64)), y: Math.min(im.h - 7, Math.max(6, p.py ?? 64)) });
const rowOf = (im: { w: number; data: Uint8ClampedArray }, y: number) => im.data.slice(y * im.w, (y + 1) * im.w);
const resample = (row: ArrayLike<number>) => Array.from({ length: 256 }, (_, i) => row[Math.min(row.length - 1, Math.floor((i / 255) * (row.length - 1)))]);

const Grid: React.FC<{ m: number[][]; title: string; d?: number }> = ({ m, title, d = 2 }) => {
  const max = Math.max(...m.flat().map(Math.abs), 1e-9);
  return (
    <figure className="flex flex-col items-center gap-2">
      <div className="inline-grid gap-px rounded-xl overflow-hidden border border-border-light dark:border-border-dark bg-border-light dark:bg-border-dark"
        style={{ gridTemplateColumns: `repeat(${m[0].length}, minmax(0, 1fr))` }}>
        {m.flatMap((r, i) => r.map((v, j) => (
          <span key={`${i}-${j}`} className="px-1.5 py-1 text-[10px] font-mono text-center min-w-[30px] text-text-light dark:text-text-dark"
            style={{ background: `rgba(240,137,91,${0.06 + 0.85 * Math.abs(v) / max})` }}>
            {Number.isInteger(v) ? v : v.toFixed(d)}
          </span>)))}
      </div>
      <figcaption className="text-[11px] text-text-muted">{title}</figcaption>
    </figure>
  );
};

// Weight grid for an (2r+1)×(2r+1) neighbourhood around (x,y): spatial-only, range-only, or combined.
function weightGrid(src: LabStageProps['image'], x: number, y: number, r: number, sigmaS: number, sigmaR: number, kind: 'spatial' | 'range' | 'both') {
  const centre = src.data[y * src.w + x];
  const g: number[][] = [];
  for (let i = -r; i <= r; i++) {
    const row: number[] = [];
    for (let j = -r; j <= r; j++) {
      const nv = src.data[Math.min(src.h - 1, Math.max(0, y + i)) * src.w + Math.min(src.w - 1, Math.max(0, x + j))];
      const ws = spatialWeight(j, i, sigmaS), wr = rangeWeight(centre, nv, sigmaR);
      row.push(kind === 'spatial' ? ws : kind === 'range' ? wr : ws * wr);
    }
    g.push(row);
  }
  return g;
}

interface Cfg {
  slug: string; params: ParamDef[]; presets: PresetDef[];
  view: 'weights-spatial' | 'weights-range' | 'weights-both' | 'compare' | 'profile' | 'patch-compare' | 'sigma-demo';
  explain: (p: Record<string, any>, adv: boolean) => React.ReactNode;
  steps: (p: Record<string, any>, im: LabStageProps['image']) => Step[];
}

const make = (c: Cfg): LabModule => ({
  slug: c.slug, params: c.params, presets: c.presets,
  Stage: ({ params: p, image }) => {
    const radius = p.radius ?? 2, sigmaS = p.sigmaS ?? 2, sigmaR = p.sigmaR ?? 25;
    const src = useMemo(() => addNoise(image, p.noise ?? 0), [image, p.noise]);
    const out = useMemo(() => bilateralFilter(src, radius, sigmaS, sigmaR), [src, radius, sigmaS, sigmaR]);
    const gauss = useMemo(() => bilateralFilter(src, radius, sigmaS, 1e6), [src, radius, sigmaS]); // σr → ∞ limit == Gaussian
    const { x, y } = clampP(p, image);
    const mse = useMemo(() => computeMSEandPSNR(image, out), [image, out]);

    if (c.view === 'weights-spatial' || c.view === 'weights-range' || c.view === 'weights-both') {
      const kind = c.view === 'weights-spatial' ? 'spatial' : c.view === 'weights-range' ? 'range' : 'both';
      const g = weightGrid(src, x, y, Math.min(4, radius + 2), sigmaS, sigmaR, kind);
      return (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <CanvasImage image={src} title="Input (probe = centre pixel)" />
          </div>
          <div className="flex flex-wrap items-start justify-center gap-6">
            <Grid m={patch(src, x, y, g.length)} title={`Neighbourhood values at (${x}, ${y})`} d={0} />
            <Grid m={g} title={kind === 'spatial' ? 'Spatial weight w(i,j)' : kind === 'range' ? 'Range weight φ(i,j)' : 'Bilateral weight w·φ'} d={3} />
          </div>
        </div>
      );
    }

    if (c.view === 'sigma-demo') {
      return (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <CanvasImage image={src} title={p.noise > 0 ? 'Input f + noise' : 'Input f(x,y)'} />
            <CanvasImage image={out} title={`Bilateral output (σₛ=${f(sigmaS)}, σᵣ=${f(sigmaR)})`} />
          </div>
          <LinePlot data={resample(rowOf(src, y))} secondaryData={resample(rowOf(out, y))} xLabel={`Row y = ${y} (orange = filtered)`} yLabel="Intensity" showIdentity={false} />
          <p className="text-center text-[11px] font-mono text-text-muted">MSE {f(mse.mse, 1)} · PSNR {Number.isFinite(mse.psnr) ? f(mse.psnr, 1) : '∞'} dB</p>
        </div>
      );
    }

    if (c.view === 'patch-compare') {
      const n = p.patchSize ?? 5;
      const a = patch(src, x, y, n);
      const bx = Math.min(src.w - Math.ceil(n / 2) - 1, x + (p.dx ?? 2)), by = Math.min(src.h - Math.ceil(n / 2) - 1, y + (p.dy ?? 0));
      const b = patch(src, bx, by, n);
      const ssd = patchSSD(a, b);
      const singlePixelDiff = (src.data[y * src.w + x] - src.data[by * src.w + bx]) ** 2;
      return (
        <div className="flex flex-col gap-6">
          <CanvasImage image={src} title={`Input — patch A at (${x},${y}), patch B at (${bx},${by})`} />
          <div className="flex flex-wrap items-start justify-center gap-6">
            <Grid m={a} title="Patch A" d={0} />
            <Grid m={b} title="Patch B" d={0} />
          </div>
          <p className="text-center text-[11px] font-mono text-text-muted">
            Single-pixel squared difference {f(singlePixelDiff, 0)} · Patch SSD {f(ssd, 0)} (averages over {n * n} pixels, far less noise-sensitive)
          </p>
        </div>
      );
    }

    // 'compare' / 'profile' — full bilateral vs. Gaussian-limit comparison
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <CanvasImage image={src} title={p.noise > 0 ? 'Input f + noise' : 'Input f(x,y)'} />
          <CanvasImage image={out} title="Bilateral output" />
          <CanvasImage image={gauss} title="Gaussian-only (σᵣ→∞)" />
        </div>
        {c.view === 'profile' && (
          <LinePlot data={resample(rowOf(src, y))} secondaryData={resample(rowOf(out, y))} xLabel={`Row y = ${y} (orange = bilateral)`} yLabel="Intensity" showIdentity={false} />
        )}
        <p className="text-center text-[11px] font-mono text-text-muted">Bilateral MSE {f(mse.mse, 1)} · PSNR {Number.isFinite(mse.psnr) ? f(mse.psnr, 1) : '∞'} dB</p>
      </div>
    );
  },
  Explain: ({ mode, params }) => <>{c.explain(params, mode === 'advanced')}</>,
  buildSteps: (p, image) => c.steps(p, addNoise(image, p.noise ?? 0)),
});

// 33. Bilateral Filtering
export const bilateralFilteringLab = make({
  slug: 'bilateral-filtering', view: 'compare',
  params: [P.radius, P.sigmaS, P.sigmaR, P.noise, P.py],
  presets: [
    { label: 'Denoise, keep edges', params: { radius: 3, sigmaS: 2.5, sigmaR: 20, noise: 25 } },
    { label: 'σᵣ→∞ (= Gaussian)', params: { radius: 3, sigmaS: 2.5, sigmaR: 100 } },
  ],
  explain: (p, adv) => (<><p>A plain Gaussian filter blurs everything the same way. <strong>Bilateral filtering</strong> blurs flat regions but refuses to blur across edges, by giving every neighbour <em>two</em> weights instead of one.</p>
    {adv && <p>{M('g(i) = Σ w(i,j)·φ(i,j)·f(j) / Σ w(i,j)·φ(i,j)')} — a normalized weighted average where the weight itself depends on both position and intensity.</p>}</>),
  steps: () => [
    { id: 'def', title: 'Bilateral filter output', latex: 'g(i)=\\frac{\\sum_{j\\in N(i)} w_{ij}\\,\\phi_{ij}\\,f(j)}{\\sum_{j\\in N(i)} w_{ij}\\,\\phi_{ij}}',
      rationale: 'A weighted average, exactly like Gaussian smoothing — except the weight has two parts, spatial and range.' },
    { id: 'two', title: 'Two questions per neighbour', latex: '\\text{spatial: how far?}\\quad\\text{range: how similar?}', rationale: 'Both must be favourable for a neighbour to count strongly.' },
  ],
});

// 34. Spatial Weight
export const spatialWeightLab = make({
  slug: 'spatial-weight', view: 'weights-spatial',
  params: [P.sigmaS, P.px, P.py],
  presets: [{ label: 'Narrow σₛ=1', params: { sigmaS: 1 } }, { label: 'Wide σₛ=4', params: { sigmaS: 4 } }],
  explain: (p, adv) => (<><p>The <strong>spatial weight</strong> only asks: "how far away is this neighbour?" It has nothing to do with brightness — it is the identical Gaussian weight from Unit 3.</p>
    {adv && <p>{M('w(i,j) = exp(−(i−j)²/2σₛ²)')} — depends purely on pixel position, not on any pixel value.</p>}</>),
  steps: (p, src) => { const { x, y } = clampP(p, src), s = p.sigmaS ?? 2;
    return [{ id: 'w', title: 'Spatial weight formula', latex: 'w(i,j)=e^{-\\frac{(i-j)^2}{2\\sigma_s^2}}' },
      { id: 'ex', title: 'Adjacent neighbour (offset 1,0)', latex: 'w=e^{-1/(2\\sigma_s^2)}', substituted: `e^{-1/(2\\cdot${f(s)}^2)}=${f(spatialWeight(1, 0, s), 4)}`, value: spatialWeight(1, 0, s) },
      { id: 'note', title: 'This half of bilateral filtering', latex: '\\text{identical to plain Gaussian smoothing}', rationale: 'Set σᵣ → ∞ and bilateral filtering reduces exactly to this.' }]; },
});

// 35. Range / Intensity Weight
export const rangeWeightLab = make({
  slug: 'range-weight', view: 'weights-range',
  params: [P.sigmaR, P.px, P.py],
  presets: [{ label: 'Strict σᵣ=10', params: { sigmaR: 10 } }, { label: 'Lenient σᵣ=60', params: { sigmaR: 60 } }],
  explain: (p, adv) => (<><p>The <strong>range weight</strong> asks a totally different question: "how similar is this neighbour's brightness to the centre pixel?" Try probing a pixel right on an edge — the far side lights up almost 0.</p>
    {adv && <p>{M('φ(i,j) = exp(−(f(i)−f(j))²/2σᵣ²)')} — a Gaussian in intensity-difference, not position.</p>}</>),
  steps: (p, src) => { const { x, y } = clampP(p, src), s = p.sigmaR ?? 25, centre = src.data[y * src.w + x];
    return [{ id: 'phi', title: 'Range weight formula', latex: '\\phi(i,j)=e^{-\\frac{(f(i)-f(j))^2}{2\\sigma_r^2}}' },
      { id: 'ex', title: `Neighbour with Δintensity = 2σᵣ`, latex: '\\phi=e^{-(2\\sigma_r)^2/(2\\sigma_r^2)}=e^{-2}', substituted: `\\approx ${f(Math.exp(-2), 4)}`, value: Math.exp(-2), rationale: 'Even a moderately different neighbour is already down-weighted a lot.' },
      { id: 'centre', title: 'Centre pixel value used as reference', latex: `f(\\text{centre})=${centre}` }]; },
});

// 36. Spatial Standard Deviation σₛ
export const spatialSigmaLab = make({
  slug: 'spatial-sigma', view: 'sigma-demo',
  params: [P.sigmaS, { ...P.sigmaR, default: 40 }, P.radius, P.noise, P.py],
  presets: [{ label: 'Tight σₛ=0.8', params: { sigmaS: 0.8, radius: 2 } }, { label: 'Broad σₛ=4.5', params: { sigmaS: 4.5, radius: 5 } }],
  explain: (p, adv) => (<><p><strong>σₛ</strong> controls how far the spatial weight reaches — the "radius of influence" in pixels. Small σₛ → only close neighbours matter. Large σₛ → smoothing pulls from farther away.</p>
    {adv && <p>σₛ means the same thing here as it did for plain Gaussian filtering — bilateral filtering just adds a second σ (σᵣ) alongside it, it doesn't redefine this one.</p>}</>),
  steps: (p) => { const s = p.sigmaS ?? 2;
    return [{ id: 'w', title: 'σₛ sets the spatial reach', latex: 'w(i,j)=e^{-d^2/2\\sigma_s^2}', rationale: `At d = σₛ = ${f(s)} px, weight ≈ ${f(Math.exp(-0.5), 3)} of its peak; at d = 3σₛ it is nearly 0.` },
      { id: 'width', title: 'Recommended kernel radius', latex: 'r \\ge 3\\sigma_s', substituted: `3\\cdot${f(s)}=${f(3 * s, 1)}\\ \\text{px}`, value: 3 * s }]; },
});

// 37. Range Standard Deviation σᵣ
export const rangeSigmaLab = make({
  slug: 'range-sigma', view: 'sigma-demo',
  params: [P.sigmaR, { ...P.sigmaS, default: 2.5 }, P.radius, P.noise, P.py],
  presets: [{ label: 'Strict σᵣ=8 (preserve edges hard)', params: { sigmaR: 8 } }, { label: 'Lenient σᵣ→∞ = Gaussian', params: { sigmaR: 100 } }],
  explain: (p, adv) => (<><p><strong>σᵣ</strong> controls how tolerant the filter is to brightness gaps — the "how different is still similar" threshold. Push σᵣ up far enough and the filter stops caring about edges at all.</p>
    {adv && <p>{M('σᵣ → ∞')} makes φ(i,j) → 1 for every neighbour, so bilateral filtering collapses into a plain Gaussian filter. Bilateral filtering is a strict generalization of Gaussian filtering, not a different family.</p>}</>),
  steps: (p) => { const s = p.sigmaR ?? 25;
    return [{ id: 'phi', title: 'σᵣ sets the brightness tolerance', latex: '\\phi=e^{-\\Delta f^2/2\\sigma_r^2}', rationale: `A neighbour Δf = ${f(s)} away from the centre keeps weight ≈ ${f(Math.exp(-0.5), 3)}; far more different neighbours are suppressed.` },
      { id: 'limit', title: 'The Gaussian limit', latex: '\\lim_{\\sigma_r\\to\\infty}\\phi(i,j)=1', rationale: 'When σᵣ is huge, range weight stops discriminating and only the spatial weight remains — ordinary Gaussian smoothing.' }]; },
});

// 38. Bilateral Weight
export const bilateralWeightLab = make({
  slug: 'bilateral-weight', view: 'weights-both',
  params: [P.sigmaS, P.sigmaR, P.px, P.py],
  presets: [{ label: 'On a flat region', params: { px: 20, py: 20 } }, { label: 'Right on an edge', params: { px: 64, py: 64 } }],
  explain: (p, adv) => (<><p>The <strong>bilateral weight</strong> is simply the product: <code>w(i,j) × φ(i,j)</code>. Multiplying (not adding) means a neighbour only contributes strongly if it is <em>both</em> close AND similar — if either weight is small, the combined weight collapses toward zero.</p>
    {adv && <p>{M('bilateral weight = w(i,j) · φ(i,j)')} — this product is what gets plugged into the normalized weighted average.</p>}</>),
  steps: (p, src) => { const { x, y } = clampP(p, src), ss = p.sigmaS ?? 2, sr = p.sigmaR ?? 25;
    const centre = src.data[y * src.w + x], nv = src.data[y * src.w + Math.min(src.w - 1, x + 1)];
    const ws = spatialWeight(1, 0, ss), wr = rangeWeight(centre, nv, sr);
    return [{ id: 'prod', title: 'Combine the two weights', latex: 'w_{ij}\\phi_{ij}=w(i,j)\\cdot\\phi(i,j)' },
      { id: 'sub', title: 'Right-neighbour example', latex: 'w\\cdot\\phi', substituted: `${f(ws, 3)}\\times ${f(wr, 3)}=${f(ws * wr, 4)}`, value: ws * wr, rationale: 'A neighbour needs a good score on BOTH factors to matter.' }]; },
});

// 39. Edge-Preserving Smoothing
export const edgePreservingSmoothingLab = make({
  slug: 'edge-preserving-smoothing', view: 'profile',
  params: [P.radius, P.sigmaS, P.sigmaR, P.py],
  presets: [{ label: 'Sharp edge kept', params: { radius: 4, sigmaS: 3, sigmaR: 15, py: 64 } }, { label: 'Weak σᵣ → edge blurs', params: { radius: 4, sigmaS: 3, sigmaR: 100, py: 64 } }],
  explain: (p, adv) => (<><p>This is the payoff. Compare with the Edge Blurring lab in Unit 3 — same kind of step edge, but this time watch the orange (filtered) curve keep its sharp jump instead of turning into a ramp.</p>
    {adv && <p>Inside a flat region the filter behaves like ordinary Gaussian smoothing (noise removed); across an edge, the range weight collapses so the two sides never get mixed. That combination is "edge-preserving smoothing."</p>}</>),
  steps: (p, src) => { const y = Math.min(src.h - 3, p.py ?? 64), a = rowOf(src, y);
    const out = bilateralFilter(src, p.radius ?? 4, p.sigmaS ?? 3, p.sigmaR ?? 15);
    const b = rowOf(out, y), wa = edgeWidth(a), wb = edgeWidth(b);
    return [{ id: 'a', title: 'Edge rise distance before', latex: `\\Delta_{10\\text{–}90}=${wa}\\ \\text{px}`, value: wa },
      { id: 'b', title: 'Edge rise distance after bilateral filtering', latex: `\\Delta_{10\\text{–}90}=${wb}\\ \\text{px}`, value: wb, rationale: wb <= wa + 1 ? 'Essentially unchanged — the edge survived.' : `Softened by ${wb - wa} px — try lowering σᵣ.` },
      { id: 'why', title: 'Why', latex: '\\phi_{ij}\\approx 0\\ \\text{across the edge}', rationale: 'Neighbours on the far side of the edge get almost zero range weight, so they cannot drag the value across.' }]; },
});

// 40. Patch-Based Comparison
export const patchBasedComparisonLab = make({
  slug: 'patch-based-comparison', view: 'patch-compare',
  params: [P.patchSize, P.noise, P.dx, P.dy, P.px, P.py],
  presets: [{ label: 'Same texture, noisy', params: { patchSize: 5, noise: 30, dx: 1, dy: 0 } }, { label: 'Different texture', params: { patchSize: 5, noise: 10, dx: 5, dy: 4 } }],
  explain: (p, adv) => (<><p>Comparing single pixel values can be misleading — if the centre pixel itself was hit by noise, every similarity judgement built on it is unreliable. The fix: compare small <strong>patches</strong> instead of single pixels; noise mostly cancels out over an area.</p>
    {adv && <p>Patch similarity is usually the sum of squared differences (SSD) between two equal-size windows — far more robust than one noisy pixel-to-pixel comparison.</p>}</>),
  steps: (p, src) => { const { x, y } = clampP(p, src), n = p.patchSize ?? 5;
    const bx = Math.min(src.w - Math.ceil(n / 2) - 1, x + (p.dx ?? 2)), by = Math.min(src.h - Math.ceil(n / 2) - 1, y + (p.dy ?? 0));
    const a = patch(src, x, y, n), b = patch(src, bx, by, n), ssd = patchSSD(a, b);
    return [{ id: 'ssd', title: 'Patch similarity (SSD)', latex: '\\mathrm{SSD}(A,B)=\\sum_{i,j}(A_{ij}-B_{ij})^2', substituted: `=${f(ssd, 0)}`, value: ssd },
      { id: 'norm', title: 'Averaged over the patch', latex: '\\overline{\\mathrm{SSD}}=\\mathrm{SSD}/n^2', substituted: `${f(ssd, 0)}/${n * n}=${f(ssd / (n * n), 2)}`, value: ssd / (n * n), rationale: 'Compare this to the single-pixel squared difference shown above the grids — far less jumpy under noise.' }]; },
});

// 41. Patch
export const patchLab = make({
  slug: 'patch', view: 'patch-compare',
  params: [P.patchSize, P.px, P.py, { ...P.dx, default: 3 }, { ...P.dy, default: 0 }],
  presets: [{ label: 'Small 3×3', params: { patchSize: 3 } }, { label: 'Large 9×9', params: { patchSize: 9 } }],
  explain: (p, adv) => (<><p>A <strong>patch</strong> is a small, fixed-size window of pixels (3×3, 5×5, 7×7, …) centred on a given pixel — a little "crop" of the image used as that pixel's local signature.</p>
    {adv && <p>Two pixels are judged similar not by a single brightness value but by how similar their surrounding patches look as a whole. This idea is the seed of non-local means filtering, one step beyond bilateral filtering.</p>}</>),
  steps: (p, src) => { const { x, y } = clampP(p, src), n = p.patchSize ?? 5;
    return [{ id: 'def', title: 'A patch, formally', latex: `P(x,y)=\\{f(x{+}i,y{+}j): -k\\le i,j\\le k\\}`, rationale: `Here n=${n}, so k=${(n - 1) / 2}.` },
      { id: 'count', title: 'Pixels inside this patch', latex: `n^2=${n}^2=${n * n}`, value: n * n }]; },
});

export const unit4Labs = {
  bilateralFilteringLab, spatialWeightLab, rangeWeightLab, spatialSigmaLab, rangeSigmaLab,
  bilateralWeightLab, edgePreservingSmoothingLab, patchBasedComparisonLab, patchLab,
};
