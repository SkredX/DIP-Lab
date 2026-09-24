# guide.md — Interactive Visual Learning Platform

> A minimalist platform that teaches concepts through live, manipulable visuals.
> Initial curriculum: **Digital Image Fundamentals** and **Histogram Processing** (20 topics).
> This document is written to be handed to coding LLMs. Follow phases in order; each phase has acceptance criteria.

---

## 0. How to use this guide (instructions for the coding LLM)

1. Read sections 1–6 fully before writing code. They define product, design, architecture, and contracts.
2. Build in the phase order of Section 12. Do not start a phase until the previous phase's acceptance criteria pass.
3. Every topic lab is a **plug-in** that conforms to the `LabModule` contract (Section 6). Never hard-code a topic into the shell.
4. All math shown in Advanced view must be **computed from live state**, never hard-coded strings (Section 8).
5. Prefer small, typed, tested modules. Ask for clarification only when a requirement is genuinely ambiguous; otherwise state the assumption in a code comment and proceed.
6. Design reference: "Koji from Brilliant" is interpreted as Brilliant's clean, friendly, low-clutter aesthetic (generous whitespace, one focal visual, soft rounded shapes, playful but restrained). If a small mascot/guide element is used, keep it optional and tiny.

---

## 1. Product vision

| Item | Definition |
|---|---|
| Goal | Learn a concept by *touching it*: drag a slider, watch the curve/image respond instantly. |
| Audience | Beginners (intuition first) through advanced students (derivations, proofs). |
| Core loop | Pick topic card → open lab → manipulate parameters → see live plot + image update → (optional) flip to Advanced for the math. |
| Differentiator | Advanced math is **generative**: step-by-step solutions computed for the current parameters, not static text. |
| Non-goals (v1) | User accounts, payments, social features, server-side compute, mobile-native apps. |

### Principles
- **One idea per screen.** Each lab has one hero visual.
- **Direct manipulation over reading.** Text is short; the visual carries the lesson.
- **Real-time or it doesn't count.** Slider input → updated plot within one animation frame (target < 16 ms for plots, < 50 ms for image ops on 512×512).
- **Progressive disclosure.** Beginner = intuition. Advanced = notation, derivations, edge cases.

---

## 2. Tech stack (recommended, swap only with reason)

| Concern | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** (static export friendly) | Routing per topic, easy deploy. Vite + React Router is an acceptable alternative. |
| Styling | **Tailwind CSS** + CSS variables for design tokens | Fast, consistent minimal UI. |
| State | **Zustand** (global: view mode, theme) + local component state per lab | Simple, no boilerplate. |
| Plots | Custom **SVG** for curves (React + d3-scale/d3-shape), **Canvas 2D** for images/heatmaps | Full control, crisp, fast. Avoid heavy chart libs. |
| Animation | **Framer Motion** (UI) + `requestAnimationFrame` loops (plots) | Smooth transitions. |
| Math rendering | **KaTeX** | Fast LaTeX rendering. |
| Symbolic math (derivatives etc.) | Custom **rule-based Step Engine** on top of `mathjs` AST (see Section 8) | Needed to emit *steps*, which CAS libs don't give. |
| Heavy compute | **Web Workers** (+ `OffscreenCanvas` where supported) | Keep UI thread free for sliders. |
| Testing | **Vitest** (unit/golden), **Playwright** (e2e + visual), `axe` (a11y) | Correctness of numeric + math output. |
| Lint/format | ESLint, Prettier, strict TS (`"strict": true`) | Quality gate. |

Optional (Phase 7): LLM narration layer that *rephrases* deterministic steps. Deterministic engine remains the source of truth.

---

## 3. Information architecture & routes

```
/                       Landing: index of topic cards (grouped by unit)
/topic/[slug]           Interactive lab for one topic
/about                  (optional) short project page
```

- Deep-linkable state: `/topic/histogram-equalization?view=advanced&gamma=0.6&img=lowContrast`. Encode key params in the query string (debounced, `history.replaceState`).
- Previous / Next topic controls at bottom of every lab (follows registry order).
- Keyboard: `Esc` → back to index, `←/→` → prev/next topic, `A` → toggle Advanced, `R` → reset lab.

---

## 4. UI / UX specification

### 4.1 Global layout
- **Top bar (all pages):** left = wordmark/back arrow; center = breadcrumb (`Unit › Topic`) on lab pages; **right = Beginner ⇄ Advanced toggle** (persistent on every page) + theme toggle (light/dark).
- **Landing page:** centered column, max width ~1100 px. Sections per unit (e.g., "Digital Image Fundamentals", "Histogram Processing"). Each section = responsive grid of **topic cards** (1 col mobile, 2 tablet, 3–4 desktop).
- **Lab page:** two-region layout on desktop.
  - **Left/main (≈65%)**: *Stage* — hero visual(s): image panels + live plot(s).
  - **Right/side (≈35%)**: *Control & Explain panel* — controls at top, explanation below.
  - Mobile: stage on top, controls below in a bottom sheet.
- **Advanced view** adds an **Advanced Drawer** (below the stage on mobile, right-side tab on desktop) containing the generative math. Beginner view never renders it.

### 4.2 Topic card (landing)
- Elements: small **animated thumbnail** (tiny live micro-visual, e.g., a mini histogram that breathes; pause when off-screen and when `prefers-reduced-motion`), title, one-line hook, unit tag, optional "difficulty dots".
- Hover: subtle lift + thumbnail speeds up. Click: route to lab.
- Cards are generated from the **Topic Registry** (Section 5). No hand-built card markup per topic.

### 4.3 Beginner ⇄ Advanced toggle (top-right)
- Segmented control: `Beginner | Advanced`. Persist in `localStorage` (`viewMode`), sync to URL `?view=`.
- Switching **must not reset lab state**. Animate the Advanced Drawer in/out (200–250 ms).
- What changes:

| Aspect | Beginner | Advanced |
|---|---|---|
| Copy | Plain-language intuition, analogies | Formal definitions, notation |
| Controls | Core sliders only | + extra parameters (bins, L, kernel, clip limit, numeric precision) |
| Plot annotations | Minimal, friendly labels | + axes ticks, exact values, derivative overlays, integral shading |
| Math | Hidden | **Generative step-by-step solutions** in Advanced Drawer |
| Data readouts | Simple ("brighter") | Numeric ("r = 87, s = 141, T'(r) = 1.42") |

### 4.4 Design system (minimalism)
- **Tokens (CSS variables):**
  - Background `#FAFAF7` / dark `#111214`; surface `#FFFFFF` / `#1A1C1F`; text `#1B1B1F` / `#ECECEF`; muted `#6B6F76`.
  - One **accent** (e.g., `#5B5BF0`) for the primary curve/active control; one **secondary** (e.g., `#F0895B`) for comparison curves ("after"); neutral greys elsewhere. No gradients except thumbnails.
  - Radius: 14–20 px (soft). Border: 1 px hairline. Shadow: extremely subtle, only on hover.
- **Typography:** one sans family (Inter or similar). Sizes: 14 (body), 16 (lead), 24–32 (titles). Monospace only for numeric readouts. Math in KaTeX.
- **Spacing:** 8 px grid. Generous padding; avoid borders-within-borders.
- **Motion:** 150–250 ms ease-out; never bounce on data. Respect `prefers-reduced-motion`.
- **Sliders:** large hit area (≥ 40 px), value bubble while dragging, keyboard-accessible (arrow keys), double-click resets to default. Show units.
- **Plots:** thin (2 px) curves, light gridlines, axis labels in muted color, animated path morph between states (interpolate, don't jump) for discrete actions (presets, image swap).
- **Accessibility:** WCAG AA contrast, focus rings, ARIA labels on all controls, live-region announcements for key readouts, curves distinguishable by dash pattern (not only color).

---

## 5. Topic Registry (single source of truth)

Every topic is described by metadata; the landing page and router consume it.

```ts
// src/content/registry.ts
export type Unit = { id: string; title: string; order: number };

export type TopicMeta = {
  slug: string;                 // 'histogram-equalization'
  title: string;                // 'Histogram Equalization'
  hook: string;                 // one-line card copy
  unitId: string;               // 'histogram-processing'
  order: number;                // global order within unit
  prerequisites: string[];      // slugs
  thumbnail: 'histogram' | 'curve' | 'matrix' | 'levels' | 'cdf' | string; // key into thumbnail components
  load: () => Promise<{ default: LabModule }>; // dynamic import (code-split per lab)
};
```

Adding a topic = add a folder under `src/labs/<slug>/` + one registry entry. **No other file should need editing.**

### Initial registry contents

**Unit 1 — Digital Image Fundamentals**
1. `digital-image` — Digital Image
2. `grayscale-image` — Grayscale Image
3. `pixel-intensity` — Pixel Intensity
4. `intensity-levels` — 8-bit Image / Intensity Levels
5. `image-as-matrix` — Image Representation as a Matrix
6. `intensity-transformation` — Intensity Transformation
7. `image-histogram` — Image Histogram
8. `intensity-probability` — Probability Distribution of Intensities
9. `pdf` — Probability Density Function
10. `cdf` — Cumulative Distribution Function

**Unit 2 — Histogram Processing**
11. `histogram-equalization` — Histogram Equalization
12. `equalization-mapping` — Histogram Equalization Mapping Function
13. `normalized-histogram` — Normalized Histogram
14. `histogram-transformation` — Histogram Transformation
15. `inverse-histogram-transformation` — Inverse Histogram Transformation
16. `histogram-matching` — Histogram Matching
17. `histogram-specification` — Histogram Specification
18. `cdf-matching` — CDF Matching
19. `global-histogram-processing` — Global Histogram Processing
20. `local-vs-global` — Local Information vs. Global Information

Prerequisite chain (drives "unlock hints", not hard locks in v1): 1→2→3→4→5→6→7→8→9→10→(11,12,13)→14→15→16→17→18→19→20.

---

## 6. Architecture & contracts

### 6.1 Folder structure

```
/src
  /app                      Next.js routes (/, /topic/[slug])
  /components
    /shell                  TopBar, ViewToggle, ThemeToggle, TopicCard, LabLayout, AdvancedDrawer
    /controls               Slider, Stepper, Toggle, SegmentedControl, ImagePicker, CurveEditor, RangeBrush
    /plots                  LinePlot, BarPlot (histogram), AreaPlot, CurveEditorPlot, Heatmap, PixelGrid
    /math                   Katex, StepList, StepCard, ValueChip
  /content
    registry.ts             Units + TopicMeta
    copy/                   Beginner/Advanced copy per topic (MDX or TS objects)
  /engine
    /image                  ImageBuffer, grayscale, histogram, cdf, transforms, equalize, match, clahe
    /math                   StepEngine, rules (derivative, integral, sum, substitution), formatters
    /workers                imageWorker.ts (+ comlink wrappers)
    /assets                 procedural + bundled sample images
  /labs
    /<slug>/index.tsx       exports LabModule
    /<slug>/steps.ts        generative math for that topic
    /<slug>/thumbnail.tsx   card micro-visual
  /state                    viewMode store, theme store, url-sync hooks
  /styles                   tokens.css, globals.css
  /tests                    unit, golden, e2e
```

### 6.2 `LabModule` contract (every topic implements this)

```ts
export type Param =
  | { id: string; kind: 'slider'; label: string; min: number; max: number; step: number; default: number; unit?: string; advancedOnly?: boolean }
  | { id: string; kind: 'toggle'; label: string; default: boolean; advancedOnly?: boolean }
  | { id: string; kind: 'select'; label: string; options: { value: string; label: string }[]; default: string; advancedOnly?: boolean };

export type LabModule = {
  meta: { slug: string };
  params: Param[];                                   // declarative controls; shell renders them
  Stage: React.FC<StageProps>;                       // hero visuals; receives params + imageCtx
  Explain: React.FC<{ mode: 'beginner' | 'advanced'; params: ParamValues }>; // short copy
  buildSteps?: (input: StepInput) => Step[];         // Advanced generative math (Section 8)
  presets?: { label: string; params: Partial<ParamValues> }[];
};
```

The **LabLayout** shell:
- reads `params` → renders controls (hiding `advancedOnly` in Beginner),
- holds `paramValues` state, passes to `Stage`,
- calls `buildSteps` (memoized, debounced 60–100 ms while dragging; immediate on release) only when Advanced is on,
- provides `imageCtx` (current image buffer, histogram, cdf via shared cache).

### 6.3 Image Engine (framework-agnostic, pure TS)

```ts
type Gray = { w: number; h: number; data: Uint8ClampedArray; L: number }; // L = 2^bits (default 256)

histogram(img: Gray, bins?: number): Uint32Array          // h(r_k) = n_k
normalize(h: Uint32Array, n: number): Float64Array        // p(r_k) = n_k / MN
cdf(p: Float64Array): Float64Array                        // c(r_k) = Σ p(r_j)
applyLUT(img: Gray, lut: Uint8ClampedArray): Gray
lutFromFn(T: (r:number)=>number, L: number): Uint8ClampedArray
equalizeLUT(cdf, L): Uint8ClampedArray                    // round((L-1) * cdf)
matchLUT(cdfSrc, cdfTgt, L): Uint8ClampedArray            // s = G^{-1}(T(r))
invertMonotone(lut): Uint8ClampedArray                    // handles non-invertible w/ nearest rule + flags
localEqualize(img, {tile, clip, interpolate}): Gray        // AHE / CLAHE
quantize(img, bits): Gray
toGray(rgb, weights): Gray
```

- All functions pure; unit-tested against reference implementations (NumPy / OpenCV values stored as golden JSON).
- LUT-based processing: compute LUT (256 entries), then apply — makes slider drags real-time.
- Heavy ops (large images, CLAHE) run in a worker; UI shows previous frame until new one is ready (never blank).

### 6.4 Shared state per lab
`{ image, paramValues, derived: { hist, pdf, cdf, lut, out } }` with a memoized derive pipeline; recompute only the stages whose inputs changed.

### 6.5 Sample images
- Ship procedural images (no licensing issues): **dark**, **bright**, **low-contrast**, **high-contrast**, **bimodal**, **gradient**, **checker**, **noise**, **local-lighting (shadow + highlight)**.
- Plus 2–3 CC0/public-domain photos (verify license), and **user upload** (drag-drop, client-side only, downscale to ≤ 512 px longest side, convert to grayscale for grayscale-only labs).

---

## 7. Interactive plot requirements

- **Real-time binding:** slider `onInput` (not `onChange`) → state → plot.
- **Path morphing:** curves animate between presets/images with interpolation (~200 ms); during drag no animation lag (direct set).
- **Linked views:** hovering a pixel in the image highlights its bin in the histogram and its point on the transformation curve; brushing a histogram range highlights matching pixels in the image (via mask overlay). Build a shared `useLinkedSelection()` hook.
- **Overlays (Advanced):** derivative tangent line, area shading for integrals/probabilities, numeric tooltips, identity line `s = r`.
- **Curve editor:** draggable control points (monotone cubic interpolation, clamps to `[0, L-1]`), add/remove points, presets (negative, log, gamma, sigmoid, identity).
- **Performance budget:** 256-point curves re-render < 4 ms; image LUT apply on 512×512 < 10 ms on main thread or offloaded; no layout thrash.

---

## 8. Generative math (Advanced view) — the Step Engine

### 8.1 Requirement
Advanced view shows a **step-by-step solution computed from the current state**. Changing a slider changes the numbers and, where relevant, the *structure* of the steps. Example: for `s = c·r^γ`, the drawer shows the derivative worked out with the user's actual `c` and `γ`.

### 8.2 Data model

```ts
type Step = {
  id: string;
  title: string;                 // "Apply the power rule"
  latex: string;                 // "\\frac{d}{dr}\\left(c\\,r^{\\gamma}\\right)=c\\gamma r^{\\gamma-1}"
  substituted?: string;          // same expression with live numbers plugged in
  rationale?: string;            // one short sentence, plain English
  value?: number | number[];     // numeric result, for chips / plot linking
  highlight?: { plot: string; kind: 'point' | 'range' | 'tangent'; at: number | [number, number] }; // link to plot
};
type StepInput = { params: ParamValues; image: Gray; derived: Derived };
```

### 8.3 Engine design
1. **Expression layer:** parse the topic's formula (e.g., via `mathjs.parse`) into an AST *or* build ASTs programmatically.
2. **Rule layer** (`/engine/math/rules`): each rule = `{ name, matches(node), apply(node) → {result, latex, rationale} }`. Ship rules for: constant, power, sum/difference, constant-multiple, product, quotient, chain, exp, ln/log, and simple polynomial integrals; summation expansion; algebraic simplification.
3. **Solver loop:** repeatedly find the first applicable rule, record a `Step`, replace the node, until no rule applies; then simplify and emit final step.
4. **Substitution layer:** evaluate the final symbolic result at the live parameter values and current `r` (from hover/probe) to produce `substituted` and `value`.
5. **Formatter:** AST → LaTeX (custom or `mathjs` `toTex`) with consistent notation (`r`, `s`, `L`, `p_r(r_k)`, `c(r_k)`).
6. **Discrete/data-driven solvers** (histograms/CDFs): produce steps from real arrays, e.g., "n_k = 120 → p = 120/(M·N) = 0.0018 → running sum = 0.4123 → s_k = round(255 · 0.4123) = 105".
7. **Determinism & tests:** each `buildSteps` has golden tests; final numeric value must equal the engine's own computed value (assert `steps.at(-1).value ≈ engine result`).

### 8.4 UI
- `AdvancedDrawer` → `StepList` → `StepCard` (title, KaTeX line, substituted line, rationale).
- Steps reveal sequentially with a "▶ Step through" control and "Show all". Clicking a step highlights the linked plot element (`highlight`).
- Copy button per step (LaTeX).
- If the formula is degenerate for current params (e.g., γ = 0), show a special-case step ("constant function") — the engine must handle edge cases, not crash.

### 8.5 Optional LLM narration (Phase 7)
- Send the deterministic `Step[]` to an LLM to rewrite `rationale` in friendlier wording. **Never let the LLM change numbers/LaTeX.** Validate by re-checking numeric tokens before display; fall back to deterministic text on mismatch.

---

## 9. Topic-by-topic lab specifications

Format per topic: **Concept · Beginner view · Controls · Live plot/visual · Advanced generative math · Engine needs**.
Default image = user-selectable from the sample set. "Linked" = uses the linked-selection hook.

### Unit 1 — Digital Image Fundamentals

#### 1. Digital Image (`digital-image`)
- **Concept:** an image is a sampled + quantized version of a continuous scene, `f(x,y)`.
- **Beginner:** a smooth "continuous" scene (procedural function) next to its pixelated version.
- **Controls:** Sampling resolution (N×N: 4→256, log slider); Quantization bits (1→8).
- **Visual:** left = continuous (rendered at high res), right = digital; a draggable "magnifier" shows pixel squares.
- **Advanced:** sampling interval Δx = W/N steps, quantization step Δ = 256/L, storage size = M·N·k bits — all computed live. Show aliasing note when N is low (Nyquist criterion demo with a striped scene).
- **Engine:** procedural scene function, `resample`, `quantize`.

#### 2. Grayscale Image (`grayscale-image`)
- **Concept:** one intensity value per pixel vs. three color channels.
- **Beginner:** color image → grayscale morph with a "color amount" slider (0–100%).
- **Controls:** Weights preset (average / luminance / custom), R,G,B weight sliders (Advanced), channel isolate toggle.
- **Visual:** original, grayscale, and 3 small channel previews; mini plot of contribution per channel for the probed pixel.
- **Advanced:** `Y = w_R R + w_G G + w_B B` with the probed pixel's numbers substituted; normalization check `Σw = 1`; comparison average vs. luminance (0.299/0.587/0.114).
- **Engine:** `toGray`.

#### 3. Pixel Intensity (`pixel-intensity`)
- **Concept:** a pixel's value = brightness at one location.
- **Beginner:** hover/tap any pixel → big swatch, number, and a black→white bar with a marker.
- **Controls:** Probe (hover/tap), Brightness offset slider for a painted brush region, brush size.
- **Visual:** image + intensity bar + a **line profile plot** (intensity along a draggable line across the image).
- **Advanced:** notation `f(x₀,y₀) = r`; profile as function `f(t)`; local mean/variance of a k×k neighborhood computed step by step.
- **Engine:** pixel probe, line profile, neighborhood stats.

#### 4. 8-bit Image / Intensity Levels (`intensity-levels`)
- **Concept:** `L = 2^k` gray levels; fewer bits → banding/posterization.
- **Beginner:** slider from 8 bits down to 1 bit; image visibly bands.
- **Controls:** Bits k (1–8); Dithering toggle (Advanced).
- **Visual:** image before/after; **staircase plot** of `s = quantize(r)` vs. `r` (identity line dashed); palette strip of the L levels.
- **Advanced:** `L = 2^k`, `Δ = 256/L`, `s = ⌊r/Δ⌋·Δ + Δ/2` (or chosen rule) with the probed pixel's numbers; count of unique levels present; MSE/PSNR vs. original computed live.
- **Engine:** `quantize`, `mse`, `psnr`.

#### 5. Image Representation as a Matrix (`image-as-matrix`)
- **Concept:** an image is an M×N matrix of intensities.
- **Beginner:** zoom into a small region; pixels become numbered cells. Edit a cell value → the pixel changes.
- **Controls:** Region size (4×4→16×16), Zoom, Show numbers toggle, Heatmap toggle, sliding window position.
- **Visual:** image with region box ↔ matrix grid (editable) ↔ 3D-ish bar/heat view (optional).
- **Advanced:** indexing `f(x,y)`, dimensions `M×N`, memory `M·N·k/8` bytes, matrix operations demo (add constant = brightness, scalar multiply = contrast) with the shown matrix updated element-wise; row/column vectors; `F = [f(i,j)]`.
- **Engine:** region extraction, matrix ops.

#### 6. Intensity Transformation (`intensity-transformation`)
- **Concept:** `s = T(r)` maps input intensity to output intensity, pixel by pixel.
- **Beginner:** a transformation curve you can pick from presets (identity, negative, log, gamma, contrast stretch) and drag; image updates live.
- **Controls:** Preset select; `c`, `γ`, stretch points `(r1,s1),(r2,s2)`; free-form curve editor (Advanced).
- **Visual:** original image | transformed image; curve `T(r)` with identity line; **linked**: hovering a pixel shows `(r, s)` on curve. Mini histograms before/after (Advanced).
- **Advanced generative math:**
  - Negative: `s = L−1−r`; Log: `s = c·log(1+r)`, with `c = (L−1)/log(L)` computed; Gamma: `s = c·r^γ`.
  - **Derivative solved step-by-step** (`ds/dr`): e.g., `d/dr[c r^γ] = cγ r^{γ−1}` with rules named; evaluate at probed `r`; interpret (slope > 1 stretches contrast, < 1 compresses).
  - Inverse relation when it exists.
- **Engine:** `lutFromFn`, `applyLUT`, Step Engine derivative rules (power, log, sum, constant multiple).

#### 7. Image Histogram (`image-histogram`)
- **Concept:** `h(r_k) = n_k`, count of pixels at each intensity.
- **Beginner:** bar chart that grows as you "paint" pixels or switch images; dark image → bars on the left.
- **Controls:** Image picker; Bin count (256/128/64/32/16, Advanced allows any divisor); Brightness/contrast sliders that shift/stretch the histogram live; Range brush (selects bins → highlights pixels).
- **Visual:** image (with brush mask overlay) + histogram (linked).
- **Advanced:** `h(r_k)=n_k`, `Σ n_k = MN`, mean `μ = Σ r_k p(r_k)`, variance, entropy — step-by-step with real numbers; bin width effect `Δ = L/bins`.
- **Engine:** `histogram`, stats.

#### 8. Probability Distribution of Intensities (`intensity-probability`)
- **Concept:** treat intensity as a random variable; `p(r_k) = n_k / MN`.
- **Beginner:** "Pick a random pixel" button — animates a pixel being drawn, dropping a dot in the histogram; after many draws the dots converge to the distribution.
- **Controls:** Number of samples (1→10,000), Sampling speed, Show theoretical toggle.
- **Visual:** empirical vs. true `p(r_k)`; convergence plot (max error vs. samples).
- **Advanced:** normalization check `Σ p = 1`; expected value `E[r]`, variance, `P(a ≤ r ≤ b)` for a brushed range, computed as summed terms with actual numbers.
- **Engine:** `normalize`, seeded RNG sampling.

#### 9. PDF (`pdf`)
- **Concept:** continuous limit of the normalized histogram; area under curve = 1; probability = area between bounds.
- **Beginner:** shrink the bin width and watch bars smooth into a curve; drag two handles to shade an area = probability.
- **Controls:** Bin width slider (coarse → fine), Smoothing bandwidth (KDE), Range handles `[a,b]`.
- **Visual:** histogram bars morphing into smooth PDF; shaded area with live probability readout.
- **Advanced:** `p_r(r) ≥ 0`, `∫ p_r(r) dr = 1`; `P(a≤r≤b)=∫_a^b p_r(r)dr` solved as numeric integral steps (trapezoid/Riemann sum with actual sub-interval values); optional analytic case using a fitted Gaussian: integrate step-by-step with substitution.
- **Engine:** KDE, numeric integration, Gaussian fit.

#### 10. CDF (`cdf`)
- **Concept:** `c(r) = P(R ≤ r)`, running total of the PDF; monotone from 0 to 1.
- **Beginner:** PDF on top, CDF underneath; drag a vertical line — the area to its left fills and the CDF value reads out.
- **Controls:** Threshold `r`, Image picker, (Advanced) percentile query `q` (find `r` such that `c(r)=q`).
- **Visual:** stacked PDF + CDF, **linked** shading; slope of CDF visibly matches PDF height (tangent overlay in Advanced).
- **Advanced:** `c(r_k) = Σ_{j≤k} p(r_j)` shown as an expanding sum with real terms; `dc/dr = p(r)` derivative relation demonstrated with tangent; percentile inversion steps.
- **Engine:** `cdf`, percentile search.

### Unit 2 — Histogram Processing

#### 11. Histogram Equalization (`histogram-equalization`)
- **Concept:** spread intensities to use the full range → better contrast.
- **Beginner:** one big "Equalize" slider (0→100% blend): image and histogram morph from original to equalized.
- **Controls:** Blend α; Image picker (low-contrast default); Show CDF toggle; (Advanced) bins, `L`, rounding mode.
- **Visual:** before/after images; before/after histograms; CDF overlay showing why the mapping works.
- **Advanced:** `s_k = round((L−1) Σ_{j≤k} p(r_j))`; step-by-step for a probed `r_k` with real numbers; flatness metric (e.g., KL/uniformity) and contrast metric (std-dev) before vs. after.
- **Engine:** `equalizeLUT`.

#### 12. Histogram Equalization Mapping Function (`equalization-mapping`)
- **Concept:** `T(r) = (L−1)∫₀^r p_r(w)dw` — the transformation *is* the scaled CDF.
- **Beginner:** show `T(r)` curve built live from the histogram; steep where many pixels live.
- **Controls:** Image picker; Draw-your-own-histogram mode (paint bars) → `T` and result update instantly; Probe `r`.
- **Visual:** histogram → cumulative build animation → `T(r)` plot → resulting image.
- **Advanced generative math:**
  - **Derivation:** `dT/dr = (L−1) p_r(r)` (fundamental theorem of calculus) solved with steps.
  - **Proof that output is uniform:** `p_s(s) = p_r(r)|dr/ds| = p_r(r)·1/((L−1)p_r(r)) = 1/(L−1)` with steps.
  - Discrete counterpart with live numbers; note on why discrete result is only approximately flat.
- **Engine:** cdf, symbolic rules for integral/derivative (FTC), change of variables.

#### 13. Normalized Histogram (`normalized-histogram`)
- **Concept:** dividing by `MN` makes histograms comparable across image sizes.
- **Beginner:** two images of different sizes: raw counts differ, normalized shapes match. Slider changes image size; counts scale, shape doesn't.
- **Controls:** Image size scale (25–200%), Normalization on/off toggle, Compare image select.
- **Visual:** raw histogram (y = counts) vs. normalized (y = probability), overlay for comparison.
- **Advanced:** `p(r_k) = n_k/(MN)` per-bin worked example; `Σp = 1` verification; L1/histogram-intersection distance between two normalized histograms.
- **Engine:** resize, normalize, distance metrics.

#### 14. Histogram Transformation (`histogram-transformation`)
- **Concept:** applying `s = T(r)` reshapes the histogram: `p_s(s) = p_r(r)|dr/ds|`.
- **Beginner:** drag the transformation curve; watch the output histogram bars slide/stretch/merge in real time.
- **Controls:** Curve presets + curve editor; monotonic constraint toggle; Image picker.
- **Visual:** three-panel: input histogram → `T(r)` → output histogram, with bin-to-bin **flow lines** (Sankey-like) showing where mass moves; merging bins highlighted.
- **Advanced:** change-of-variables derivation with steps; for the current `T`, compute `p_s(s)` at a probed `s`, including `|dr/ds|`; warn when `T` non-monotonic (formula invalid) and explain.
- **Engine:** `lutFromFn`, histogram mapping, symbolic derivative of `T^{-1}`.

#### 15. Inverse Histogram Transformation (`inverse-histogram-transformation`)
- **Concept:** `r = T⁻¹(s)`; exists only if `T` is strictly monotonic; discrete flat regions break invertibility.
- **Beginner:** reflect the curve across the diagonal; drag a point and see the inverse curve update; a warning appears when the curve has flat parts.
- **Controls:** Curve editor / presets; Probe `s`; Inverse mode (exact / nearest / interpolate).
- **Visual:** `T` and `T⁻¹` on one plot with the `y = x` mirror line; round-trip image test: `r → s → r'` with difference map.
- **Advanced generative math:** solve `s = T(r)` for `r` **step-by-step** (e.g., gamma: `r = (s/c)^{1/γ}`; log: `r = e^{s/c} − 1`); domain/range conditions; round-trip error (max/mean) in discrete case.
- **Engine:** `invertMonotone`, algebraic solver rules (isolate variable, inverse functions).

#### 16. Histogram Matching (`histogram-matching`)
- **Concept:** transform an image so its histogram resembles a *target* histogram.
- **Beginner:** choose a target (another image's histogram or a preset shape); a slider blends source → matched; the histogram morphs toward the target.
- **Controls:** Source image, Target (image / preset), Blend α.
- **Visual:** source, target, result images; source/target/result histograms overlaid; error readout.
- **Advanced:** algorithm steps: (1) `s = T(r)` equalize source, (2) `v = G(z)` equalize target, (3) `z = G⁻¹(s)`; combined map `z = G⁻¹(T(r))` with the probed `r` traced through each stage numerically; distance to target before/after.
- **Engine:** `matchLUT`.

#### 17. Histogram Specification (`histogram-specification`)
- **Concept:** matching where the target is *user-defined* (specified), e.g., a Gaussian or a hand-drawn shape.
- **Beginner:** design a target histogram with 1–3 "bumps" (sliders for position and width) and see the image adapt.
- **Controls:** Mixture components (count 1–3): `μ`, `σ`, weight; Draw-mode (paint target bars); Presets (dark-mood, bright-mood, bimodal, flat).
- **Visual:** target designer plot + live result + achieved vs. specified histogram.
- **Advanced:** target `p_z(z) = Σ w_i N(z; μ_i, σ_i²)` normalized; compute `G(z)` numerically; solve `G(z)=s` for probed `s`; explain why exact match is impossible in discrete images (quantization) and show residual.
- **Engine:** target builders, `cdf`, `matchLUT`.

#### 18. CDF Matching (`cdf-matching`)
- **Concept:** matching is fundamentally "line up the CDFs": for each source CDF value, find the same value on the target CDF.
- **Beginner:** animated **staircase walk**: pick an intensity `r`, a horizontal line goes from source CDF across to target CDF, then drops to the x-axis to find the new intensity `z`.
- **Controls:** Probe `r` (drag), Play/pause walk, Source & target selectors.
- **Visual:** both CDFs on one plot + the animated path + resulting intensity mapping `z(r)` plotted beneath.
- **Advanced:** each hop solved numerically: `c_src(r)=0.42 → find smallest z with c_tgt(z) ≥ 0.42 → z = 137`; tie/plateau handling rule explained; monotonicity guarantees.
- **Engine:** CDF search (binary search), `matchLUT`.

#### 19. Global Histogram Processing (`global-histogram-processing`)
- **Concept:** one transformation derived from the entire image's histogram applied everywhere.
- **Beginner:** apply global equalization; try an image with uneven lighting and see over/under-enhancement in some areas.
- **Controls:** Operation (equalize / stretch / gamma / match), Strength, Image picker (include local-lighting image), Region inspector (draw a box → its histogram).
- **Visual:** original vs. processed; global histogram vs. selected-region histogram (linked); "problem region" highlighting (clipped/washed-out areas).
- **Advanced:** one LUT for all pixels: `g(x,y) = T(f(x,y))`; show why it ignores position; compute region-vs-global CDF divergence; numeric loss of local contrast (local std-dev before/after).
- **Engine:** LUT pipeline, region stats.

#### 20. Local Information vs. Global Information (`local-vs-global`)
- **Concept:** local (neighborhood/tile) histograms adapt to local content; global ones don't.
- **Beginner:** slider blends between global result and local (adaptive) result; a moving window shows its local histogram.
- **Controls:** Mode (global / tiled / sliding-window / CLAHE), Window size (8–128 px), Clip limit (CLAHE), Interpolation on/off (removes tile seams), Blend.
- **Visual:** side-by-side global vs. local result; window overlay whose local histogram + local `T` curve update as you hover; difference map; noise-amplification indicator.
- **Advanced:** per-window equalization math with real numbers for the hovered window; CLAHE clip-and-redistribute steps (excess = Σ max(0, h−clip); redistribute uniformly); bilinear interpolation weights between four tile LUTs at a probed pixel, computed step-by-step; complexity note (sliding window O(MN·w²) vs. tile-based).
- **Engine:** `localEqualize` (tile + sliding + CLAHE), worker execution.

---

## 10. Cross-cutting features

- **Reset & presets:** each lab has "Reset" and 2–4 named presets ("Foggy photo", "Backlit scene") that animate parameters to target values.
- **"Try this" micro-prompts (Beginner):** one dismissible line under controls ("Drag γ below 1 — what happens to dark areas?") — from `copy/`.
- **Probe everywhere:** consistent hover/tap probing; shows `(x,y)`, `r`, `s`.
- **Export (Advanced):** copy steps as LaTeX, download PNG of plots, download processed image.
- **Persistence:** view mode, theme, last image, per-lab params (localStorage, versioned keys).
- **Offline/Static:** the whole app must work as static hosting with no backend.
- **Analytics (optional, privacy-friendly):** none in v1.

---

## 11. Quality requirements

| Area | Requirement |
|---|---|
| Correctness | Image ops match reference (NumPy/OpenCV) within ±1 gray level on golden images; step values equal engine results (tolerance 1e-9 for math, exact for integers). |
| Performance | 60 fps slider drag on mid-range laptop; initial JS per route < 200 KB gz (labs code-split); Lighthouse perf ≥ 90 on landing. |
| Accessibility | Keyboard-operable everything; AA contrast; screen-reader labels; reduced-motion respected; math has text alternative (`aria-label` = LaTeX-to-speech string). |
| Responsiveness | 360 px → 1920 px; touch-friendly sliders/curve editor. |
| Robustness | Handle degenerate inputs (all-black image, single-level image, γ=0, empty selection) with graceful messages, never NaN in UI. |
| Testing | Unit (engine), golden (math steps), component (controls), e2e (landing → lab → toggle → slider → assert plot change), visual regression on 3 key labs. |
| Code quality | Strict TS, no `any` in engine, ≥ 80% coverage on `/engine`. |

---

## 12. Phased implementation plan

### Phase 0 — Scaffold (½ day)
- Next.js + TS + Tailwind + Zustand + KaTeX + Vitest/Playwright; tokens, fonts, layout shell skeleton.
- **Accept:** `npm run dev` shows empty landing; lint/test scripts pass.

### Phase 1 — Shell & design system (1–2 days)
- `TopBar`, **`ViewToggle` (top-right)**, `ThemeToggle`, `TopicCard`, `LabLayout`, `AdvancedDrawer` (empty), `Slider`, `SegmentedControl`, `Toggle`, `Katex`.
- Topic Registry with all 20 entries (stub labs).
- Landing page grouped by unit; routing to `/topic/[slug]`; URL/param sync; keyboard shortcuts.
- **Accept:** all 20 cards render and navigate; toggle persists and syncs to URL; Advanced Drawer animates; Lighthouse a11y ≥ 95.

### Phase 2 — Image engine + plot kit (2–3 days)
- `ImageBuffer`, grayscale, histogram/normalize/cdf, LUT functions, quantize, equalize, match; procedural sample images; worker wrapper.
- `LinePlot`, `BarPlot`, `AreaPlot`, `PixelGrid`, `CurveEditorPlot`, `RangeBrush`, `useLinkedSelection`.
- **Accept:** golden tests pass; demo page shows live histogram + LUT curve responding to a slider at 60 fps.

### Phase 3 — Step Engine (2–3 days)
- AST utilities, rule set (constant, power, sum, constant multiple, product, quotient, chain, exp, log), simplifier, LaTeX formatter, substitution.
- Discrete solvers for sums/CDF/equalization.
- `StepList`/`StepCard` + step-through UI + plot highlight linking.
- **Accept:** derivative of `c·r^γ`, `c·log(1+r)`, `L−1−r`, and sigmoid produce correct, readable steps; golden tests pass; edge cases (γ=0,1) handled.

### Phase 4 — Unit 1 labs (topics 1–10) (4–6 days)
- Build in order 1→10, each with Beginner + Advanced content, presets, tests.
- **Accept:** per-lab checklist (Section 13) passes for each.

### Phase 5 — Unit 2 labs (topics 11–20) (5–7 days)
- Build 11→20; worker-based local equalization/CLAHE; curve editor refinements; CDF-walk animation.
- **Accept:** per-lab checklist passes; matching/specification results match reference within tolerance.

### Phase 6 — Polish & hardening (2–3 days)
- Thumbnails animation, empty/error states, motion tuning, a11y audit, perf profiling, visual regression baselines, static export.
- **Accept:** Section 11 table fully satisfied.

### Phase 7 — Optional enhancements
- LLM narration layer (Section 8.5), user image upload polish, shareable lab-state links, guided "lesson mode" (sequenced steps per lab), progress tracking.

---

## 13. Per-lab Definition of Done (checklist)

- [ ] Registered in registry; card thumbnail animates and pauses when off-screen.
- [ ] Beginner view: one hero visual, ≤ 3 primary controls, ≤ 3 short copy blocks.
- [ ] All controls update visuals in real time (no "Apply" buttons).
- [ ] Advanced view: extra controls + Advanced Drawer with generative steps that change with parameters.
- [ ] Steps link to plot highlights (where meaningful); LaTeX copy works.
- [ ] Probe/linked selection works between image ↔ plot.
- [ ] Reset + at least 2 presets.
- [ ] URL params encode/restore state.
- [ ] Degenerate inputs handled without NaN/blank UI.
- [ ] Unit + golden tests for its engine functions and `buildSteps`; e2e smoke test.
- [ ] Keyboard + screen-reader pass.

---

## 14. Extensibility plan (scope for expansion)

**Adding a topic (checklist):** create `src/labs/<slug>/` (`index.tsx`, `steps.ts`, `thumbnail.tsx`) → add copy → add one registry entry → add tests. No shell changes.

**Adding a unit:** add to `units` array; landing renders a new section automatically.

**Planned future units (registry-ready):**
- *Spatial Filtering:* convolution, smoothing (box/Gaussian), sharpening, median, Sobel/Laplacian (kernel editor, real-time convolution with matrix walk-through).
- *Frequency Domain:* Fourier transform, low/high-pass filters (interactive spectrum masking).
- *Image Restoration & Noise:* noise models, PSNR, Wiener filter.
- *Morphology & Segmentation:* erosion/dilation, thresholding (Otsu with histogram), region growing.
- *Beyond imaging (platform is generic):* calculus (derivatives/integrals visualized), probability distributions, signal processing, linear algebra transformations, ML basics (loss surfaces, gradient descent).

**Extensibility hooks already in the design:** declarative `params`, pluggable Step rules (add a rule file → new math), engine modules independent of React, thumbnails as registry keys, unit-agnostic registry.

**Content model growth:** copy stored as typed objects/MDX per topic (`beginner`, `advanced`, `tryThis[]`, `glossary[]`) to allow localization later.

---

## 15. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Symbolic step engine scope creep | Limit v1 to the rule set in 8.3; add rules only when a topic needs them; test each rule. |
| Slider lag on large images | Downscale to ≤ 512 px, LUT-based ops, workers, `requestAnimationFrame` throttling, transferable buffers. |
| Discrete vs. continuous math mismatch confusing learners | Every Advanced step labels *discrete* vs. *continuous*; include a "why they differ" note in topics 9, 12, 17. |
| Minimalism vs. information density | Beginner hides everything non-essential; Advanced uses a drawer, never crowds the stage. |
| Inconsistent look across labs | All controls/plots come from the shared kit; no lab-specific CSS beyond layout. |
| Licensing of sample photos | Prefer procedural images; verify CC0/public-domain for any photos and record in `ASSETS.md`. |

---

## 16. Suggested prompts for coding LLMs (copy/paste)

1. **Scaffold:** "Follow guide.md Phase 0 and Phase 1. Create the Next.js + TypeScript + Tailwind project, design tokens from Section 4.4, the TopBar with the Beginner/Advanced toggle at top-right, the Topic Registry with all 20 topics (stub labs), and the landing page card index grouped by unit."
2. **Engine:** "Implement Phase 2 image engine functions from Section 6.3 with Vitest golden tests against reference values; include procedural sample images."
3. **Plot kit:** "Build the plot/controls kit from Sections 4.4 and 7: LinePlot, BarPlot, CurveEditorPlot, RangeBrush, Slider, with linked selection hook."
4. **Step engine:** "Implement Section 8: rule-based derivative/integral step engine with LaTeX output and substitution; add golden tests for `c·r^γ`, `c·log(1+r)`, `L−1−r`."
5. **Lab N:** "Implement topic `<slug>` exactly per its spec in Section 9 and the Definition of Done in Section 13, as a `LabModule` (Section 6.2)."
6. **Review:** "Audit the project against Section 11 and Section 13; list failures and fix them."

---

*End of guide.md — v1.0. Update this file as topics or contracts evolve; keep the registry and per-topic specs as the source of truth.*
