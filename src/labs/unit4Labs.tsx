import React, { useMemo } from 'react';
import { LabModule, LabStageProps, ParamDef, PresetDef } from './types';
import { CanvasImage } from '../components/plots/CanvasImage';
import { LinePlot } from '../components/plots/LinePlot';
import { DualViewExplain } from '../components/shell/DualViewExplain';
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
  explain: (p: Record<string, any>, mode: 'beginner' | 'advanced') => React.ReactNode;
  steps: (p: Record<string, any>, im: LabStageProps['image']) => Step[];
}

const make = (c: Cfg): LabModule => ({
  slug: c.slug, params: c.params, presets: c.presets,
  Stage: ({ params: p, image, onParamChange }) => {
    const radius = p.radius ?? 2, sigmaS = p.sigmaS ?? 2, sigmaR = p.sigmaR ?? 25;
    const src = useMemo(() => addNoise(image, p.noise ?? 0), [image, p.noise]);
    const out = useMemo(() => bilateralFilter(src, radius, sigmaS, sigmaR), [src, radius, sigmaS, sigmaR]);
    const gauss = useMemo(() => bilateralFilter(src, radius, sigmaS, 1e6), [src, radius, sigmaS]); // σr → ∞ limit == Gaussian
    const { x, y } = clampP(p, image);
    const mse = useMemo(() => computeMSEandPSNR(image, out), [image, out]);

    const handleProbeChange = (pt: { x: number; y: number }) => {
      onParamChange?.('px', pt.x);
      onParamChange?.('py', pt.y);
    };

    if (c.view === 'weights-spatial' || c.view === 'weights-range' || c.view === 'weights-both') {
      const kind = c.view === 'weights-spatial' ? 'spatial' : c.view === 'weights-range' ? 'range' : 'both';
      const g = weightGrid(src, x, y, Math.min(4, radius + 2), sigmaS, sigmaR, kind);
      return (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <CanvasImage
              image={src}
              title="Input (red dot = probe location)"
              probePoint={{ x, y }}
              kernelSize={g.length}
              onProbePointChange={handleProbeChange}
            />
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
            <CanvasImage
              image={src}
              title={p.noise > 0 ? 'Input f + noise' : 'Input f(x,y)'}
              probePoint={{ x, y }}
              lineProfileY={y}
              kernelSize={radius * 2 + 1}
              onProbePointChange={handleProbeChange}
            />
            <CanvasImage
              image={out}
              title={`Bilateral output (σₛ=${f(sigmaS)}, σᵣ=${f(sigmaR)})`}
              probePoint={{ x, y }}
              lineProfileY={y}
              kernelSize={radius * 2 + 1}
              onProbePointChange={handleProbeChange}
            />
          </div>
          <LinePlot
            data={resample(rowOf(src, y))}
            secondaryData={resample(rowOf(out, y))}
            probedX={x}
            xLabel={`Row y = ${y} (orange = filtered)`}
            yLabel="Intensity"
            showIdentity={false}
          />
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
          <CanvasImage
            image={src}
            title={`Input — patch A at (${x},${y}), patch B at (${bx},${by})`}
            probePoint={{ x, y }}
            kernelSize={n}
            onProbePointChange={handleProbeChange}
          />
          <div className="flex flex-wrap items-start justify-center gap-6">
            <Grid m={a} title={`Patch A at (${x},${y})`} d={0} />
            <Grid m={b} title={`Patch B at (${bx},${by})`} d={0} />
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
          <CanvasImage
            image={src}
            title={p.noise > 0 ? 'Input f + noise' : 'Input f(x,y)'}
            probePoint={{ x, y }}
            lineProfileY={c.view === 'profile' ? y : undefined}
            kernelSize={radius * 2 + 1}
            onProbePointChange={handleProbeChange}
          />
          <CanvasImage
            image={out}
            title="Bilateral output"
            probePoint={{ x, y }}
            lineProfileY={c.view === 'profile' ? y : undefined}
            kernelSize={radius * 2 + 1}
            onProbePointChange={handleProbeChange}
          />
          <CanvasImage
            image={gauss}
            title="Gaussian-only (σᵣ→∞)"
            probePoint={{ x, y }}
            lineProfileY={c.view === 'profile' ? y : undefined}
            kernelSize={radius * 2 + 1}
            onProbePointChange={handleProbeChange}
          />
        </div>
        {c.view === 'profile' && (
          <LinePlot
            data={resample(rowOf(src, y))}
            secondaryData={resample(rowOf(out, y))}
            probedX={x}
            xLabel={`Row y = ${y} (orange = bilateral)`}
            yLabel="Intensity"
            showIdentity={false}
          />
        )}
        <p className="text-center text-[11px] font-mono text-text-muted">Bilateral MSE {f(mse.mse, 1)} · PSNR {Number.isFinite(mse.psnr) ? f(mse.psnr, 1) : '∞'} dB</p>
      </div>
    );
  },
  Explain: ({ mode, params }) => <>{c.explain(params, mode)}</>,
  buildSteps: (p, image) => c.steps(p, addNoise(image, p.noise ?? 0)),
});

// 33. Bilateral Filtering
export const bilateralFilteringLab = make({
  slug: 'bilateral-filtering', view: 'compare',
  params: [P.radius, P.sigmaS, P.sigmaR, P.noise, P.px, P.py],
  presets: [
    { label: 'Denoise, keep edges', params: { radius: 3, sigmaS: 2.5, sigmaR: 20, noise: 25, px: 64, py: 64 } },
    { label: 'σᵣ→∞ (= Gaussian)', params: { radius: 3, sigmaS: 2.5, sigmaR: 100, px: 64, py: 64 } },
  ],
  explain: (p, mode) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <>
            <p><strong>Think of it like a smart painter</strong> smoothing out a portrait. A normal Gaussian blur is like smudging the whole canvas, blurring eyes, lips, and skin together.</p>
            <p><strong>Bilateral filtering</strong> is smarter: it smooths out the flat areas (like skin) but stops blending as soon as it hits a sharp boundary (like the edge of the lips). It asks two questions before blending pixels: "Are you close?" and "Are you the same colour?"</p>
          </>
        ),
        controls: (
          <ul>
            <li><strong>Neighbourhood radius:</strong> The size of the brush used for blending.</li>
            <li><strong>Spatial σₛ:</strong> How far out to reach for neighbours (the "Are you close?" test).</li>
            <li><strong>Range σᵣ:</strong> How different a pixel's brightness can be before it gets ignored (the "Are you the same colour?" test).</li>
          </ul>
        ),
        whatToLookFor: (
          <>
            <p>Move the red probe dot to a sharp edge. Notice how the output remains razor-sharp!</p>
            <p>Try the <em>σᵣ→∞ (= Gaussian)</em> preset. See how the entire image, including edges, gets blurred when we ignore the brightness difference.</p>
          </>
        ),
        whyItMatters: (
          <p>Smartphone cameras use this heavily for "Beauty Mode" or skin smoothing. It removes blemishes and noise while keeping eyelashes and facial contours perfectly sharp.</p>
        )
      }}
      advanced={{
        math: (
          <>
            <p>The bilateral filter is a non-linear, edge-preserving and noise-reducing smoothing filter.</p>
            <p><span className="font-mono text-accent">g(i) = Σ w(i,j)·φ(i,j)·f(j) / Σ w(i,j)·φ(i,j)</span></p>
            <p>It's a normalized weighted average where the weight is the product of a domain (spatial) kernel <span className="font-mono text-accent">w_s</span> and a range (photometric) kernel <span className="font-mono text-accent">w_r</span>.</p>
          </>
        ),
        algorithm: (
          <>
            <p>The algorithm evaluates both spatial distance and intensity distance for every neighbour. If a pixel is physically close but across a contrast boundary, <span className="font-mono text-accent">φ(i,j)</span> drops to near zero.</p>
            <p>Direct implementation has <span className="font-mono text-accent">O(r^2)</span> complexity per pixel, whereas bilateral grid approximations can reduce this to <span className="font-mono text-accent">O(1)</span> with respect to radius.</p>
          </>
        ),
        parameterImpact: (
          <>
            <p>As <span className="font-mono text-accent">σᵣ → ∞</span>, the range weight <span className="font-mono text-accent">φ(i,j) → 1</span> everywhere, reducing the filter to a linear Gaussian spatial blur.</p>
            <p>As <span className="font-mono text-accent">σₛ → ∞</span>, it becomes a pure range filter, though practically restricted by the neighbourhood radius.</p>
          </>
        ),
        applications: (
          <p>Used extensively in tone mapping for HDR photography (to extract the detail layer), depth map refinement in stereo vision, and medical CT noise filtering without blurring tumor boundaries.</p>
        )
      }}
    />
  ),
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
  presets: [{ label: 'Narrow σₛ=1', params: { sigmaS: 1, px: 64, py: 64 } }, { label: 'Wide σₛ=4', params: { sigmaS: 4, px: 64, py: 64 } }],
  explain: (p, mode) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <>
            <p><strong>Think of it like a ripple in a pond.</strong> The spatial weight only cares about physical distance.</p>
            <p>It asks: "How physically far away is this neighbour in pixels?" The closer a pixel is to the center, the stronger its influence. It completely ignores what the pixels actually look like.</p>
          </>
        ),
        controls: (
          <ul>
            <li><strong>Spatial σₛ:</strong> Controls how wide the ripple spreads. A small value means only immediate neighbors matter.</li>
          </ul>
        ),
        whatToLookFor: (
          <>
            <p>Move the glowing red dot around. Notice that moving the probe to an edge does NOT change the spatial weight grid.</p>
            <p>Toggle between the "Narrow" and "Wide" presets. Watch how the numbers in the grid spread out physically, regardless of the image content underneath.</p>
          </>
        ),
        whyItMatters: (
          <p>This is the fundamental building block of all blurring effects. By itself, it produces a perfect, uniform out-of-focus blur, like a camera lens out of focus.</p>
        )
      }}
      advanced={{
        math: (
          <>
            <p>The spatial kernel is typically a standard 2D Gaussian:</p>
            <p><span className="font-mono text-accent">w_s(i,j) = exp(−((i_x−j_x)² + (i_y−j_y)²)/(2σₛ²))</span></p>
            <p>It is strictly isotropic (rotationally symmetric) and independent of image intensities.</p>
          </>
        ),
        algorithm: (
          <>
            <p>Because the spatial weights only depend on relative coordinates, they can be precomputed into a lookup table or a static convolution kernel.</p>
            <p>For a fixed radius <span className="font-mono text-accent">r</span>, the grid of spatial weights never changes during the image traversal.</p>
          </>
        ),
        parameterImpact: (
          <p>The spatial standard deviation <span className="font-mono text-accent">σₛ</span> defines the cutoff. At a distance of <span className="font-mono text-accent">3σₛ</span>, the weight is approximately 0.011, effectively negligible.</p>
        ),
        applications: (
          <p>This exact formulation is the domain kernel in bilateral filtering, and is mathematically identical to a standard linear Gaussian low-pass filter used in image pyramids and scale-space representations.</p>
        )
      }}
    />
  ),
  steps: (p, src) => { const { x, y } = clampP(p, src), s = p.sigmaS ?? 2;
    return [{ id: 'w', title: 'Spatial weight formula', latex: 'w(i,j)=e^{-\\frac{(i-j)^2}{2\\sigma_s^2}}' },
      { id: 'ex', title: 'Adjacent neighbour (offset 1,0)', latex: 'w=e^{-1/(2\\sigma_s^2)}', substituted: `e^{-1/(2\\cdot${f(s)}^2)}=${f(spatialWeight(1, 0, s), 4)}`, value: spatialWeight(1, 0, s) },
      { id: 'note', title: 'This half of bilateral filtering', latex: '\\text{identical to plain Gaussian smoothing}', rationale: 'Set σᵣ → ∞ and bilateral filtering reduces exactly to this.' }]; },
});

// 35. Range / Intensity Weight
export const rangeWeightLab = make({
  slug: 'range-weight', view: 'weights-range',
  params: [P.sigmaR, P.px, P.py],
  presets: [{ label: 'Strict σᵣ=10', params: { sigmaR: 10, px: 64, py: 64 } }, { label: 'Lenient σᵣ=60', params: { sigmaR: 60, px: 64, py: 64 } }],
  explain: (p, mode) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <>
            <p><strong>Think of it like a bouncer checking IDs at a fence.</strong> The range weight checks if a neighbor belongs to the same "brightness club" as the center pixel.</p>
            <p>It asks: "How similar is this neighbour's brightness?" If a neighbor is drastically darker or lighter, it gets shut out, even if it's right next door.</p>
          </>
        ),
        controls: (
          <ul>
            <li><strong>Range σᵣ:</strong> How lenient the bouncer is. A small value is strict (blocks almost everyone different); a large value is lenient.</li>
          </ul>
        ),
        whatToLookFor: (
          <>
            <p>Move the red probe dot right onto an edge boundary.</p>
            <p>Look at the Range weight grid below! The side matching the red dot receives high weights (~1.0), while the opposite side drops to nearly 0.0, forming a natural boundary fence.</p>
          </>
        ),
        whyItMatters: (
          <p>This is the "magic" part of bilateral filtering that allows cartoon rendering (cel-shading) in video games, by flattening colors within regions while keeping the ink-like black outlines intact.</p>
        )
      }}
      advanced={{
        math: (
          <>
            <p>The range (photometric) kernel measures similarity in intensity space:</p>
            <p><span className="font-mono text-accent">w_r(i,j) = φ(i,j) = exp(−(f(i)−f(j))² / (2σᵣ²))</span></p>
            <p>It evaluates the squared difference in pixel intensities <span className="font-mono text-accent">f</span> at spatial locations <span className="font-mono text-accent">i</span> and <span className="font-mono text-accent">j</span>.</p>
          </>
        ),
        algorithm: (
          <>
            <p>Unlike spatial weights, range weights are data-dependent and must be dynamically computed for every neighbor at every pixel.</p>
            <p>This dynamic computation is what breaks separability. We cannot easily split the 2D filter into two 1D passes as we do with standard Gaussian blur.</p>
          </>
        ),
        parameterImpact: (
          <p>A very small <span className="font-mono text-accent">σᵣ</span> causes the filter to act like an impulse (delta) function in intensity space, preserving noise. A very large <span className="font-mono text-accent">σᵣ</span> causes <span className="font-mono text-accent">φ(i,j) → 1</span>, neutralizing the edge-stopping behavior.</p>
        ),
        applications: (
          <p>Used independently as a highly localized thresholding mechanism, and forms the core of non-linear similarity metrics in segmentation algorithms like Mean Shift.</p>
        )
      }}
    />
  ),
  steps: (p, src) => { const { x, y } = clampP(p, src), s = p.sigmaR ?? 25, centre = src.data[y * src.w + x];
    return [{ id: 'phi', title: 'Range weight formula', latex: '\\phi(i,j)=e^{-\\frac{(f(i)-f(j))^2}{2\\sigma_r^2}}' },
      { id: 'ex', title: `Neighbour with Δintensity = 2σᵣ`, latex: '\\phi=e^{-(2\\sigma_r)^2/(2\\sigma_r^2)}=e^{-2}', substituted: `\\approx ${f(Math.exp(-2), 4)}`, value: Math.exp(-2), rationale: 'Even a moderately different neighbour is already down-weighted a lot.' },
      { id: 'centre', title: 'Centre pixel value used as reference', latex: `f(\\text{centre})=${centre}` }]; },
});

// 36. Spatial Standard Deviation σₛ
export const spatialSigmaLab = make({
  slug: 'spatial-sigma', view: 'sigma-demo',
  params: [P.sigmaS, { ...P.sigmaR, default: 40 }, P.radius, P.noise, P.px, P.py],
  presets: [{ label: 'Tight σₛ=0.8', params: { sigmaS: 0.8, radius: 2, px: 64, py: 64 } }, { label: 'Broad σₛ=4.5', params: { sigmaS: 4.5, radius: 5, px: 64, py: 64 } }],
  explain: (p, mode) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <>
            <p><strong>Think of Spatial σₛ as the length of your arm.</strong> It determines how far you can reach out to gather neighboring pixels to mix into your current spot.</p>
            <p>Small σₛ means you only grab immediate neighbors; large σₛ means you reach far and wide.</p>
          </>
        ),
        controls: (
          <ul>
            <li><strong>Spatial σₛ:</strong> Controls the physical spread of the blur.</li>
          </ul>
        ),
        whatToLookFor: (
          <>
            <p>Move the red probe dot to a noisy flat region.</p>
            <p>As you increase σₛ, the flat area becomes smoother and the graph line flattens out, but notice how the steep drops (edges) stay protected!</p>
          </>
        ),
        whyItMatters: (
          <p>When filtering out large speckles of dust or noise, you need a long reach (high σₛ) to average over enough clean pixels to wipe out the blemish.</p>
        )
      }}
      advanced={{
        math: (
          <>
            <p>The spatial scale parameter <span className="font-mono text-accent">σₛ</span> determines the variance of the domain Gaussian.</p>
            <p>The continuous domain integral <span className="font-mono text-accent">∫∫ exp(−(x²+y²)/(2σₛ²)) dx dy</span> dictates the normalization factor.</p>
          </>
        ),
        algorithm: (
          <>
            <p>To avoid truncation artifacts, the kernel radius <span className="font-mono text-accent">r</span> must scale with <span className="font-mono text-accent">σₛ</span>.</p>
            <p>A standard practice is setting <span className="font-mono text-accent">r = ceil(3σₛ)</span>, ensuring 99.7% of the Gaussian mass is captured.</p>
          </>
        ),
        parameterImpact: (
          <p>Increasing <span className="font-mono text-accent">σₛ</span> exponentially increases the computational cost of direct implementations, as the window size <span className="font-mono text-accent">(2r+1)²</span> grows quadratically.</p>
        ),
        applications: (
          <p>In multiscale bilateral filtering (like the bilateral pyramid), <span className="font-mono text-accent">σₛ</span> is iteratively doubled to decompose the image into different spatial frequency bands while respecting edges.</p>
        )
      }}
    />
  ),
  steps: (p) => { const s = p.sigmaS ?? 2;
    return [{ id: 'w', title: 'σₛ sets the spatial reach', latex: 'w(i,j)=e^{-d^2/2\\sigma_s^2}', rationale: `At d = σₛ = ${f(s)} px, weight ≈ ${f(Math.exp(-0.5), 3)} of its peak; at d = 3σₛ it is nearly 0.` },
      { id: 'width', title: 'Recommended kernel radius', latex: 'r \\ge 3\\sigma_s', substituted: `3\\cdot${f(s)}=${f(3 * s, 1)}\\ \\text{px}`, value: 3 * s }]; },
});

// 37. Range Standard Deviation σᵣ
export const rangeSigmaLab = make({
  slug: 'range-sigma', view: 'sigma-demo',
  params: [P.sigmaR, { ...P.sigmaS, default: 2.5 }, P.radius, P.noise, P.px, P.py],
  presets: [{ label: 'Strict σᵣ=8 (preserve edges hard)', params: { sigmaR: 8, px: 64, py: 64 } }, { label: 'Lenient σᵣ→∞ = Gaussian', params: { sigmaR: 100, px: 64, py: 64 } }],
  explain: (p, mode) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <>
            <p><strong>Think of Range σᵣ as a brightness tolerance threshold.</strong> It decides how much of a color difference is considered an "edge" versus just "noise".</p>
            <p>Low σᵣ treats even tiny brightness steps as walls and refuses to cross them. High σᵣ is very forgiving and happily blends different shades.</p>
          </>
        ),
        controls: (
          <ul>
            <li><strong>Range σᵣ:</strong> Strictness of the brightness test.</li>
          </ul>
        ),
        whatToLookFor: (
          <>
            <p>Try the "Strict σᵣ=8" preset. Notice how some noise might survive because the filter thinks the noisy speckles are actual edges!</p>
            <p>Push σᵣ all the way to 100. Watch the bilateral filter collapse into a standard, blurry Gaussian filter as it stops respecting boundaries.</p>
          </>
        ),
        whyItMatters: (
          <p>This is crucial for computational photography. You want a σᵣ just large enough to smooth out camera sensor noise, but small enough to preserve the texture of fabric or hair.</p>
        )
      }}
      advanced={{
        math: (
          <>
            <p>The photometric scale parameter <span className="font-mono text-accent">σᵣ</span> dictates the variance of the range Gaussian.</p>
            <p>It dictates the inflection point in the gradient domain where smoothing transitions to preservation.</p>
          </>
        ),
        algorithm: (
          <>
            <p>As <span className="font-mono text-accent">σᵣ → ∞</span>, <span className="font-mono text-accent">lim φ(i,j) = 1</span>.</p>
            <p>Fast approximations like the Bilateral Grid rely on discretizing intensity space into bins. A very small <span className="font-mono text-accent">σᵣ</span> requires more bins, increasing memory usage and reducing acceleration benefits.</p>
          </>
        ),
        parameterImpact: (
          <p>If <span className="font-mono text-accent">σᵣ</span> is smaller than the standard deviation of the image noise (<span className="font-mono text-accent">σₙ</span>), the filter fails to denoise because it interprets random noise spikes as salient edges.</p>
        ),
        applications: (
          <p>In medical imaging, calibrating <span className="font-mono text-accent">σᵣ</span> against tissue radiodensity variance ensures that distinct organs don't blur into one another.</p>
        )
      }}
    />
  ),
  steps: (p) => { const s = p.sigmaR ?? 25;
    return [{ id: 'phi', title: 'σᵣ sets the brightness tolerance', latex: '\\phi=e^{-\\Delta f^2/2\\sigma_r^2}', rationale: `A neighbour Δf = ${f(s)} away from the centre keeps weight ≈ ${f(Math.exp(-0.5), 3)}; far more different neighbours are suppressed.` },
      { id: 'limit', title: 'The Gaussian limit', latex: '\\lim_{\\sigma_r\\to\\infty}\\phi(i,j)=1', rationale: 'When σᵣ is huge, range weight stops discriminating and only the spatial weight remains — ordinary Gaussian smoothing.' }]; },
});

// 38. Bilateral Weight
export const bilateralWeightLab = make({
  slug: 'bilateral-weight', view: 'weights-both',
  params: [P.sigmaS, P.sigmaR, P.px, P.py],
  presets: [{ label: 'On a flat region', params: { px: 20, py: 20 } }, { label: 'Right on an edge', params: { px: 64, py: 64 } }],
  explain: (p, mode) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <>
            <p><strong>Think of it like a two-key launch system.</strong> For a neighbor to contribute to the final blended color, it must turn both keys: it must be close (spatial) AND it must look similar (range).</p>
            <p>If either condition fails—if it's too far, or if it's too different in brightness—the final combined weight drops to zero.</p>
          </>
        ),
        controls: (
          <ul>
            <li><strong>Probe position:</strong> Moving the red dot lets you sample the weights on flat ground versus on a sharp transition.</li>
          </ul>
        ),
        whatToLookFor: (
          <>
            <p>Slide the red probe dot from a flat region to an edge.</p>
            <p>On flat ground, the combined weights form a perfect, symmetrical circle. On an edge, the weights lop-side and cleanly slice along the shape of the boundary, refusing to cross it.</p>
          </>
        ),
        whyItMatters: (
          <p>This dynamic shape-shifting is why bilateral filters are so powerful. The blur kernel literally changes its shape on the fly to fit inside the boundaries of objects.</p>
        )
      }}
      advanced={{
        math: (
          <>
            <p>The final bilateral weight is the Hadamard (element-wise) product of the spatial and range kernels:</p>
            <p><span className="font-mono text-accent">W(i,j) = w_s(i,j) · w_r(i,j)</span></p>
            <p>The response is then normalized by the sum of these products, <span className="font-mono text-accent">Z_i = Σ W(i,j)</span>.</p>
          </>
        ),
        algorithm: (
          <p>Because the range kernel is non-linear and data-dependent, <span className="font-mono text-accent">W(i,j)</span> cannot be factorized. The normalization factor <span className="font-mono text-accent">Z_i</span> ensures the filter is unbiased and preserves constant signals.</p>
        ),
        parameterImpact: (
          <p>The combined weight effectively acts as an anisotropic diffusion kernel. On uniform regions, <span className="font-mono text-accent">W</span> is symmetric. Near a step edge, <span className="font-mono text-accent">W</span> truncates sharply, shifting its centroid away from the boundary.</p>
        ),
        applications: (
          <p>This pointwise multiplication principle is extended in joint/cross-bilateral filtering, where <span className="font-mono text-accent">w_s</span> is computed from the target image, but <span className="font-mono text-accent">w_r</span> is computed from a separate guide image (e.g., using a no-flash image to denoise a flash image).</p>
        )
      }}
    />
  ),
  steps: (p, src) => { const { x, y } = clampP(p, src), ss = p.sigmaS ?? 2, sr = p.sigmaR ?? 25;
    const centre = src.data[y * src.w + x], nv = src.data[y * src.w + Math.min(src.w - 1, x + 1)];
    const ws = spatialWeight(1, 0, ss), wr = rangeWeight(centre, nv, sr);
    return [{ id: 'prod', title: 'Combine the two weights', latex: 'w_{ij}\\phi_{ij}=w(i,j)\\cdot\\phi(i,j)' },
      { id: 'sub', title: 'Right-neighbour example', latex: 'w\\cdot\\phi', substituted: `${f(ws, 3)}\\times ${f(wr, 3)}=${f(ws * wr, 4)}`, value: ws * wr, rationale: 'A neighbour needs a good score on BOTH factors to matter.' }]; },
});

// 39. Edge-Preserving Smoothing
export const edgePreservingSmoothingLab = make({
  slug: 'edge-preserving-smoothing', view: 'profile',
  params: [P.radius, P.sigmaS, P.sigmaR, P.px, P.py],
  presets: [{ label: 'Sharp edge kept', params: { radius: 4, sigmaS: 3, sigmaR: 15, px: 64, py: 64 } }, { label: 'Weak σᵣ → edge blurs', params: { radius: 4, sigmaS: 3, sigmaR: 100, px: 64, py: 64 } }],
  explain: (p, mode) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <>
            <p><strong>The Ultimate Goal: Smooth the noise, keep the edge.</strong></p>
            <p>Look at the orange line in the graph. In a standard blur, that steep cliff (an edge) would turn into a gentle slope, making the image look muddy and out-of-focus.</p>
          </>
        ),
        controls: (
          <ul>
            <li><strong>Spatial / Range sliders:</strong> Tweak them to see the balance between smoothing the bumps and keeping the cliff sharp.</li>
          </ul>
        ),
        whatToLookFor: (
          <>
            <p>Compare this profile plot to a standard blur. The orange curve maintains its sharp step edge without flattening into a ramp!</p>
            <p>Inside the flat regions on either side of the edge, the squiggly noise is wiped clean. The edge itself stays vertical.</p>
          </>
        ),
        whyItMatters: (
          <p>This is the holy grail of photo editing apps. It's how you can smooth out a textured wall or a cloudy sky without blurring the sharp outline of the buildings in front of them.</p>
        )
      }}
      advanced={{
        math: (
          <>
            <p>We quantify edge preservation by measuring the transition width, such as the <span className="font-mono text-accent">Δ_10-90</span> rise distance.</p>
            <p>A pure Gaussian blur increases this width proportionally to <span className="font-mono text-accent">σₛ</span>. The bilateral filter keeps it nearly identical to the input signal's rise distance.</p>
          </>
        ),
        algorithm: (
          <p>The filter acts as a robust estimator. In the presence of a step edge, the distribution of neighbor intensities is bimodal. The range weight <span className="font-mono text-accent">φ</span> acts as an outlier rejection mechanism, causing the weighted average to ignore the mode on the other side of the edge.</p>
        ),
        parameterImpact: (
          <p>If <span className="font-mono text-accent">σᵣ</span> is set too high, the outlier rejection fails, and the edge blurs. If <span className="font-mono text-accent">σᵣ</span> is too low, the filter becomes trapped in local noise minima and fails to smooth.</p>
        ),
        applications: (
          <p>Essential in surface reconstruction from noisy point clouds, where preserving sharp corners is critical for CAD modeling and 3D printing.</p>
        )
      }}
    />
  ),
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
  explain: (p, mode) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <>
            <p><strong>Think of comparing whole fingerprints instead of single dust grains.</strong></p>
            <p>Comparing single pixel values is risky. If one pixel happens to be hit by a speck of noise, it might look entirely different from its twin. But if you compare a small <em>patch</em> (a window of pixels), the random noise averages out.</p>
          </>
        ),
        controls: (
          <ul>
            <li><strong>Patch size:</strong> How large of a "fingerprint" block to compare.</li>
            <li><strong>Neighbour offset:</strong> Move Patch B around to see how similar it is to Patch A.</li>
          </ul>
        ),
        whatToLookFor: (
          <>
            <p>Look at the SSD (Sum of Squared Differences) number. Notice how it provides a stable, reliable score of similarity, even when noise is high.</p>
            <p>Compare the single-pixel difference versus the patch SSD. The patch SSD is far less jumpy and erratic.</p>
          </>
        ),
        whyItMatters: (
          <p>This is how advanced video compression (like H.264/HEVC) finds moving objects, and how modern AI denoisers realize that the texture of a brick wall repeats itself.</p>
        )
      }}
      advanced={{
        math: (
          <>
            <p>Patch similarity is typically computed using the Sum of Squared Differences (SSD) or L2 norm over a local window <span className="font-mono text-accent">N</span>:</p>
            <p><span className="font-mono text-accent">SSD(p, q) = Σ (f(p+δ) − f(q+δ))²</span> for <span className="font-mono text-accent">δ ∈ N</span>.</p>
          </>
        ),
        algorithm: (
          <p>By integrating over a spatial neighborhood, patch-based comparison drastically increases the Signal-to-Noise Ratio (SNR) of the similarity metric, assuming the underlying signal is locally stationary.</p>
        ),
        parameterImpact: (
          <p>Larger patch sizes increase robustness to zero-mean Gaussian noise but reduce the ability to match fine, high-frequency details. A typical size is 5×5 or 7×7.</p>
        ),
        applications: (
          <p>This is the core heuristic behind Block Matching algorithms in optical flow, block-matching and 3D filtering (BM3D), and texture synthesis algorithms.</p>
        )
      }}
    />
  ),
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
  explain: (p, mode) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: (
          <>
            <p><strong>A patch is a pixel's local signature.</strong> Instead of judging a pixel by its solitary color, we judge it by the neighborhood it lives in.</p>
            <p>It's a small, fixed-size crop (like 3×3 or 5×5) centered on a specific spot.</p>
          </>
        ),
        controls: (
          <ul>
            <li><strong>Patch size:</strong> Change it from a tiny 3×3 square to a large 9×9 block.</li>
          </ul>
        ),
        whatToLookFor: (
          <p>Watch how the highlighted grid grows. The larger the patch, the more context it captures about edges, corners, and textures.</p>
        ),
        whyItMatters: (
          <p>This concept leads to "Non-Local Means", a powerful technique that denoise an image by finding similar patches anywhere in the picture, not just immediately nearby. It's like finding matching jigsaw pieces to figure out what a noisy piece should look like.</p>
        )
      }}
      advanced={{
        math: (
          <>
            <p>Formally, a patch <span className="font-mono text-accent">P(x)</span> of size <span className="font-mono text-accent">n × n</span> around pixel <span className="font-mono text-accent">x</span> is a vector in <span className="font-mono text-accent">R^(n²)</span>.</p>
            <p>The space of all patches in an image forms a low-dimensional manifold in this high-dimensional space.</p>
          </>
        ),
        algorithm: (
          <p>Extracting heavily overlapping patches from an image creates massive redundancy. This redundancy is exploited by advanced algorithms (like PCA-based denoising or dictionary learning) to separate signal from noise.</p>
        ),
        parameterImpact: (
          <p>A larger patch size (<span className="font-mono text-accent">n</span>) maps pixels into a higher-dimensional space, making Euclidean distances between patches more discriminative against noise, but geometrically sparse.</p>
        ),
        applications: (
          <p>The foundational concept behind Non-Local Means (NLM) filtering, BM3D (the gold standard in classical denoising), and the architecture of Convolutional Neural Networks (CNNs), which learn hierarchical patch representations.</p>
        )
      }}
    />
  ),
  steps: (p, src) => { const { x, y } = clampP(p, src), n = p.patchSize ?? 5;
    return [{ id: 'def', title: 'A patch, formally', latex: `P(x,y)=\\{f(x{+}i,y{+}j): -k\\le i,j\\le k\\}`, rationale: `Here n=${n}, so k=${(n - 1) / 2}.` },
      { id: 'count', title: 'Pixels inside this patch', latex: `n^2=${n}^2=${n * n}`, value: n * n }]; },
});

export const unit4Labs = {
  bilateralFilteringLab, spatialWeightLab, rangeWeightLab, spatialSigmaLab, rangeSigmaLab,
  bilateralWeightLab, edgePreservingSmoothingLab, patchBasedComparisonLab, patchLab,
};
