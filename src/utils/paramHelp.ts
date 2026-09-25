/**
 * Plain-English "what does this actually do to my image" explanations for
 * lab controls, aimed at someone with zero image-processing background.
 *
 * Rather than hand-writing help text for every single slider/toggle/select
 * across every lab (there are 150+), this matches on keywords found in the
 * control's id/label — the same math notation and vocabulary keeps
 * reappearing (gamma, threshold, bin count, kernel, sigma, ...), so one
 * rule covers many controls. A lab can still pass its own `help` text on a
 * control if it needs something more specific — that always wins.
 */

interface Rule {
  test: RegExp;
  help: string;
}

const RULES: Rule[] = [
  {
    test: /gamma|power-?law|γ/i,
    help: "Controls how much the picture's overall brightness curves. Below 1 brightens the darker areas; above 1 darkens them. At exactly 1, nothing changes.",
  },
  {
    test: /threshold|median\s*\(|probe.*intensity|probe\s*r\b/i,
    help: "The brightness value (0 = black, 255 = white) used as the cutoff or the point being inspected on the curve.",
  },
  {
    test: /bit\s*depth|quantization/i,
    help: "How many distinct brightness levels the image is allowed to use. Fewer bits means fewer shades of grey and more visible 'banding' in smooth areas.",
  },
  {
    test: /bin\s*count|bins\b/i,
    help: "How many brightness buckets the histogram is split into. More bins show finer detail in the brightness distribution; fewer bins give a smoother, coarser picture.",
  },
  {
    test: /kernel\s*size|n\s*×\s*n|window\s*size|region\s*size|tile\s*grid/i,
    help: "The size (in pixels) of the small square of neighbouring pixels examined around each pixel. Bigger squares smooth or blend over a wider area; smaller squares change less.",
  },
  {
    test: /std\.?\s*dev|sigma|σ|bandwidth/i,
    help: "How spread-out the effect is. A small value keeps the effect tight and localized; a large value spreads it out further, producing a stronger blur or smoother curve.",
  },
  {
    test: /clip\s*limit/i,
    help: "A ceiling on how strongly any single brightness level can be boosted. Higher values allow more dramatic contrast but can amplify noise.",
  },
  {
    test: /channel\s*weight|w_r|w_g|w_b/i,
    help: "How much that colour channel (red, green or blue) contributes when the colour photo is flattened into one grey value per pixel.",
  },
  {
    test: /offset|brightness\s*shift|scalar/i,
    help: "A flat amount added to (or subtracted from) every pixel's brightness — it shifts the whole image lighter or darker without changing its contrast.",
  },
  {
    test: /scale\s*factor|resolution\s*scale/i,
    help: "A multiplier applied to every value — think of it as a zoom or stretch amount, not a shift.",
  },
  {
    test: /sample\s*count|monte\s*carlo|n\s*=/i,
    help: "How many random pixels are sampled to estimate the result. More samples give a more accurate estimate but take longer to compute.",
  },
  {
    test: /blend|matching\s*strength|alpha|α/i,
    help: "How much of the effect is mixed in, from 0% (original image, untouched) to 100% (the full effect applied).",
  },
  {
    test: /lower\s*bound|upper\s*bound|r_min|r_max/i,
    help: "One end of the brightness range this control affects — pixels outside this range are left alone or clipped.",
  },
  {
    test: /offset\s*Δx|offset\s*Δy|neighbour\s*offset/i,
    help: "How many pixels over (or down) to look, relative to the pixel currently being processed.",
  },
  {
    test: /noise\s*level|σₙ/i,
    help: "How much random speckle is added to the test image — higher values simulate a grainier, lower-quality photo.",
  },
  {
    test: /probe\s*x|probe\s*y|scanline|row\s*\(y\)/i,
    help: "Picks which pixel, row or column of the image the plot below is currently reading values from.",
  },
];

/** Returns a plain-English explanation for a control, or undefined if nothing matches. */
export function getParamHelp(label: string, id?: string): string | undefined {
  const haystack = `${label} ${id ?? ''}`;
  for (const rule of RULES) {
    if (rule.test.test(haystack)) return rule.help;
  }
  return undefined;
}
