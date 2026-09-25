# DIP Lab — Interactive Visual Learning Platform

> A minimalist, interactive platform designed to teach Digital Image Processing (DIP) concepts and mathematical foundations through live, manipulable visuals.

Built according to the architectural specification in `guide.md`.

---

## Vision & Key Highlights

- **Direct Manipulation Over Reading:** Learn concepts by dragging sliders and seeing live plots and images update within one animation frame (<16ms for curves, <50ms for image operations).
- **Generative Mathematical Engine:** Step-by-step calculus derivations (e.g. power-law and logarithmic derivatives, Fundamental Theorem of Calculus proofs, discrete cumulative sums) computed live from actual slider parameters.
- **Progressive Disclosure:** One persistent **Beginner ⇄ Advanced** segmented control:
  - *Beginner:* Clean intuition, analogies, essential controls.
  - *Advanced:* Formal mathematical notation, generative step-by-step derivations in the Advanced Drawer, derivative tangents, and rigorous statistical metrics.
- **Linked Selection:** Hovering a pixel in the canvas highlights its bin on the histogram and its point on the transformation curve; brushing a range on the histogram masks matching pixels on the image.

---

## Curriculum Structure

### Unit 1 — Digital Image Fundamentals
1. **Digital Image** (`digital-image`): Continuous 2D light scenes, spatial sampling grid ($N \times N$), quantization depth ($k$ bits), and storage calculation.
2. **Grayscale Image** (`grayscale-image`): Spectral color channels vs. scalar luminance, perceptual weights ($Y = 0.299R + 0.587G + 0.114B$).
3. **Pixel Intensity** (`pixel-intensity`): Localized brightness probes, interactive horizontal scanline profiles, local neighborhood statistics.
4. **8-bit Image / Intensity Levels** (`intensity-levels`): Bit-depth reduction from 8-bit down to 1-bit, false contouring / posterization, staircase plots, live MSE & PSNR.
5. **Image Representation as a Matrix** (`image-as-matrix`): Zoomable $M \times N$ matrix grid with editable intensity cells, heatmap mode, and scalar matrix operations.
6. **Intensity Transformation** (`intensity-transformation`): Point transformations $s = T(r)$ (Gamma, Log, Negative), symbolic derivative derivations $ds/dr$, and slope contrast interpretation.
7. **Image Histogram** (`image-histogram`): Frequency counts $h(r_k) = n_k$, statistical moments, Shannon entropy, and range brush masking.
8. **Probability Distribution of Intensities** (`intensity-probability`): Monte Carlo random pixel sampling convergence to the true probability distribution.
9. **Probability Density Function (PDF)** (`pdf`): Continuous distribution $p_r(r)$, Gaussian kernel smoothing, interval $[a, b]$ shaded area probability integration.
10. **Cumulative Distribution Function (CDF)** (`cdf`): Running sum $c(r) = P(R \le r)$, monotonicity, and tangent slope relationship $dc/dr = p(r)$.

### Unit 2 — Histogram Processing
11. **Histogram Equalization** (`histogram-equalization`): Contrast expansion using scaled CDF, blend control, and before/after histograms.
12. **Equalization Mapping Function** (`equalization-mapping`): Proof that output density is uniform using the Fundamental Theorem of Calculus.
13. **Normalized Histogram** (`normalized-histogram`): Resolution scaling and invariance of normalized probabilities ($p(r_k) = n_k / MN$).
14. **Histogram Transformation** (`histogram-transformation`): Transformation of random variables $p_s(s) = p_r(r) |dr/ds|$ and bin flow dynamics.
15. **Inverse Transformation** (`inverse-histogram-transformation`): Algebraic inverse $r = T^{-1}(s)$, reflection across $y = x$, and round-trip error map.
16. **Histogram Matching** (`histogram-matching`): Transforming image distribution to match custom targets using two-stage equalization.
17. **Histogram Specification** (`histogram-specification`): Parametric Gaussian mixture target designer and discrete residual calculation.
18. **CDF Matching** (`cdf-matching`): Interactive staircase walk aligning source CDF to target CDF.
19. **Global Histogram Processing** (`global-histogram-processing`): Limitations of global LUTs on uneven lighting scenes and washout artifacts.
20. **Local vs. Global (CLAHE)** (`local-vs-global`): Adaptive tile histogram equalization, clip limit redistribution, and bilinear interpolation blending.

### Unit 3 — Spatial Filtering
21. **Spatial Filtering** (`spatial-filtering`): Output pixels computed from a pixel *and* its neighbours via a kernel, not the pixel alone.
22. **Neighborhood Processing** (`neighborhood-processing`): Sliding an n×n window over the image so local context — not just the single pixel — decides the result.
23. **Kernel / Mask** (`kernel-mask`): A small weight matrix; zero-sum vs. unit-sum kernels and what each implies about brightness/high-pass behaviour.
24. **Convolution / Filtering** (`convolution-filtering`): Multiply–add at a probed pixel, correlation vs. true (kernel-flipped) convolution.
25. **Box Filter** (`box-filter`): Every neighbour weighted equally — the simplest possible blur, with/without 1/n² normalization.
26. **Mean / Averaging Filter** (`mean-filter`): Neighbourhood averaging to cancel independent noise; live PSNR climb as kernel size grows.
27. **Smoothing** (`smoothing`): Low-pass filtering in general — box vs. Gaussian denoising compared on identical noise.
28. **Gaussian Filtering** (`gaussian-filtering`): Distance-weighted neighbours via a bell-shaped kernel; σ controls reach.
29. **Gaussian Function** (`gaussian-function`): The bell curve itself — peak value, FWHM, and its derivative (slope).
30. **Gaussian Weighting** (`gaussian-weighting`): Compute one kernel entry from Δx, Δy and σ — "greater distance ⇒ smaller weight."
31. **Gaussian Smoothing** (`gaussian-smoothing`): σ-tunable denoising; separability into two 1-D passes; composing two Gaussian blurs.
32. **Edge Blurring** (`edge-blurring`): The cost of smoothing — a sharp step edge becomes a ramp, measured via 10–90% rise distance.

### Unit 4 — Bilateral Filtering
33. **Bilateral Filtering** (`bilateral-filtering`): Fixes Unit 3's edge-blurring problem by combining a spatial weight *and* an intensity-similarity weight.
34. **Spatial Weight** (`spatial-weight`): "How far away is this neighbour?" — the purely geometric half of the bilateral weight, identical to Gaussian filtering.
35. **Range / Intensity Weight** (`range-weight`): "How similar is this neighbour's brightness?" — the new ingredient that lets the filter sense edges.
36. **Spatial Standard Deviation σₛ** (`spatial-sigma`): How far the spatial weight reaches, in pixels.
37. **Range Standard Deviation σᵣ** (`range-sigma`): How tolerant the filter is to brightness gaps; σᵣ → ∞ collapses bilateral filtering into plain Gaussian filtering.
38. **Bilateral Weight** (`bilateral-weight`): The product w(i,j)·φ(i,j) — a neighbour must be close *and* similar to count.
39. **Edge-Preserving Smoothing** (`edge-preserving-smoothing`): Side-by-side with Unit 3's edge-blurring lab — the same edge now survives filtering.
40. **Patch-Based Comparison** (`patch-based-comparison`): Comparing small neighbourhoods (SSD) instead of single noisy pixels for a robust similarity score.
41. **Patch** (`patch`): The formal definition — a fixed-size window of pixels used as a pixel's local signature.

### Unit 5 — Image Formation & Enhancement
42. **Retinex** (`retinex`): Recovering how a surface truly looks regardless of lighting, by separating an image into illumination × reflectance.
43. **Illumination** (`illumination`): L(x,y) — the slow-varying light falling on a scene, estimated here via wide Gaussian smoothing.
44. **Reflectance** (`reflectance`): R(x,y) — the surface's own, lighting-independent property, recovered as R = I / L.
45. **Illumination–Reflectance Model** (`illumination-reflectance-model`): I = L·R, and why taking logarithms turns the product into a separable sum.
46. **Gamma Correction** (`gamma-correction`): Why brightness needs a nonlinear (not additive) fix, with a live power-law curve and derivative tangent.
47. **Gamma Transformation** (`gamma-transformation`): s = c·rᵞ derived and probed — γ<1 brightens, γ=1 is identity, γ>1 darkens.
48. **Power-Law Transformation** (`power-law-transformation`): The general curve family gamma correction belongs to; sweep γ and compare against histogram equalization.

---

The curriculum currently spans **5 units and 48 interactive labs**, from raw pixel sampling through histogram processing, spatial/edge-preserving filtering, and image formation & enhancement (Retinex, gamma).

---

## Tech Stack

- **Framework:** React 18 + TypeScript + Vite
- **Routing:** React Router v6
- **Styling:** Tailwind CSS with custom design tokens (light `#FAFAF7`, dark `#111214`, accent `#5B5BF0`, secondary `#F0895B`)
- **State Management:** Zustand (viewMode, theme, linked selection)
- **Math Typography:** KaTeX
- **Plots & Canvas:** Custom high-performance SVG line/bar/area plots + Canvas 2D
- **Icons:** Lucide React
- **Testing:** Node.js native test runner (`node:test`)

---

## Getting Started

### Development
```bash
npm install
npm run dev
```

### Production Build
```bash
npm run build
```

### Run Tests
```bash
npm test
```

---

## Author & Attribution

Made for students, learners, and dreamers by [**Shuvam Vidyarthy**](https://www.linkedin.com/in/shuvam-vidyarthy/)
