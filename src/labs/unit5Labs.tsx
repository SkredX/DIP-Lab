import React, { useMemo } from 'react';
import { LabModule, ParamDef, PresetDef } from './types';
import { CanvasImage } from '../components/plots/CanvasImage';
import { LinePlot } from '../components/plots/LinePlot';
import { Step } from '../engine/math/types';
import { formatNum as f, buildGammaDerivationSteps } from '../engine/math/stepEngine';
import { lutFromFn, applyLUT } from '../engine/image/lut';
import { estimateIllumination, divideReflectance, logReflectance } from '../engine/image/formation';
import { GrayImage } from '../engine/image/types';
import { DualViewExplain } from '../components/shell/DualViewExplain';

const M = (s: string) => <span className="font-mono text-accent">{s}</span>;

// ---------- shared params ----------
const P = {
  sigmaL: { id: 'sigmaL', kind: 'slider', label: 'Illumination smoothing σ', min: 3, max: 40, step: 1, default: 15 } as ParamDef,
  gain: { id: 'gain', kind: 'slider', label: 'Reflectance gain', min: 8, max: 64, step: 1, default: 32 } as ParamDef,
  gamma: { id: 'gamma', kind: 'slider', label: 'Gamma Exponent (γ)', min: 0.1, max: 3.5, step: 0.1, default: 0.6 } as ParamDef,
  c: { id: 'c', kind: 'slider', label: 'Scale Factor (c)', min: 0.5, max: 1.5, step: 0.05, default: 1.0 } as ParamDef,
  probedR: { id: 'probedR', kind: 'slider', label: 'Probe Intensity r', min: 0, max: 255, step: 1, default: 100, advancedOnly: true } as ParamDef,
  px: { id: 'px', kind: 'slider', label: 'Probe x', min: 2, max: 125, step: 1, default: 64 } as ParamDef,
  py: { id: 'py', kind: 'slider', label: 'Probe y', min: 2, max: 125, step: 1, default: 64 } as ParamDef,
};

const gammaLUT = (c: number, gamma: number) => lutFromFn((r) => c * 255 * Math.pow(r / 255, gamma));

// ================= Retinex / illumination-reflectance group =================
interface RCfg {
  slug: string; params: ParamDef[]; presets: PresetDef[];
  mode: 'illum' | 'reflect-divide' | 'reflect-log' | 'model';
  explain: (p: Record<string, any>, mode: 'beginner' | 'advanced') => React.ReactNode;
  steps: (p: Record<string, any>, image: GrayImage, L: GrayImage) => Step[];
}
const makeR = (c: RCfg): LabModule => ({
  slug: c.slug, params: c.params, presets: c.presets,
  Stage: ({ params: p, image, onParamChange }) => {
    const L = useMemo(() => estimateIllumination(image, p.sigmaL ?? 15), [image, p.sigmaL]);
    const Rdiv = useMemo(() => divideReflectance(image, L, 128), [image, L]);
    const Rlog = useMemo(() => logReflectance(image, L, p.gain ?? 32), [image, L, p.gain]);
    const x = Math.min(image.w - 3, Math.max(2, p.px ?? 64));
    const y = Math.min(image.h - 3, Math.max(2, p.py ?? 64));

    const handleProbeChange = (pt: { x: number; y: number }) => {
      onParamChange?.('px', pt.x);
      onParamChange?.('py', pt.y);
    };

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <CanvasImage image={image} title="Observed I(x,y)" probePoint={{ x, y }} onProbePointChange={handleProbeChange} />
          {(c.mode === 'illum' || c.mode === 'model') && <CanvasImage image={L} title="Estimated illumination L(x,y)" probePoint={{ x, y }} onProbePointChange={handleProbeChange} />}
          {c.mode === 'reflect-divide' && <CanvasImage image={Rdiv} title="Reflectance R = I / L" probePoint={{ x, y }} onProbePointChange={handleProbeChange} />}
          {(c.mode === 'reflect-log' || c.mode === 'model') && <CanvasImage image={Rlog} title="Reflectance (log form)" probePoint={{ x, y }} onProbePointChange={handleProbeChange} />}
        </div>
        <p className="text-center text-[11px] text-text-muted">I = L · R — the observed image is illumination multiplied by the object's own reflectance.</p>
      </div>
    );
  },
  Explain: ({ mode, params }) => <>{c.explain(params, mode)}</>,
  buildSteps: (p, image) => { const L = estimateIllumination(image, p.sigmaL ?? 15); return c.steps(p, image, L); },
});

// 42. Retinex
export const retinexLab = makeR({
  slug: 'retinex', mode: 'model', params: [P.sigmaL, P.gain, P.px, P.py],
  presets: [{ label: 'Mild correction', params: { sigmaL: 10, gain: 20, px: 64, py: 64 } }, { label: 'Strong correction', params: { sigmaL: 30, gain: 45, px: 64, py: 64 } }],
  explain: (p, mode) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: <p>Think of looking at objects through tinted shadows. Retinex (Retina + Cortex) mimics how our brain separates the object's actual paint from the flashlight shining on it.</p>,
        controls: (
          <ul>
            <li><strong>Illumination smoothing σ:</strong> Blurs out the details to guess the lighting alone.</li>
            <li><strong>Reflectance gain:</strong> Adjusts the brightness of the separated colors.</li>
          </ul>
        ),
        whatToLookFor: <p>Move the glowing red probe dot across a shadow boundary: observe that while the observed brightness drops dramatically inside the shadow, the recovered reflectance stays nearly constant!</p>,
        whyItMatters: <p>Just like reading a white sheet of paper indoors versus under the sun, this concept helps cameras ensure a white wall looks white no matter the lighting.</p>,
      }}
      advanced={{
        math: <p>Multiplicative image formation model: <span className="font-mono text-accent">I(x,y) = L(x,y) · R(x,y)</span>, where L is illumination and R is reflectance. Log-domain decomposition: <span className="font-mono text-accent">log I = log L + log R</span>.</p>,
        algorithm: <p>Single-scale Retinex (SSR) isolates reflectance by subtracting a Gaussian-smoothed version of the log-image from the original log-image.</p>,
        parameterImpact: <p>The scale parameter σ controls the extent of local adaptation. Too small σ yields an unnatural, edge-only image; too large σ fails to compress dynamic range effectively.</p>,
        applications: <p>Used in HDR imaging, satellite shadow removal, and improving visibility in endoscopic imaging under uneven lighting.</p>,
      }}
    />
  ),
  steps: () => [
    { id: 'goal', title: 'The Retinex goal', latex: '\\text{recover }R\\text{, discard }L', rationale: 'A white wall should read as white whether it is noon or dusk — reflectance is what stays constant.' },
    { id: 'model', title: 'Image formation model', latex: 'I(x,y)=L(x,y)\\cdot R(x,y)', rationale: 'Everything in this unit builds from this one multiplicative model.' },
  ],
});

// 43. Illumination
export const illuminationLab = makeR({
  slug: 'illumination', mode: 'illum', params: [P.sigmaL, P.px, P.py],
  presets: [{ label: 'Local (σ=6)', params: { sigmaL: 6, px: 64, py: 64 } }, { label: 'Global (σ=35)', params: { sigmaL: 35, px: 64, py: 64 } }],
  explain: (p, mode) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: <p>Think of it as putting a heavy frosted glass over your camera. You can't see details, just the general wash of light across the scene.</p>,
        controls: <ul><li><strong>Illumination smoothing σ:</strong> Controls how thick the "frosted glass" is. Higher means blurrier light estimation.</li></ul>,
        whatToLookFor: <p>As you increase the smoothing, surface textures vanish and only the soft lighting field remains. The red probe dot marks the inspected coordinate.</p>,
        whyItMatters: <p>Smartphones use this to figure out where the primary light sources are, helping to balance uneven lighting in portraits.</p>,
      }}
      advanced={{
        math: <p>Illumination L(x,y) is estimated via spatial convolution: <span className="font-mono text-accent">L(x,y) ≈ (I * G_σ)(x,y)</span>, where G is a Gaussian kernel.</p>,
        algorithm: <p>This acts as a low-pass filter on the spatial domain. The underlying assumption is that illumination varies slowly across the scene.</p>,
        parameterImpact: <p>Larger σ effectively narrows the bandwidth of the low-pass filter, retaining only the DC component and very low frequencies (the global illumination gradient).</p>,
        applications: <p>Background extraction, shading correction in microscopy, and preparing images for local contrast enhancement.</p>,
      }}
    />
  ),
  steps: (p) => [
    { id: 'l', title: 'Illumination estimate', latex: 'L(x,y)\\approx (I * G_\\sigma)(x,y)', rationale: `σ = ${f(p.sigmaL ?? 15)}: a wide blur keeps slow lighting changes but throws away fine surface detail.` },
    { id: 'why', title: 'Why a blur approximates L', latex: '\\text{lighting varies slowly across a scene}', rationale: 'Reflectance changes sharply at object edges; illumination does not — so smoothing isolates L.' },
  ],
});

// 44. Reflectance
export const reflectanceLab = makeR({
  slug: 'reflectance', mode: 'reflect-divide', params: [P.sigmaL, P.px, P.py],
  presets: [{ label: 'Recover fine detail', params: { sigmaL: 12, px: 64, py: 64 } }],
  explain: (p, mode) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: <p>Think of it like peeling off a tinted sticker. We are dividing out the lighting to reveal the true "paint" or color of the object underneath.</p>,
        controls: <ul><li><strong>Illumination smoothing σ:</strong> Affects the "lighting map" we divide by.</li></ul>,
        whatToLookFor: <p>Dividing the observed image by the estimated illumination strips out ambient shadows. Look at the red probe dot: the math steps compute the exact division at those coordinates!</p>,
        whyItMatters: <p>Used by robots and self-driving cars to recognize lane markings and traffic signs regardless of whether they are in direct sunlight or under a bridge.</p>,
      }}
      advanced={{
        math: <p>Intrinsic material albedo is isolated via division: <span className="font-mono text-accent">R = I / L</span>.</p>,
        algorithm: <p>Division in the linear domain effectively normalizes the pixel intensities based on the local lighting estimate.</p>,
        parameterImpact: <p>Numerical stability is crucial here; we must avoid division by zero (e.g., ensuring <span className="font-mono text-accent">L &gt; 0</span>).</p>,
        applications: <p>Material classification, computer vision pipelines that require illumination-invariant features, and remote sensing.</p>,
      }}
    />
  ),
  steps: (p, image, L) => {
    const x = Math.min(image.w - 3, Math.max(2, p.px ?? 64));
    const y = Math.min(image.h - 3, Math.max(2, p.py ?? 64));
    const Iv = image.data[y * image.w + x], Lv = Math.max(1, L.data[y * image.w + x]);
    return [
      { id: 'div', title: 'Reflectance by division', latex: 'R=\\frac{I}{L}' },
      { id: 'ex', title: `At probe position (${x}, ${y})`, latex: 'R', substituted: `${Iv}/${Lv}=${f(Iv / Lv, 3)}`, value: Iv / Lv, rationale: 'Scaled back into a displayable 0–255 range in the image on the right.' },
    ];
  },
});

// 45. Illumination–Reflectance Model
export const illuminationReflectanceModelLab = makeR({
  slug: 'illumination-reflectance-model', mode: 'model', params: [P.sigmaL, P.gain, P.px, P.py],
  presets: [{ label: 'Log-domain separation', params: { sigmaL: 15, gain: 32, px: 64, py: 64 } }],
  explain: (p, mode) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: <p>Imagine un-mixing a baked cake. Since light and paint multiply together, we use a math trick (logarithms) to turn multiplication into addition, making them easy to separate.</p>,
        controls: (
          <ul>
            <li><strong>Illumination smoothing σ:</strong> Decides what counts as "smooth light" vs "sharp texture".</li>
            <li><strong>Reflectance gain:</strong> Adjusts the final contrast of the un-mixed image.</li>
          </ul>
        ),
        whatToLookFor: <p>Watch the red dot track through all stages: separating smooth lighting (low frequencies) from sharp textures (high frequencies).</p>,
        whyItMatters: <p>This is the secret sauce behind "HDR Night Sight" on your smartphone—recovering details hidden in pitch-black shadows without washing out streetlights.</p>,
      }}
      advanced={{
        math: <p>Homomorphic filtering pipeline: Input → Log → High-pass filter (attenuate L, amplify R) → Exp → Enhanced output. <span className="font-mono text-accent">log I = log L + log R</span>.</p>,
        algorithm: <p>Transforms the multiplicative model into a linear additive model. A linear high-pass filter can then selectively suppress the low-frequency illumination term.</p>,
        parameterImpact: <p>Computational complexity involves point-wise logarithms and exponentials, alongside spatial convolutions. To avoid <span className="font-mono text-accent">log(0)</span>, a small epsilon is often added to the image.</p>,
        applications: <p>Dynamic range compression vs tonal rendition trade-offs, sonar imagery enhancement, and penetrating uneven illumination in underwater photography.</p>,
      }}
    />
  ),
  steps: (p) => [
    { id: 'model', title: 'The model', latex: 'I(x,y)=L(x,y)\\cdot R(x,y)' },
    { id: 'log', title: 'Log turns product into sum', latex: '\\log I=\\log L+\\log R', rationale: 'Now L can be estimated (smoothing) and subtracted out, leaving an estimate of log R.' },
    { id: 'pipe', title: 'Pipeline', latex: '\\text{I}\\to\\text{estimate L (blur)}\\to\\text{divide/subtract}\\to\\text{R}', rationale: `Gain = ${f(p.gain ?? 32)} rescales the recovered log-difference back into a displayable image.` },
  ],
});

// ================= Gamma / power-law group =================
interface GCfg {
  slug: string; params: ParamDef[]; presets: PresetDef[];
  view: 'single' | 'family';
  explain: (p: Record<string, any>, mode: 'beginner' | 'advanced') => React.ReactNode;
  steps: (p: Record<string, any>) => Step[];
}
const makeG = (c: GCfg): LabModule => ({
  slug: c.slug, params: c.params, presets: c.presets,
  Stage: ({ params: p, image, onParamChange }) => {
    const gamma = p.gamma ?? 0.6, cc = p.c ?? 1.0, probedR = p.probedR ?? 100;
    const lut = useMemo(() => gammaLUT(cc, gamma), [cc, gamma]);
    const out = useMemo(() => applyLUT(image, lut), [image, lut]);
    const tangentSlope = useMemo(() => { const norm = Math.max(0.001, probedR / 255); return cc * gamma * Math.pow(norm, gamma - 1); }, [cc, gamma, probedR]);
    const family = useMemo(() => [0.2, 0.5, 1.0, 2.0, 3.0].map((g) => Array.from(gammaLUT(1, g))), []);

    const handleProbePixel = (pix: { x: number; y: number; r: number } | null) => {
      if (pix) {
        onParamChange?.('probedR', pix.r);
      }
    };

    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <CanvasImage
          image={out}
          title={`Output s = c·r^γ  (γ=${f(gamma)})`}
          onProbe={handleProbePixel}
        />
        <div className="w-full sm:w-[320px]">
          {c.view === 'single' ? (
            <LinePlot data={Array.from(lut)} xLabel="Input r" yLabel="Output s" probedX={probedR} tangentSlope={tangentSlope} showIdentity />
          ) : (
            <LinePlot data={family[2]} secondaryData={family[0]} xLabel="γ = 1 (blue, straight) vs γ = 0.2 (orange)" yLabel="Output s" showIdentity />
          )}
        </div>
      </div>
    );
  },
  Explain: ({ mode, params }) => <>{c.explain(params, mode)}</>,
  buildSteps: (p) => c.steps(p),
});

// 46. Gamma Correction
export const gammaCorrectionLab = makeG({
  slug: 'gamma-correction', view: 'single', params: [P.gamma, P.c, P.probedR],
  presets: [{ label: 'Brighten shadows', params: { gamma: 0.45, c: 1.0, probedR: 80 } }, { label: 'Darken highlights', params: { gamma: 2.2, c: 1.0, probedR: 160 } }],
  explain: (p, mode) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: <p>Think of the contrast dials that bend shadows up without washing out white clouds into flat white sheets. It curves the brightness to match how our eyes see.</p>,
        controls: (
          <ul>
            <li><strong>Gamma Exponent (γ):</strong> Less than 1 expands dark shadows; greater than 1 darkens highlights.</li>
            <li><strong>Scale Factor (c):</strong> A raw multiplier for overall brightness.</li>
          </ul>
        ),
        whatToLookFor: <p>Slide the parameters to see the curve change. A flat addition just washes out shadows, but gamma correction smoothly brings out dark details.</p>,
        whyItMatters: <p>This is why CRT/OLED monitors have gamma correction curves, and how cinema color grading makes dark moody scenes visible.</p>,
      }}
      advanced={{
        math: <p>The transfer function is <span className="font-mono text-accent">s = c · r^γ</span>. The first derivative <span className="font-mono text-accent">ds/dr = c · γ · (r/255)^(γ-1)</span> dictates local contrast.</p>,
        algorithm: <p>Applied as a point-wise operation, typically using a precomputed Look-Up Table (LUT) for O(1) per-pixel execution time.</p>,
        parameterImpact: <p>Tangent slope behavior in shadow regions diverges as <span className="font-mono text-accent">r→0</span> for <span className="font-mono text-accent">γ&lt;1</span>, leading to infinite theoretical contrast expansion at absolute black.</p>,
        applications: <p>sRGB transfer function standard (approx 2.2 gamma, linear segment near zero to prevent infinite derivative), video broadcast color spaces BT.709/BT.2020.</p>,
      }}
    />
  ),
  steps: (p) => buildGammaDerivationSteps(p.c ?? 1, p.gamma ?? 0.6, p.probedR ?? 100),
});

// 47. Gamma Transformation
export const gammaTransformationLab = makeG({
  slug: 'gamma-transformation', view: 'single', params: [P.gamma, P.c, P.probedR],
  presets: [{ label: 'γ < 1 (expand shadows)', params: { gamma: 0.5, probedR: 70 } }, { label: 'γ = 1 (identity)', params: { gamma: 1.0, probedR: 128 } }, { label: 'γ > 1 (expand highlights)', params: { gamma: 2.5, probedR: 180 } }],
  explain: (p, mode) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: <p>Imagine stretching a rubber band differently at the ends than in the middle. We're selectively stretching the dark tones while squishing the bright ones.</p>,
        controls: <ul><li><strong>Gamma Exponent (γ):</strong> Drag below 1 to arch upward (boosting darks), or above 1 to bow downward (compressing shadows).</li></ul>,
        whatToLookFor: <p>Watch the plot's curve. At γ = 1, it forms a straight diagonal line. Observe how the curve directly maps input brightness to output brightness.</p>,
        whyItMatters: <p>The human eye has a nonlinear perception of darkness vs brightness. This transformation aligns digital images with our natural vision.</p>,
      }}
      advanced={{
        math: <p>Defined by <span className="font-mono text-accent">s = c · r^γ</span>. Contrast expansion occurs where the derivative <span className="font-mono text-accent">ds/dr &gt; 1</span>, and compression where <span className="font-mono text-accent">ds/dr &lt; 1</span>.</p>,
        algorithm: <p>It maps the input domain [0, 255] to output range [0, 255] monotonically, guaranteeing no order reversal of intensity values.</p>,
        parameterImpact: <p>At <span className="font-mono text-accent">γ &lt; 1</span>, noise in dark regions is heavily amplified due to the steep slope. High-bit-depth processing is often required to avoid banding artifacts.</p>,
        applications: <p>Contrast expansion in underexposed vs overexposed regions, sensor linearization, and tone mapping.</p>,
      }}
    />
  ),
  steps: (p) => buildGammaDerivationSteps(p.c ?? 1, p.gamma ?? 0.6, p.probedR ?? 100),
});

// 48. Power-Law Transformation
export const powerLawTransformationLab = makeG({
  slug: 'power-law-transformation', view: 'family', params: [P.gamma, P.c, P.probedR],
  presets: [{ label: 'Compare γ=0.2 vs γ=1', params: { gamma: 0.2, probedR: 60 } }],
  explain: (p, mode) => (
    <DualViewExplain
      mode={mode}
      beginner={{
        concept: <p>Think of it as a whole family of contrast dials. You can switch between lifting shadows like a bright flash, or creating moody silhouettes.</p>,
        controls: <ul><li><strong>Gamma Exponent (γ):</strong> One simple formula spans from dramatic shadow lifting to extreme high-contrast darkening.</li></ul>,
        whatToLookFor: <p>The plot displays a family of curves (γ = 0.2, 0.5, 1.0, 2.0, 3.0). Notice how the single parameter completely changes the shape of the mapping.</p>,
        whyItMatters: <p>Unlike auto-enhance features that guess based on the image, this is a fixed, predictable mathematical dial used by professional colorists.</p>,
      }}
      advanced={{
        math: <p>The general power-law family: <span className="font-mono text-accent">s = c · r^γ</span>. Gamma correction is a specific application of this broader mathematical class.</p>,
        algorithm: <p>Unlike histogram equalization (a data-driven CDF mapping), power-law transformations are fixed parametric functions independent of image statistics.</p>,
        parameterImpact: <p>Fractional powers (γ &lt; 1) map a narrow range of dark input values into a wider range of output values, while integer/greater powers (γ &gt; 1) do the opposite.</p>,
        applications: <p>Medical image enhancement (e.g., highlighting washout structures), display calibration profiling, and generalized intensity remapping pipelines.</p>,
      }}
    />
  ),
  steps: (p) => [
    { id: 'fam', title: 'The power-law family', latex: 's=c\\cdot r^{\\gamma},\\quad \\gamma>0', rationale: 'One formula, many curves — γ is the only thing that changes shape.' },
    ...buildGammaDerivationSteps(p.c ?? 1, p.gamma ?? 0.6, p.probedR ?? 100),
    { id: 'compare', title: 'Gamma vs. histogram equalization', latex: '\\text{fixed curve (you choose }\\gamma\\text{)}\\ \\ne\\ \\text{data-driven CDF mapping}', rationale: 'Power-law transformations do not look at the image\'s histogram at all.' },
  ],
});

export const unit5Labs = {
  retinexLab, illuminationLab, reflectanceLab, illuminationReflectanceModelLab,
  gammaCorrectionLab, gammaTransformationLab, powerLawTransformationLab,
};
