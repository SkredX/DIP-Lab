import { Step, StepHighlight } from './types';

/**
 * Format numbers with reasonable decimal precision, avoiding floating point artifacts
 */
export function formatNum(n: number, decimals: number = 3): string {
  if (Number.isInteger(n)) return n.toString();
  const fixed = n.toFixed(decimals);
  return parseFloat(fixed).toString();
}

/**
 * Generates step-by-step calculus derivation for power-law (Gamma) transformation: s = c * (r/255)^gamma * 255
 */
export function buildGammaDerivationSteps(c: number, gamma: number, probedR: number = 100): Step[] {
  const normR = Math.max(0.001, probedR / 255);
  const steps: Step[] = [];

  // Step 1: Definition
  steps.push({
    id: 'gamma-def',
    title: 'Transformation Formula',
    latex: `s = T(r) = c \\cdot 255 \\cdot \\left(\\frac{r}{255}\\right)^\\gamma`,
    substituted: `s = ${formatNum(c)} \\cdot 255 \\cdot \\left(\\frac{${probedR}}{255}\\right)^{${formatNum(gamma)}} = ${formatNum(
      c * 255 * Math.pow(normR, gamma),
      1
    )}`,
    rationale: 'Power-law (Gamma) mapping with dynamic scaling constant c and exponent γ.',
    value: c * 255 * Math.pow(normR, gamma),
    highlight: { plot: 'curve', kind: 'point', at: probedR },
  });

  // Step 2: Differentiating
  if (Math.abs(gamma - 0) < 0.001) {
    steps.push({
      id: 'gamma-deriv-zero',
      title: 'Degenerate Case: γ = 0',
      latex: `\\frac{ds}{dr} = 0`,
      substituted: `\\frac{ds}{dr} = 0`,
      rationale: 'When γ = 0, the output is a constant value across all intensities; contrast is completely lost.',
      value: 0,
      highlight: { plot: 'curve', kind: 'tangent', at: probedR },
    });
    return steps;
  }

  if (Math.abs(gamma - 1) < 0.001) {
    steps.push({
      id: 'gamma-deriv-one',
      title: 'Linear Case: γ = 1',
      latex: `\\frac{ds}{dr} = c`,
      substituted: `\\frac{ds}{dr} = ${formatNum(c)}`,
      rationale: 'When γ = 1, transformation is strictly linear with constant slope c.',
      value: c,
      highlight: { plot: 'curve', kind: 'tangent', at: probedR },
    });
    return steps;
  }

  // Step 3: General Power Rule
  const derivVal = c * gamma * Math.pow(normR, gamma - 1);
  steps.push({
    id: 'gamma-power-rule',
    title: 'Apply Power & Chain Rules',
    latex: `\\frac{ds}{dr} = \\frac{d}{dr}\\left[c \\cdot 255 \\cdot \\left(\\frac{r}{255}\\right)^\\gamma\\right] = c \\cdot \\gamma \\cdot \\left(\\frac{r}{255}\\right)^{\\gamma - 1}`,
    substituted: `\\frac{ds}{dr} = ${formatNum(c)} \\cdot ${formatNum(gamma)} \\cdot \\left(\\frac{${probedR}}{255}\\right)^{${formatNum(
      gamma - 1
    )}} = ${formatNum(derivVal, 4)}`,
    rationale: 'Calculates the local contrast magnification factor at intensity r.',
    value: derivVal,
    highlight: { plot: 'curve', kind: 'tangent', at: probedR },
  });

  // Step 4: Interpretation of Slope
  const interpretation =
    derivVal > 1.05
      ? `Slope > 1 (${formatNum(derivVal, 2)}): Local contrast is expanded; subtle tonal differences around r = ${probedR} are magnified.`
      : derivVal < 0.95
      ? `Slope < 1 (${formatNum(derivVal, 2)}): Local contrast is compressed; tonal range around r = ${probedR} is flattened.`
      : `Slope ≈ 1 (${formatNum(derivVal, 2)}): Contrast remains approximately neutral at this intensity.`;

  steps.push({
    id: 'gamma-interpretation',
    title: 'Physical Interpretation of Derivative',
    latex: `T'(r) = ${formatNum(derivVal, 3)} \\quad ${derivVal > 1 ? '> 1 \\implies \\text{Contrast Expansion}' : '< 1 \\implies \\text{Contrast Compression}'}`,
    rationale: interpretation,
    value: derivVal,
    highlight: { plot: 'curve', kind: 'tangent', at: probedR },
  });

  return steps;
}

/**
 * Generates logarithmic transformation steps: s = c * ln(1 + r)
 */
export function buildLogDerivationSteps(c: number, probedR: number = 100): Step[] {
  const scaledC = (255 / Math.log(256)) * c;
  const sVal = scaledC * Math.log(1 + probedR);
  const derivVal = scaledC / (1 + probedR);

  return [
    {
      id: 'log-def',
      title: 'Logarithmic Transformation',
      latex: `s = T(r) = c \\cdot \\ln(1 + r)`,
      substituted: `s = ${formatNum(scaledC, 2)} \\cdot \\ln(1 + ${probedR}) = ${formatNum(sVal, 1)}`,
      rationale: 'Compresses large dynamic range by mapping narrow low-intensity range into wide output range.',
      value: sVal,
      highlight: { plot: 'curve', kind: 'point', at: probedR },
    },
    {
      id: 'log-deriv',
      title: 'Derivative via Reciprocal Rule',
      latex: `\\frac{ds}{dr} = \\frac{d}{dr}[c \\cdot \\ln(1 + r)] = \\frac{c}{1 + r}`,
      substituted: `\\frac{ds}{dr} = \\frac{${formatNum(scaledC, 2)}}{1 + ${probedR}} = ${formatNum(derivVal, 4)}`,
      rationale: 'Slope is inversely proportional to (1 + r); huge boost in dark regions, diminishing returns in highlights.',
      value: derivVal,
      highlight: { plot: 'curve', kind: 'tangent', at: probedR },
    },
  ];
}

/**
 * Generates steps for Histogram Equalization derivation and proof of uniform output
 */
export function buildEqualizationMathSteps(
  probedR: number = 120,
  probAtR: number = 0.008,
  cdfAtR: number = 0.45,
  L: number = 256
): Step[] {
  const mappedS = Math.round((L - 1) * cdfAtR);
  const slope = (L - 1) * probAtR;

  return [
    {
      id: 'eq-continuous-def',
      title: 'Continuous Equalization Transformation',
      latex: `s = T(r) = (L - 1) \\int_0^r p_r(w) \\, dw = (L - 1) \\cdot c_r(r)`,
      substituted: `s = (${L} - 1) \\cdot ${formatNum(cdfAtR, 4)} = ${mappedS}`,
      rationale: 'The transformation function is strictly the scaled Cumulative Distribution Function (CDF).',
      value: mappedS,
      highlight: { plot: 'cdf', kind: 'point', at: probedR },
    },
    {
      id: 'eq-ftc-deriv',
      title: 'Derivative via Fundamental Theorem of Calculus',
      latex: `\\frac{dT}{dr} = \\frac{d}{dr}\\left[(L-1) \\int_0^r p_r(w)\\,dw\\right] = (L - 1) \\cdot p_r(r)`,
      substituted: `\\frac{dT}{dr} = (${L} - 1) \\cdot ${formatNum(probAtR, 5)} = ${formatNum(slope, 3)}`,
      rationale: 'The slope of the transformation curve at intensity r is directly proportional to the probability density p_r(r).',
      value: slope,
      highlight: { plot: 'curve', kind: 'tangent', at: probedR },
    },
    {
      id: 'eq-uniform-proof',
      title: 'Proof: Output Probability Density is Strictly Uniform',
      latex: `p_s(s) = p_r(r) \\cdot \\left| \\frac{dr}{ds} \\right| = p_r(r) \\cdot \\frac{1}{\\frac{ds}{dr}} = p_r(r) \\cdot \\frac{1}{(L-1) \\cdot p_r(r)} = \\frac{1}{L - 1}`,
      substituted: `p_s(s) = \\frac{1}{${L} - 1} = \\frac{1}{255} \\approx ${formatNum(1 / (L - 1), 5)}`,
      rationale: 'Because p_r(r) cancels out identically, the resulting continuous random variable s is perfectly uniform!',
      value: 1 / (L - 1),
    },
    {
      id: 'eq-discrete-reality',
      title: 'Discrete Image Reality & Quantization',
      latex: `s_k = \\text{round}\\left((L - 1) \\sum_{j=0}^k p_r(r_j)\\right) = \\text{round}\\left((L - 1) \\sum_{j=0}^k \\frac{n_j}{MN}\\right)`,
      substituted: `s_{${probedR}} = \\text{round}(255 \\cdot ${formatNum(cdfAtR, 4)}) = ${mappedS}`,
      rationale: 'In digital images, intensities are integers; no new intensity levels can be created, leading to merged bins and discrete gaps.',
      value: mappedS,
      highlight: { plot: 'histogram', kind: 'point', at: mappedS },
    },
  ];
}

/**
 * Generates discrete step-by-step CDF evaluation for a specific pixel
 */
export function buildDiscreteCDFSteps(
  r: number,
  count: number,
  totalPixels: number,
  cumCount: number,
  L: number = 256
): Step[] {
  const prob = totalPixels > 0 ? count / totalPixels : 0;
  const cdfVal = totalPixels > 0 ? cumCount / totalPixels : 0;
  const s = Math.round((L - 1) * cdfVal);

  return [
    {
      id: 'discrete-count',
      title: 'Pixel Frequency Count',
      latex: `n_k = h(r_k) \\quad \\text{at } r = ${r}`,
      substituted: `n_{${r}} = ${count} \\text{ pixels out of } MN = ${totalPixels}`,
      rationale: `Histogram count at intensity level r = ${r}.`,
      value: count,
      highlight: { plot: 'histogram', kind: 'point', at: r },
    },
    {
      id: 'discrete-prob',
      title: 'Normalized Probability (PDF)',
      latex: `p_r(r_k) = \\frac{n_k}{M \\cdot N}`,
      substituted: `p_r(${r}) = \\frac{${count}}{${totalPixels}} = ${formatNum(prob, 5)}`,
      rationale: 'Probability of a randomly chosen pixel possessing intensity r.',
      value: prob,
      highlight: { plot: 'pdf', kind: 'point', at: r },
    },
    {
      id: 'discrete-cdf',
      title: 'Cumulative Sum (CDF)',
      latex: `c_r(r_k) = \\sum_{j=0}^k p_r(r_j) = \\frac{1}{MN} \\sum_{j=0}^k n_j`,
      substituted: `c_r(${r}) = \\frac{${cumCount}}{${totalPixels}} = ${formatNum(cdfVal, 4)}`,
      rationale: `Running total of probabilities for all intensities up to and including ${r}.`,
      value: cdfVal,
      highlight: { plot: 'cdf', kind: 'point', at: r },
    },
    {
      id: 'discrete-map',
      title: 'Equalized Intensity Mapping',
      latex: `s_k = \\text{round}\\left((L - 1) \\cdot c_r(r_k)\\right)`,
      substituted: `s_{${r}} = \\text{round}(255 \\cdot ${formatNum(cdfVal, 4)}) = ${s}`,
      rationale: `Maps input intensity ${r} to equalized output intensity ${s}.`,
      value: s,
      highlight: { plot: 'curve', kind: 'point', at: s },
    },
  ];
}
