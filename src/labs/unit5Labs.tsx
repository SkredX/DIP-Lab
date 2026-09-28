import React, { useMemo } from 'react';
import { LabModule, ParamDef, PresetDef } from './types';
import { CanvasImage } from '../components/plots/CanvasImage';
import { LinePlot } from '../components/plots/LinePlot';
import { Step } from '../engine/math/types';
import { formatNum as f, buildGammaDerivationSteps } from '../engine/math/stepEngine';
import { lutFromFn, applyLUT } from '../engine/image/lut';
import { estimateIllumination, divideReflectance, logReflectance } from '../engine/image/formation';
import { GrayImage } from '../engine/image/types';

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
  explain: (p: Record<string, any>, adv: boolean) => React.ReactNode;
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
  Explain: ({ mode, params }) => <>{c.explain(params, mode === 'advanced')}</>,
  buildSteps: (p, image) => { const L = estimateIllumination(image, p.sigmaL ?? 15); return c.steps(p, image, L); },
});

// 42. Retinex
export const retinexLab = makeR({
  slug: 'retinex', mode: 'model', params: [P.sigmaL, P.gain, P.px, P.py],
  presets: [{ label: 'Mild correction', params: { sigmaL: 10, gain: 20, px: 64, py: 64 } }, { label: 'Strong correction', params: { sigmaL: 30, gain: 45, px: 64, py: 64 } }],
  explain: (p, adv) => (
    <>
      <p><strong>Retinex</strong> (Retina + Cortex) separates what a surface truly looks like from how it happens to be lit. What a camera records is the product of incident illumination L and intrinsic surface reflectance R: {M('I = L · R')}.</p>
      <p>Move the glowing red probe dot across a shadow boundary: observe that while observed brightness I drops dramatically inside the shadow, the recovered reflectance R stays nearly constant!</p>
      {adv && <p>Goal: recover reflectance R (intrinsic material albedo), discarding illumination L (incident lighting gradient). Log-domain decomposition: {M('log I = log L + log R')}.</p>}
    </>
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
  explain: (p, adv) => (
    <>
      <p><strong>Illumination</strong> L(x,y) is the light falling on a scene from lamps, sun, or shadows. Because physical light diffuses smoothly across space, illumination varies slowly and smoothly.</p>
      <p>We estimate L by applying a wide Gaussian blur with radius σ. As you increase σ, surface texture vanishes and only the soft lighting field remains. The red probe dot marks the inspected coordinate.</p>
      {adv && <p>Point a bright lamp at a wall: the wall patch measures brighter solely because L increased — reflectance R never changed.</p>}
    </>
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
  explain: (p, adv) => (
    <>
      <p><strong>Reflectance</strong> R(x,y) is the intrinsic property of the surface — how much incoming light it reflects. This is the true color and material information, independent of shadows.</p>
      <p>Dividing observed image by estimated illumination ({M('R = I / L')}) strips out ambient shadows. Look at the red probe dot: the math steps below compute the exact division R = I / L at those coordinates!</p>
      {adv && <p>{M('R = I / L')} — dividing out the estimated illumination leaves approximately the lighting-independent surface albedo.</p>}
    </>
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
  explain: (p, adv) => (
    <>
      <p>Because illumination and reflectance combine multiplicatively ({M('I = L · R')}), separating them in standard linear space is tricky. Taking logarithms turns multiplication into addition: {M('log I = log L + log R')}.</p>
      <p>Now, standard linear frequency filters can separate them: low frequencies correspond to log L (smooth lighting) and high frequencies correspond to log R (sharp textures). The red dot tracks the coordinate through all stages.</p>
      {adv && <p>Homomorphic filtering pipeline: Input → Log → High-pass filter (attenuate L, amplify R) → Exp → Enhanced output.</p>}
    </>
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
  explain: (p: Record<string, any>, adv: boolean) => React.ReactNode;
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
  Explain: ({ mode, params }) => <>{c.explain(params, mode === 'advanced')}</>,
  buildSteps: (p) => c.steps(p),
});

// 46. Gamma Correction
export const gammaCorrectionLab = makeG({
  slug: 'gamma-correction', view: 'single', params: [P.gamma, P.c, P.probedR],
  presets: [{ label: 'Brighten shadows', params: { gamma: 0.45, c: 1.0, probedR: 80 } }, { label: 'Darken highlights', params: { gamma: 2.2, c: 1.0, probedR: 160 } }],
  explain: (p, adv) => (
    <>
      <p><strong>Gamma correction</strong> brightens or darkens an image nonlinearly. A flat addition (+30) washes out shadows into milky gray and blows highlights into pure white.</p>
      <p>Because human vision is far more sensitive to subtle differences in dark shadows than in bright highlights, power-law curves curve brightness perceptually: <strong>γ &lt; 1</strong> expands dark shadows; <strong>γ &gt; 1</strong> darkens highlights.</p>
      {adv && <p>{M('s = c · r^γ')}. Slide Probe Intensity r to see the tangent slope ds/dr: for γ&lt;1, slope is steep in the darks (high contrast expansion) and gentle in highlights.</p>}
    </>
  ),
  steps: (p) => buildGammaDerivationSteps(p.c ?? 1, p.gamma ?? 0.6, p.probedR ?? 100),
});

// 47. Gamma Transformation
export const gammaTransformationLab = makeG({
  slug: 'gamma-transformation', view: 'single', params: [P.gamma, P.c, P.probedR],
  presets: [{ label: 'γ < 1 (expand shadows)', params: { gamma: 0.5, probedR: 70 } }, { label: 'γ = 1 (identity)', params: { gamma: 1.0, probedR: 128 } }, { label: 'γ > 1 (expand highlights)', params: { gamma: 2.5, probedR: 180 } }],
  explain: (p, adv) => (
    <>
      <p>The mathematical curve: {M('s = c · r^γ')}. Input brightness r maps to output brightness s.</p>
      <p>Drag <strong>Gamma Exponent (γ)</strong> below 1: the curve arches upward, boosting dark tones. At γ = 1, it forms a straight diagonal line (no change). Above 1, the curve bows downward, compressing shadows.</p>
      {adv && <p>Derivative ds/dr = c·γ·(r/255)^(γ-1). At r=0 with γ&lt;1, derivative approaches ∞ (infinite contrast expansion for black tones).</p>}
    </>
  ),
  steps: (p) => buildGammaDerivationSteps(p.c ?? 1, p.gamma ?? 0.6, p.probedR ?? 100),
});

// 48. Power-Law Transformation
export const powerLawTransformationLab = makeG({
  slug: 'power-law-transformation', view: 'family', params: [P.gamma, P.c, P.probedR],
  presets: [{ label: 'Compare γ=0.2 vs γ=1', params: { gamma: 0.2, probedR: 60 } }],
  explain: (p, adv) => (
    <>
      <p><strong>Power-law transformation</strong> is the general mathematical family {M('s = c · r^γ')}. Gamma correction is simply the most famous practical application.</p>
      <p>The plot displays a family of curves (γ = 0.2, 0.5, 1.0, 2.0, 3.0). Notice how one simple formula with parameter γ spans from dramatic shadow lifting to extreme high-contrast darkening.</p>
      {adv && <p>Unlike histogram equalization (which is computed automatically from pixel counts), power-law curves are fixed parametric functions that do not look at image statistics.</p>}
    </>
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
