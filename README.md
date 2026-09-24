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
