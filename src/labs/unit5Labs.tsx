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
  Stage: ({ params: p, image }) => {
    const L = useMemo(() => estimateIllumination(image, p.sigmaL ?? 15), [image, p.sigmaL]);
    const Rdiv = useMemo(() => divideReflectance(image, L, 128), [image, L]);
    const Rlog = useMemo(() => logReflectance(image, L, p.gain ?? 32), [image, L, p.gain]);
    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <CanvasImage image={image} title="Observed I(x,y)" />
          {(c.mode === 'illum' || c.mode === 'model') && <CanvasImage image={L} title="Estimated illumination L(x,y)" />}
          {c.mode === 'reflect-divide' && <CanvasImage image={Rdiv} title="Reflectance R = I / L" />}
          {(c.mode === 'reflect-log' || c.mode === 'model') && <CanvasImage image={Rlog} title="Reflectance (log form)" />}
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
  slug: 'retinex', mode: 'model', params: [P.sigmaL, P.gain],
  presets: [{ label: 'Mild correction', params: { sigmaL: 10, gain: 20 } }, { label: 'Strong correction', params: { sigmaL: 30, gain: 45 } }],
  explain: (p, adv) => (<><p><strong>Retinex</strong> (retina + cortex) tries to recover how a surface truly looks, no matter how it happens to be lit. What a camera records is a mixture of the object's own reflectance and the lighting hitting it — Retinex separates the two.</p>
    {adv && <p>Goal: recover reflectance R (what the surface actually looks like), throwing away illumination L (how it happened to be lit).</p>}</>),
  steps: () => [
    { id: 'goal', title: 'The Retinex goal', latex: '\\text{recover }R\\text{, discard }L', rationale: 'A white wall should read as white whether it is noon or dusk — reflectance is what stays constant.' },
    { id: 'model', title: 'Image formation model', latex: 'I(x,y)=L(x,y)\\cdot R(x,y)', rationale: 'Everything in this unit builds from this one multiplicative model.' },
  ],
});

// 43. Illumination
export const illuminationLab = makeR({
  slug: 'illumination', mode: 'illum', params: [P.sigmaL],
  presets: [{ label: 'Local (σ=6)', params: { sigmaL: 6 } }, { label: 'Global (σ=35)', params: { sigmaL: 35 } }],
  explain: (p, adv) => (<><p><strong>Illumination</strong> L(x,y) is the light falling on a scene — it comes from the light source, not the object. It varies slowly and smoothly, so it is estimated here with a wide Gaussian blur.</p>
    {adv && <p>Point a bright lamp at a wall: the same patch of wall now measures brighter purely because L increased — R never changed.</p>}</>),
  steps: (p) => [
    { id: 'l', title: 'Illumination estimate', latex: 'L(x,y)\\approx (I * G_\\sigma)(x,y)', rationale: `σ = ${f(p.sigmaL ?? 15)}: a wide blur keeps slow lighting changes but throws away fine surface detail.` },
    { id: 'why', title: 'Why a blur approximates L', latex: '\\text{lighting varies slowly across a scene}', rationale: 'Reflectance changes sharply at object edges; illumination does not — so smoothing isolates L.' },
  ],
});

// 44. Reflectance
export const reflectanceLab = makeR({
  slug: 'reflectance', mode: 'reflect-divide', params: [P.sigmaL],
  presets: [{ label: 'Recover fine detail', params: { sigmaL: 12 } }],
  explain: (p, adv) => (<><p><strong>Reflectance</strong> R(x,y) is the intrinsic property of the surface — how much incoming light it reflects. This is the "true colour/material" information, independent of lighting.</p>
    {adv && <p>{M('R = I / L')} — dividing out the estimated illumination leaves (approximately) the lighting-independent surface detail.</p>}</>),
  steps: (p, image, L) => { const y = Math.floor(image.h / 2), x = Math.floor(image.w / 2), Iv = image.data[y * image.w + x], Lv = Math.max(1, L.data[y * image.w + x]);
    return [{ id: 'div', title: 'Reflectance by division', latex: 'R=\\frac{I}{L}' },
      { id: 'ex', title: 'At the centre pixel', latex: 'R', substituted: `${Iv}/${Lv}=${f(Iv / Lv, 3)}`, value: Iv / Lv, rationale: 'Scaled back into a displayable 0–255 range in the image on the right.' }]; },
});

// 45. Illumination–Reflectance Model
export const illuminationReflectanceModelLab = makeR({
  slug: 'illumination-reflectance-model', mode: 'model', params: [P.sigmaL, P.gain],
  presets: [{ label: 'Log-domain separation', params: { sigmaL: 15, gain: 32 } }],
  explain: (p, adv) => (<><p>Putting illumination and reflectance together: {M('I = L · R')}. Because they combine multiplicatively, a common trick is to take logarithms — this turns the product into a sum, which is far easier to separate.</p>
    {adv && <p>{M('log I = log L + log R')}. Estimate the (slowly-varying) L, then subtract it in log space to recover R.</p>}</>),
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
  Stage: ({ params: p, image }) => {
    const gamma = p.gamma ?? 0.6, cc = p.c ?? 1.0, probedR = p.probedR ?? 100;
    const lut = useMemo(() => gammaLUT(cc, gamma), [cc, gamma]);
    const out = useMemo(() => applyLUT(image, lut), [image, lut]);
    const tangentSlope = useMemo(() => { const norm = Math.max(0.001, probedR / 255); return cc * gamma * Math.pow(norm, gamma - 1); }, [cc, gamma, probedR]);
    const family = useMemo(() => [0.2, 0.5, 1.0, 2.0, 3.0].map((g) => Array.from(gammaLUT(1, g))), []);
    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
        <CanvasImage image={out} title={`Output s = c·r^γ  (γ=${f(gamma)})`} />
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
  presets: [{ label: 'Brighten shadows', params: { gamma: 0.45, c: 1.0 } }, { label: 'Darken highlights', params: { gamma: 2.2, c: 1.0 } }],
  explain: (p, adv) => (<><p><strong>Gamma correction</strong> brightens or darkens an image nonlinearly. A flat additive shift looks wrong — it washes out highlights or crushes shadows — because human perception of brightness is not linear. A power-law curve matches how brightness is actually perceived.</p>
    {adv && <p>{M('γ < 1 → brighter, γ = 1 → unchanged, γ > 1 → darker')}.</p>}</>),
  steps: (p) => buildGammaDerivationSteps(p.c ?? 1, p.gamma ?? 0.6, p.probedR ?? 100),
});

// 47. Gamma Transformation
export const gammaTransformationLab = makeG({
  slug: 'gamma-transformation', view: 'single', params: [P.gamma, P.c, P.probedR],
  presets: [{ label: 'γ < 1 (expand shadows)', params: { gamma: 0.5 } }, { label: 'γ = 1 (identity)', params: { gamma: 1.0 } }, { label: 'γ > 1 (expand highlights)', params: { gamma: 2.5 } }],
  explain: (p, adv) => (<><p>The formula: {M('s = c·rᵞ')}, where r is input intensity, s is output intensity, c is a scaling constant, and γ shapes the curve. Drag γ below 1, at 1, and above 1 — watch the curve bend.</p>
    {adv && <p>γ&lt;1: curve bends upward early → dark tones expand → brighter overall. γ=1: straight line, no change. γ&gt;1: curve bends downward early → dark tones compress → darker overall.</p>}</>),
  steps: (p) => buildGammaDerivationSteps(p.c ?? 1, p.gamma ?? 0.6, p.probedR ?? 100),
});

// 48. Power-Law Transformation
export const powerLawTransformationLab = makeG({
  slug: 'power-law-transformation', view: 'family', params: [P.gamma, P.c, P.probedR],
  presets: [{ label: 'Compare γ=0.2 vs γ=1', params: { gamma: 0.2 } }],
  explain: (p, adv) => (<><p>"Power-law transformation" is the general name for the whole family {M('s = c·rᵞ')} — gamma correction is just the most common specific use of it, applied to brightness. Sweeping γ generates a whole family of curves (γ = 0.1, 0.4, 1, 2.5, …), all shown on the same axes in textbook figures.</p>
    {adv && <p>Unlike histogram equalization (data-driven, computed from the image's own histogram), a power-law transformation is a fixed, user-chosen curve — you pick γ yourself rather than deriving it from pixel statistics.</p>}</>),
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
