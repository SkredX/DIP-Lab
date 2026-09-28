export interface TopicIntro {
  title: string;
  unit: string;
  concept: string;
  whatYouSee: string;
  whatToTry: string[];
  whyItMatters: string;
}

export const TOPIC_INTROS: Record<string, TopicIntro> = {
  // =========================================================================
  // UNIT 1: DIGITAL IMAGE FUNDAMENTALS
  // =========================================================================
  'digital-image': {
    title: 'Digital Image',
    unit: 'Unit 1: Digital Image Fundamentals',
    concept:
      'Continuous real-world light scenes are converted into digital images through two separate steps: spatial sampling (dividing the scene into a grid of pixel squares) and intensity quantization (rounding each pixel\'s brightness to discrete integer levels).',
    whatYouSee:
      'The left panel shows the continuous source scene with a moving red probe dot. The right panel shows the discretized digital result after sampling at N×N resolution with k-bit quantization.',
    whatToTry: [
      'Slide the "Sampling Grid" slider down from 128 to 16 to see how coarse spatial sampling turns smooth curves into blocky pixel stairs.',
      'Slide "Bit-depth Quantization" from 8 bits down to 2 or 1 bit to observe false contouring (banding).',
      'Move "Probe x" and "Probe y" to inspect the red probe dot at specific pixel locations.',
    ],
    whyItMatters:
      'Every digital camera sensor (CMOS/CCD) performs sampling (pixel grid array) and quantization (analog-to-digital converter) to produce JPEG or RAW files.',
  },
  'grayscale-image': {
    title: 'Grayscale Image',
    unit: 'Unit 1: Digital Image Fundamentals',
    concept:
      'Converting 3-channel (RGB) color photos into monochrome grayscale collapses three numbers per pixel into one scalar luminance value Y using human eye spectral sensitivities (green ~59%, red ~30%, blue ~11%).',
    whatYouSee:
      'Side-by-side color source vs. computed monochrome luminance. Adjusting weights shows how the grayscale image darkens or brightens depending on which color bands are emphasized.',
    whatToTry: [
      'Increase Green Weight w_G to 1.0 and zero out others: notice how green leaves stay bright while blue sky goes dark.',
      'Set Red Weight w_R to 1.0 to see how a red filter simulation behaves in black-and-white photography.',
      'Check the Weight Normalization step below to verify that the weights sum to 1.0 to prevent under- or over-exposure.',
    ],
    whyItMatters:
      'Standardized in ITU-R BT.601 and sRGB standards used in televisions, computer monitors, and OpenCV/PIL image libraries.',
  },
  'pixel-intensity': {
    title: 'Pixel Intensity & Line Profile',
    unit: 'Unit 1: Digital Image Fundamentals',
    concept:
      'A digital image is a 2D spatial function f(x, y). Probing a single horizontal scanline lets you plot intensity variations as a 1D graph where peaks represent highlights and valleys represent dark shadows.',
    whatYouSee:
      'The image features a horizontal orange scanline with a glowing red probe dot at (X, Y). The line plot on the right plots pixel intensities along that exact scanline, with a red marker tracking the probe column.',
    whatToTry: [
      'Drag "Scanline Row (Y)" to move the horizontal scanline across dark shadows and bright features.',
      'Drag "Probe Column (X)" to glide the glowing red dot along the scanline and watch the marker follow the curve in real time.',
      'Adjust "Brightness Offset" to see how adding a scalar lifts or drops the entire line profile uniformly.',
    ],
    whyItMatters:
      'Line profiles are widely used in medical radiography, astronomy, and quality inspection to measure edge sharpness and contrast ratios.',
  },
  'intensity-levels': {
    title: '8-bit Image / Intensity Levels',
    unit: 'Unit 1: Digital Image Fundamentals',
    concept:
      'Standard digital images store 8 bits per channel (256 distinct shades from 0=black to 255=white). Reducing the bit depth groups similar shades into fewer bins, causing unnatural abrupt steps called "false contouring" or "posterization".',
    whatYouSee:
      'The quantized image on the left and a bar plot showing the discrete allowed gray levels on the right. As bits decrease, intermediate tones disappear.',
    whatToTry: [
      'Reduce "Bit Depth (k)" from 8 down to 3 (8 shades): look closely at smooth gradients in skies or cheeks to spot false contour bands.',
      'Drop down to 1 bit (2 shades: black and white) to turn the image into a binary thresholded silhouette.',
      'Toggle "Dithering" (if available) or check the MSE/PSNR readouts in the math panel to measure the quantization noise.',
    ],
    whyItMatters:
      'Medical MRI/CT scans require 12 to 16 bits per pixel to detect subtle tissue density differences without quantization banding.',
  },
  'image-as-matrix': {
    title: 'Image Representation as a Matrix',
    unit: 'Unit 1: Digital Image Fundamentals',
    concept:
      'Under the hood, any digital image is literally an M×N matrix of numbers where each number represents optical intensity. Linear point operations correspond to matrix addition (brightness shift) or scalar multiplication (contrast scaling).',
    whatYouSee:
      'An interactive zoom-in grid showing numeric intensity values inside individual pixel cells. A red highlight tracks the selected cell.',
    whatToTry: [
      'Click on any number inside the grid to edit its value directly and watch the pixel color change instantly.',
      'Toggle "Pseudocolor Heatmap Mode" to visualize numerical values through heat-mapped color shades rather than monochrome gray.',
      'Adjust "Scalar Brightness Shift" to see uniform addition across all matrix elements.',
    ],
    whyItMatters:
      'All computer vision algorithms—from edge detectors to neural networks—treat images as numeric tensors and matrices.',
  },
  'intensity-transformation': {
    title: 'Intensity Transformation Functions',
    unit: 'Unit 1: Digital Image Fundamentals',
    concept:
      'Point processing maps each input intensity r into an output intensity s = T(r) independently of neighbouring pixels. Curves bending upward (log or γ < 1) lift dark tones, while curves bending downward (γ > 1) darken highlights.',
    whatYouSee:
      'Left: Processed image. Right: The transfer curve s = T(r) with a red marker at probe intensity r and a green tangent line showing the local derivative ds/dr.',
    whatToTry: [
      'Switch between "Gamma (Power-Law)", "Logarithmic", and "Negative (Invert)" transformation types.',
      'Slide "Probe Intensity r" to move the probe along the curve and watch the tangent derivative change.',
      'Set Gamma < 1 to bring out hidden shadow details in dark photographs.',
    ],
    whyItMatters:
      'Every monitor calibration, camera tone curve, and photo editor curve tool (Photoshop/Lightroom) is an intensity transformation.',
  },
  'image-histogram': {
    title: 'Image Histogram',
    unit: 'Unit 1: Digital Image Fundamentals',
    concept:
      'An image histogram counts how many pixels have each brightness value from 0 to 255. It provides a global summary of tonal distribution: underexposed images bunch on the left, overexposed on the right, and low-contrast images bunch in the middle.',
    whatYouSee:
      'Left: Source image with green pixel highlighting. Right: Interactive frequency histogram. The highlighted green pixels in the image correspond to the active histogram bin range.',
    whatToTry: [
      'Drag "Threshold Range" to highlight only pixels within a specific brightness window (e.g., highlights or shadows).',
      'Change image presets (Low Contrast, Dark, High Key) to observe how the histogram shifts its shape and center of mass.',
      'Check the computed mean, standard deviation, and Shannon Entropy below the plot.',
    ],
    whyItMatters:
      'Histograms are displayed on professional camera viewfinders in real time so photographers can immediately spot clipped highlights or crushed shadows.',
  },
  'intensity-probability': {
    title: 'Probability Distribution of Intensities',
    unit: 'Unit 1: Digital Image Fundamentals',
    concept:
      'Dividing histogram counts by total pixels M·N converts frequencies into probabilities p(r_k) = n_k / (M·N). Treating intensity as a random variable enables probability theory and Monte Carlo statistical estimations.',
    whatYouSee:
      'Left: Image with random Monte Carlo sampled pixels highlighted. Right: The empirical sample probability distribution converging toward the true underlying PDF as sample size increases.',
    whatToTry: [
      'Slide "Sample Count (N)" from 100 up to 10,000 to see the law of large numbers smooth out random statistical fluctuation.',
      'Observe the sum of probabilities: it always strictly equals 1.0.',
      'Check the estimated Mean and Variance convergence readouts in the math panel.',
    ],
    whyItMatters:
      'Stochastic sampling algorithms are central to ray-tracing rendering, machine learning training batches, and noisy sensor modeling.',
  },
  'pdf': {
    title: 'Probability Density Function (PDF)',
    unit: 'Unit 1: Digital Image Fundamentals',
    concept:
      'The continuous analogue of a normalized histogram is the Probability Density Function p_r(r). The area under any portion of the PDF curve between r1 and r2 gives the exact probability that a randomly chosen pixel falls in that range.',
    whatYouSee:
      'Left: Source image. Right: Smooth PDF curve with shaded integral area between the lower and upper probe limits.',
    whatToTry: [
      'Adjust "Range Limits" to shade different sections of the PDF and inspect the computed integral area.',
      'Notice that the total area under the entire PDF from 0 to 255 always sums to 1.0 (axiom of probability).',
      'Move "Probe Intensity r" to inspect the exact probability density height at that specific brightness.',
    ],
    whyItMatters:
      'PDF modeling forms the theoretical foundation for histogram equalization, statistical thresholding (Otsu\'s method), and maximum likelihood segmentation.',
  },
  'cdf': {
    title: 'Cumulative Distribution Function (CDF)',
    unit: 'Unit 1: Digital Image Fundamentals',
    concept:
      'The CDF c(r) = P(R ≤ r) accumulates probabilities from 0 up to r. It is strictly non-decreasing, starts at 0, and ends at 1.0. Its derivative dc/dr is exactly the PDF, making it the mathematical key to histogram equalization.',
    whatYouSee:
      'Left: Image with brushed pixels for all intensities ≤ r. Right: The monotonically rising CDF curve with a red marker at the active threshold r.',
    whatToTry: [
      'Drag "Threshold Intensity (r)" from 0 to 255: watch the brushed green region grow as the CDF value climbs toward 1.0.',
      'Notice steep climbs in the CDF curve occur where the image has large clumps of pixels (peaks in the PDF).',
      'Compare flat regions of the CDF to regions where the image has zero pixels.',
    ],
    whyItMatters:
      'The CDF is the exact mapping function that transforms any arbitrary intensity distribution into a uniform distribution in Histogram Equalization.',
  },

  // =========================================================================
  // UNIT 2: HISTOGRAM PROCESSING
  // =========================================================================
  'histogram-equalization': {
    title: 'Histogram Equalization',
    unit: 'Unit 2: Histogram Processing',
    concept:
      'Histogram equalization stretches clustered intensities across the entire 0–255 dynamic range using the image\'s own CDF. Dark areas gain shadow contrast and flat images become punchy and vivid automatically.',
    whatYouSee:
      'Before and after images side-by-side with their corresponding histograms. Low-contrast images with bunched histograms become widely distributed across the full scale.',
    whatToTry: [
      'Switch image presets to "Low Contrast" or "Dark" to see how equalization dramatically reveals hidden details.',
      'Inspect the output histogram: note that discrete digital rounding causes bin spacing gaps (discrete equalization cannot create new gray tones).',
      'Slide "Probe Intensity r" in the controls to trace where a specific input brightness lands in the output image.',
    ],
    whyItMatters:
      'Standard technique for enhancing medical X-rays, satellite radar imagery, and infrared thermal vision where sensor contrast is low.',
  },
  'equalization-mapping': {
    title: 'Equalization Mapping Function',
    unit: 'Unit 2: Histogram Processing',
    concept:
      'The mapping function s = T(r) = (L - 1)·CDF(r) maps input level r directly to output level s. The Fundamental Theorem of Calculus proves that applying this transformation yields a flat, uniform output probability distribution.',
    whatYouSee:
      'The monotonically rising staircase lookup curve s = T(r). Input gray level r on the X-axis maps directly to new output gray level s on the Y-axis.',
    whatToTry: [
      'Slide "Probe Intensity r" to watch a horizontal-vertical ray trace input r to output s on the curve.',
      'Notice where the curve is steep: those popular input tones are spread out into many distinct output shades (high contrast boost).',
      'Notice where the curve is flat: rare input tones are compressed together.',
    ],
    whyItMatters:
      'Lookup Tables (LUTs) precomputed from this mapping function allow real-time 60fps video equalization with zero per-pixel floating-point math.',
  },
  'normalized-histogram': {
    title: 'Normalized Histogram',
    unit: 'Unit 2: Histogram Processing',
    concept:
      'Raw histograms depend on image dimensions (a 4K photo has 16× more counts than a 1080p photo). Dividing counts by total pixels M·N yields a resolution-independent discrete probability distribution.',
    whatYouSee:
      'Histogram counts plotted on a normalized scale [0, 1] instead of raw pixel counts. The sum of all bin heights equals 1.0.',
    whatToTry: [
      'Switch between different sample images and observe that the Y-axis remains standardized between 0 and 0.15.',
      'Hover over bins to see exact relative probability percentages for individual brightness bands.',
    ],
    whyItMatters:
      'Enables comparing images of different resolutions in computer vision search engines and content-based image retrieval.',
  },
  'histogram-transformation': {
    title: 'Histogram Transformation Dynamics',
    unit: 'Unit 2: Histogram Processing',
    concept:
      'When an intensity transformation s = T(r) is applied, probabilities are conserved: p_s(s)·ds = p_r(r)·dr. Where the derivative |dT/dr| is steep, output bins spread out; where it is shallow, multiple bins merge into one.',
    whatYouSee:
      'Input distribution, transformation curve, and resulting output distribution aligned to show how curve curvature reshapes the histogram bins.',
    whatToTry: [
      'Adjust Gamma γ: values < 1 expand dark bins and compress highlight bins; values > 1 do the opposite.',
      'Slide "Probe Output Level s" to trace the inverse derivative |dr/ds| in the math steps below.',
    ],
    whyItMatters:
      'Explains why over-aggressive contrast adjustments cause "comb" artifacts (gaps and spikes) in image histograms.',
  },
  'inverse-histogram-transformation': {
    title: 'Inverse Transformation & Monotonicity',
    unit: 'Unit 2: Histogram Processing',
    concept:
      'To reverse an intensity transformation r = T⁻¹(s), the mapping function MUST be strictly monotonically increasing. If T(r) ever goes down or stays completely flat, multiple inputs map to the same output and cannot be un-mixed.',
    whatYouSee:
      'The forward curve alongside its inverted counterpart. A round-trip test compares the reconstructed image against the original to show roundoff residuals.',
    whatToTry: [
      'Vary Gamma γ and inspect the inverse curve r = 255·(s/255)^(1/γ).',
      'Check the reconstruction error: digital integer rounding causes tiny ±1 LSB residuals even with invertible continuous formulas.',
    ],
    whyItMatters:
      'Essential for lossless color profile conversions, RAW sensor decoding, and reversible image watermarking.',
  },
  'histogram-matching': {
    title: 'Histogram Matching (Specification)',
    unit: 'Unit 2: Histogram Processing',
    concept:
      'Equalization forces an image into a flat histogram, which can look harsh and unnatural. Histogram Matching transforms an image so its histogram matches a specific reference target distribution using a two-step mapping: equalize source, then inverse-equalize to target.',
    whatYouSee:
      'Three panels: Source image, target reference image, and the resulting matched image whose histogram now adopts the target image\'s tonal profile.',
    whatToTry: [
      'Select different Target distributions (e.g., moody low-key, bimodal, high-key) and watch the source photo adopt the target color/lighting mood.',
      'Slide "Probe Intensity r" to watch the mapping walk: source CDF → intermediate uniform s → target CDF → output z.',
    ],
    whyItMatters:
      'Crucial for color grading in filmmaking, aligning multi-camera film shoots, and harmonizing satellite imagery captured on different days.',
  },
  'histogram-specification': {
    title: 'Parametric Histogram Specification',
    unit: 'Unit 2: Histogram Processing',
    concept:
      'Instead of copying another photo, you can mathematically design a target shape using Gaussian mixture curves. You control where the brightness peaks (modes) sit and how wide they are.',
    whatYouSee:
      'Source photo, mathematically defined multi-peak target distribution, and the resulting synthesized image.',
    whatToTry: [
      'Adjust "Gaussian Mode 1 Center (μ1)" and "Mode 2 Center (μ2)" to move the highlight and shadow clusters.',
      'Adjust "Gaussian Width (σ)" to make the distribution tight (high local contrast) or broad (soft contrast).',
    ],
    whyItMatters:
      'Used in automated photographic style transfer and diagnostic enhancement filters tailored to specific tissue densities in radiology.',
  },
  'cdf-matching': {
    title: 'CDF Matching (Staircase Walk)',
    unit: 'Unit 2: Histogram Processing',
    concept:
      'To map input intensity r to output intensity z, compute source CDF c_src(r) = v, then find the smallest target intensity z where target CDF c_tgt(z) ≥ v. Graphically, this is a horizontal ray traveling from source curve to target curve.',
    whatYouSee:
      'Both source CDF (blue) and target CDF (orange) plotted on the same graph. Dragging the probe shows a horizontal ray connecting them and dropping down to output level z.',
    whatToTry: [
      'Drag "Probe Input Intensity (r)" and watch the horizontal ray find the matching CDF probability before dropping straight down to z.',
      'Observe what happens when the target CDF rises steeply vs. slowly.',
    ],
    whyItMatters:
      'This exact discrete algorithm is how Adobe Photoshop and Lightroom implement custom curves and matching filters.',
  },
  'global-histogram-processing': {
    title: 'Global Histogram Processing & Its Limits',
    unit: 'Unit 2: Histogram Processing',
    concept:
      'Global equalization applies one single formula to every pixel in the entire image regardless of where it is located. On images with uneven lighting (e.g., bright sky and dark ground), global processing washes out bright areas and amplifies noise in shadows.',
    whatYouSee:
      'Original unevenly lit image vs. global equalization output. Green brushed overlays highlight overexposed blown-out regions (intensities > 240).',
    whatToTry: [
      'Toggle "Highlight Over/Under-Exposed Regions" to see how many pixels are completely washed out into pure white by global equalization.',
      'Switch operations between "Equalize", "Contrast Stretch", and "Gamma Brighten" to see how global formulas fail on uneven scenes.',
    ],
    whyItMatters:
      'Demonstrates why modern smartphone cameras abandoned pure global equalization in favor of local adaptive algorithms like CLAHE and Smart HDR.',
  },
  'local-vs-global': {
    title: 'Local vs. Global (CLAHE)',
    unit: 'Unit 2: Histogram Processing',
    concept:
      'CLAHE (Contrast-Limited Adaptive Histogram Equalization) divides the image into small tiles (e.g., 8×8), equalizes each tile locally, clips histogram spikes to avoid amplifying noise, and bilinearly blends tile borders to remove seams.',
    whatYouSee:
      'Original image on the left, CLAHE output on the right with a moving red probe dot indicating the pixel and tile being processed.',
    whatToTry: [
      'Switch algorithm between "CLAHE (Local + Bilinear)", "Tiled Without Interpolation", and "Standard Global Equalization". Notice the ugly block grid seams without interpolation!',
      'Increase "CLAHE Clip Limit" to allow higher local contrast, or decrease it to prevent noise amplification.',
      'Change "Tile Grid Size" from 4 to 16 to observe the scale of local adaptation.',
      'Move "Probe x" and "Probe y" to inspect how individual tiles adapt to local shadows and highlights.',
    ],
    whyItMatters:
      'CLAHE is the gold standard enhancement algorithm in medical ultrasound, mammography, and autonomous vehicle night vision.',
  },

  // =========================================================================
  // UNIT 3: SPATIAL FILTERING
  // =========================================================================
  'spatial-filtering': {
    title: 'Spatial Filtering & Neighborhood Operations',
    unit: 'Unit 3: Spatial Filtering',
    concept:
      'Unlike point processing where each pixel is modified in isolation, spatial filtering computes each output pixel from a small neighbourhood of surrounding pixels using a sliding matrix of weights called a kernel.',
    whatYouSee:
      'Input image with a glowing red probe dot and dashed neighbourhood box on the left; filtered output on the right. Below, grids display the local neighbourhood pixel values under the red dot alongside the kernel matrix.',
    whatToTry: [
      'Move the "Probe x" and "Probe y" sliders (or click directly on the image) to move the red probe dot to different features (edges, textures, flat areas).',
      'Switch kernels between "Box 3×3", "Gaussian 3×3", "Sharpen", and "Edge" to see radically different visual transformations.',
      'Watch the neighbourhood grid numbers update in real time as the red dot glides across the image.',
    ],
    whyItMatters:
      'Spatial filtering is the fundamental building block of digital image processing, computer vision feature extractors, and convolutional neural networks (CNNs).',
  },
  'neighborhood-processing': {
    title: 'Neighborhood Processing',
    unit: 'Unit 3: Spatial Filtering',
    concept:
      'Context determines meaning: a pixel value of 180 means a highlight in a dark room, but a shadow in a sunny snowfield. Neighborhood processing computes output pixels by sliding an n×n window across the image.',
    whatYouSee:
      'Input image and filtered output with the moving red dot at (px, py). The numeric grid below reveals the exact numbers in the n×n square surrounding the red dot.',
    whatToTry: [
      'Change "Kernel size (n × n)" from 3×3 to 7×7 or 11×11 to expand the neighbourhood window around the red dot.',
      'Move the red probe dot to a high-contrast boundary and notice how the numbers in the grid split into high and low values.',
    ],
    whyItMatters:
      'Every blur, sharpen, noise-reduction, and edge-finding filter operates on local neighbourhoods.',
  },
  'kernel-mask': {
    title: 'Kernel / Mask Weights',
    unit: 'Unit 3: Spatial Filtering',
    concept:
      'A kernel is a small matrix of coefficients. If the weights sum to 1.0, overall image brightness is preserved. If they sum to 0.0 (like edge detectors), uniform flat areas cancel to zero (black) and only sharp transitions shine bright.',
    whatYouSee:
      'The active kernel matrix with color-coded positive (blue) and negative weights. Input and output images show the red probe dot tracking coordinates (px, py).',
    whatToTry: [
      'Select "Sharpen": note the positive center (+5) surrounded by negative weights (-1). It boosts differences with neighbours.',
      'Select "Edge (zero-sum)": note that flat regions turn solid black because uniform numbers multiplied by zero-sum weights equal zero.',
      'Move the red probe dot across a sharp edge to see the mathematical output spike in the steps below.',
    ],
    whyItMatters:
      'Convolutional neural networks (CNNs) learn thousands of custom kernel matrices automatically to recognize eyes, wheels, and faces.',
  },
  'convolution-filtering': {
    title: 'Convolution / Discrete Filtering',
    unit: 'Unit 3: Spatial Filtering',
    concept:
      'Convolution slides the kernel across every pixel: at each location, multiply each overlapping pixel by its corresponding kernel weight, add all the products together, and write the sum to the output pixel under the red dot.',
    whatYouSee:
      'Input with glowing red probe dot and output image. Below, the neighbourhood grid and kernel are displayed with full step-by-step KaTeX arithmetic.',
    whatToTry: [
      'Drag "Probe x" and "Probe y" to move the red dot: watch the step-by-step arithmetic below recalculate g(x,y) = Σ w·f in real time.',
      'Select preset "Sharpen at an edge" to observe how negative and positive kernel weights interact at an edge.',
      'Enable noise to see how filtering dampens single-pixel spikes.',
    ],
    whyItMatters:
      'Convolution is mathematically equivalent to impulse response filtering in signal processing and is the primary operation in modern AI vision.',
  },
  'box-filter': {
    title: 'Box Filter (Normalized Averaging)',
    unit: 'Unit 3: Spatial Filtering',
    concept:
      'The simplest smoothing filter: every neighbor in an n×n square receives an equal weight of 1/n². It replaces each pixel with the unweighted average of its neighbourhood, smoothing out noise at the cost of blurring edges.',
    whatYouSee:
      'Input and output images with red probe dots. Grids show the uniform 1/n² weights (e.g., 1/9 ≈ 0.111 for 3×3; 1/25 = 0.04 for 5×5).',
    whatToTry: [
      'Increase "Kernel size" from 3 to 11 to see the blur strength increase dramatically.',
      'Toggle "Normalize (÷ n²)" off to see what happens when weights are not normalized: the image immediately overflows to pure white!',
      'Move the red probe dot to a sharp border to see how the box filter blends black and white into gray.',
    ],
    whyItMatters:
      'Box blurs can be computed in O(1) constant time per pixel using summed-area tables (integral images), making them ultra-fast.',
  },
  'mean-filter': {
    title: 'Mean / Averaging Filter',
    unit: 'Unit 3: Spatial Filtering',
    concept:
      'Averaging independent random noise cancels it out because positive and negative noise spikes average toward zero (variance drops by 1/n²). However, sharp object edges are also averaged together, turning into soft ramps.',
    whatYouSee:
      'Input with noise alongside the smoothed output. Below, a line profile plots the original noisy row (blue) against the smoothed row (orange).',
    whatToTry: [
      'Increase "Noise level (σₙ)" to 30: notice how noisy the blue profile curve is.',
      'Increase "Kernel size" to 7: watch the orange smoothed curve filter out the noisy jitter while smoothing edges into gentle slopes.',
      'Slide "Probe y" and "Probe x" to inspect different rows and coordinates.',
    ],
    whyItMatters:
      'Demonstrates the fundamental trade-off of linear filtering: noise reduction always comes at the expense of edge sharpness.',
  },
  'smoothing': {
    title: 'Spatial Smoothing (Low-Pass Filtering)',
    unit: 'Unit 3: Spatial Filtering',
    concept:
      'In the frequency domain, edges and noise are high frequencies (rapid changes), while flat backgrounds are low frequencies (slow changes). Smoothing acts as a spatial low-pass filter, attenuating high frequencies.',
    whatYouSee:
      'Input and smoothed output with the red probe dot. The row profile plot overlays the original (blue) against the filtered signal (orange).',
    whatToTry: [
      'Switch between "Box" and "Gaussian" smoothers: notice how Gaussian creates smoother, more natural transitions without boxy artifacts.',
      'Adjust "Std. deviation (σ)" to control the blur spread.',
      'Move the red probe dot to observe where the smoothed signal deviates most from the original.',
    ],
    whyItMatters:
      'Smoothing is an essential preprocessing step before edge detection (Canny), image scaling, and thresholding.',
  },
  'gaussian-filtering': {
    title: 'Gaussian Filtering',
    unit: 'Unit 3: Spatial Filtering',
    concept:
      'Instead of giving all neighbours equal weight like a box filter, a Gaussian filter gives highest weight to the center pixel and exponentially decreasing weights to distant neighbours according to a bell curve G(r) ∝ exp(-r² / 2σ²).',
    whatYouSee:
      'Input image, Gaussian filtered output with red probe dot, kernel weight matrix, and the continuous 1D Gaussian bell curve plot.',
    whatToTry: [
      'Slide "Std. deviation (σ)" from 0.5 to 4.0: observe how the bell curve widens and the image becomes progressively softer.',
      'Compare Gaussian output to Box blur: notice Gaussian produces no grid or square artifacts.',
      'Move the red probe dot to examine the kernel weights centered around that exact pixel.',
    ],
    whyItMatters:
      'Gaussian filtering is the unique rotationally symmetric filter that introduces no false edges or artifacts at any scale.',
  },
  'gaussian-function': {
    title: 'The 2D Gaussian Function',
    unit: 'Unit 3: Spatial Filtering',
    concept:
      'The 2D circularly symmetric Gaussian formula G(x, y) = (1 / 2πσ²)·exp(-(x² + y²) / 2σ²) has a single parameter σ (standard deviation). Full-Width at Half-Maximum (FWHM ≈ 2.355σ) measures its effective blur diameter.',
    whatYouSee:
      'Interactive 1D Gaussian cross-section plot and numeric 2D kernel matrix. The red probe dot marks coordinate (px, py).',
    whatToTry: [
      'Increase σ and watch the FWHM calculation increase in the math drawer below.',
      'Notice that to avoid truncation artifacts, the kernel size n should be at least 6σ (or ±3σ on either side of center).',
    ],
    whyItMatters:
      'The Gaussian distribution is the only completely separable 2D filter: G(x,y) = G(x)·G(y), allowing fast 2D filtering with two 1D passes.',
  },
  'gaussian-weighting': {
    title: 'Gaussian Weighting Calculations',
    unit: 'Unit 3: Spatial Filtering',
    concept:
      'Each discrete entry in a Gaussian kernel is computed by plugging pixel offsets (Δx, Δy) into the Gaussian formula and then dividing by the sum of all elements so the total equals 1.0.',
    whatYouSee:
      'Input and output images with red probe dots. A 2D grid shows kernel weights with a highlight on the specific offset cell (Δx, Δy).',
    whatToTry: [
      'Adjust "Neighbour offset Δx" and "Δy" to inspect how weight drops off as distance d = √(Δx² + Δy²) increases.',
      'Observe that at d = 0 (center), weight is highest; at d ≥ 3σ, weight drops close to zero.',
    ],
    whyItMatters:
      'Understanding discrete kernel sampling is critical when generating filter masks for custom hardware or shaders.',
  },
  'gaussian-smoothing': {
    title: 'Gaussian Smoothing & Denoising',
    unit: 'Unit 3: Spatial Filtering',
    concept:
      'Comparing noisy input against Gaussian smoothed output demonstrates effective suppression of high-frequency Gaussian speckle noise while preserving general geometric shapes.',
    whatYouSee:
      'Noisy image vs. Gaussian smoothed image with red probe dot. The row plot displays the noisy row (blue) alongside the smoothed row (orange).',
    whatToTry: [
      'Increase "Noise level (σₙ)" to 40 and watch the Gaussian filter restore a clean image.',
      'Observe the PSNR (Peak Signal-to-Noise Ratio) readout: notice there is a sweet spot for σ that maximizes PSNR before over-blurring kicks in.',
      'Move "Probe y" and "Probe x" to inspect row profiles through smooth versus textured regions.',
    ],
    whyItMatters:
      'Standard first stage in computational photography pipelines to clean sensor noise before HDR merging.',
  },
  'edge-blurring': {
    title: 'Edge Blurring & The Price of Smoothing',
    unit: 'Unit 3: Spatial Filtering',
    concept:
      'Linear smoothing cannot distinguish between noise spikes and real object edges. As a result, sharp step edges are smoothed into ramps, shifting edge locations and reducing contrast across boundaries.',
    whatYouSee:
      'Before and after images with red probe dot. The profile plot shows a sharp step edge (blue) softened into a gradual ramp (orange).',
    whatToTry: [
      'Move "Probe y" to an edge boundary (e.g., y=64 on a test image) and observe the 10%–90% edge rise distance in the math panel.',
      'Increase σ: watch the edge transition width Δ_10-90 grow wider (the edge is becoming blurrier).',
      'This fundamental defect of linear filtering motivates the discovery of Bilateral Filtering in Unit 4!',
    ],
    whyItMatters:
      'Demonstrates why classic Gaussian blur fails when you need to remove noise without making textures and boundaries fuzzy.',
  },

  // =========================================================================
  // UNIT 4: BILATERAL FILTERING
  // =========================================================================
  'bilateral-filtering': {
    title: 'Bilateral Filtering (Edge-Preserving)',
    unit: 'Unit 4: Bilateral Filtering',
    concept:
      'Bilateral filtering solves the edge-blurring problem by combining TWO Gaussian weights: a spatial weight w_s (geometric distance) and a range weight w_r (photometric brightness difference). Neighbours must be physically close AND similar in brightness to count!',
    whatYouSee:
      'Input on the left, bilateral filtered output on the right with moving red probe dot at (px, py). Even under heavy noise, edges stay razor-sharp while flat areas are smoothly denoised.',
    whatToTry: [
      'Move the red probe dot right onto a high-contrast edge using "Probe x" and "Probe y" (or click the image).',
      'Compare the bilateral output against standard Gaussian blur: observe how the boundary remains crisp while noise disappears.',
      'Vary "Spatial σₛ" (reach) and "Range σᵣ" (tolerance) to see how each controls the filter.',
    ],
    whyItMatters:
      'Used universally in smartphone camera portrait modes to smooth skin blemishes while preserving razor-sharp eyelashes, eyes, and hair.',
  },
  'spatial-weight': {
    title: 'Spatial Weight (Geometric Closeness)',
    unit: 'Unit 4: Bilateral Filtering',
    concept:
      'The spatial weight w_s(i, j) = exp(-d² / 2σₛ²) depends purely on geometric Euclidean distance d from the red probe dot. It is identical to standard Gaussian smoothing and does not look at pixel brightness at all.',
    whatYouSee:
      'Input image with red probe dot, local neighbourhood intensities, and the spatial weight grid w_s. The weights are circularly symmetric around the center.',
    whatToTry: [
      'Slide "Spatial σₛ" from 0.5 to 5.0 and watch the spatial weight grid spread out from the center.',
      'Notice that moving the red probe dot across the image does NOT change the spatial weight grid values (geometry is spatially invariant).',
    ],
    whyItMatters:
      'Forms the first of the two multiplicative components of the bilateral filter.',
  },
  'range-weight': {
    title: 'Range Weight (Photometric Similarity)',
    unit: 'Unit 4: Bilateral Filtering',
    concept:
      'The range weight w_r(i, j) = exp(-(f(p) - f(q))² / 2σᵣ²) measures how similar a neighbour\'s brightness is to the center pixel under the red dot. If a neighbour across an edge has a very different intensity, its range weight drops to nearly 0!',
    whatYouSee:
      'Input image with red probe dot and the range weight grid. When the red dot is on an edge, the range weight grid splits: one side gets high weights (~1.0), the other side gets near 0.',
    whatToTry: [
      'Move "Probe x" and "Probe y" onto an edge boundary: observe how the range weight grid completely suppresses pixels from the other side of the edge!',
      'Decrease "Range σᵣ" to make the filter stricter about brightness similarity; increase it to tolerate larger brightness gaps.',
    ],
    whyItMatters:
      'This is the magic component that prevents the filter from averaging across object boundaries.',
  },
  'spatial-sigma': {
    title: 'Spatial Standard Deviation σₛ',
    unit: 'Unit 4: Bilateral Filtering',
    concept:
      'Spatial σₛ governs how far the filter reaches across the image (in pixels). Large σₛ allows the filter to pull in pixels from further away to average out low-frequency noise in flat regions.',
    whatYouSee:
      'Input image, filtered output with red probe dot, and line profile comparing edge sharpness.',
    whatToTry: [
      'Increase "Spatial σₛ" from 1 to 5: flat regions become much smoother, but as long as Range σᵣ is small, edges remain sharp.',
      'Move the red probe dot to a noisy flat region to observe the smoothing effect.',
    ],
    whyItMatters:
      'Tuning σₛ controls the spatial scale of textures you wish to smooth (e.g., skin pores vs. larger wrinkles).',
  },
  'range-sigma': {
    title: 'Range Standard Deviation σᵣ',
    unit: 'Unit 4: Bilateral Filtering',
    concept:
      'Range σᵣ sets the threshold for what counts as an "edge" versus "noise". If σᵣ is small (e.g., 15), small intensity jumps are treated as edges and kept sharp. If σᵣ → ∞, the range weight becomes 1 everywhere and bilateral collapses into standard Gaussian blur!',
    whatYouSee:
      'Input and output images with red probe dot, with comparative readouts showing edge rise distance before and after filtering.',
    whatToTry: [
      'Slide "Range σᵣ" from 10 up to 100: watch the sharp edges gradually break down and blur into ramps as σᵣ increases.',
      'Set σᵣ = 100 to see bilateral filtering turn completely into ordinary Gaussian blur.',
      'Move the red probe dot to an edge to see the exact edge rise measurement in the math steps.',
    ],
    whyItMatters:
      'Setting σᵣ just above the sensor noise standard deviation σₙ guarantees noise is smoothed while real visual edges survive.',
  },
  'bilateral-weight': {
    title: 'Bilateral Weight (Combined Product)',
    unit: 'Unit 4: Bilateral Filtering',
    concept:
      'The total bilateral kernel weight is the element-wise product: W(i, j) = w_s(i, j) · w_r(i, j). A neighbour must be BOTH physically nearby AND visually similar to receive a high weight.',
    whatYouSee:
      'Input image with red probe dot. Below, two grids show the Neighbourhood values and the final combined bilateral weights W.',
    whatToTry: [
      'Select preset "Right on an edge" (px=64, py=64): notice how the combined weights form an asymmetric shape that conforms perfectly to the object contour!',
      'Select preset "On a flat region" (px=20, py=20): notice how the combined weights become symmetric like a Gaussian because all neighbours have similar intensity.',
    ],
    whyItMatters:
      'The data-dependent, non-linear nature of bilateral weights makes it an adaptive filter that shapes itself to the image content.',
  },
  'edge-preserving-smoothing': {
    title: 'Edge-Preserving Smoothing in Action',
    unit: 'Unit 4: Bilateral Filtering',
    concept:
      'Direct visual proof of bilateral filtering solving the Unit 3 trade-off: comparing the 1D line profile before and after filtering reveals that flat areas are smoothed flat while the vertical edge step stays upright with zero ramp blur!',
    whatYouSee:
      'Before and after images with red probe dot at (px, py). The row profile plot confirms that the orange filtered step lines up with the original blue step.',
    whatToTry: [
      'Select preset "Sharp edge kept" (σ_r = 15): check the edge rise distance Δ_10-90 in the math steps—it is essentially unchanged!',
      'Select preset "Weak σ_r (edge blurs)" (σ_r = 100): notice the edge rise distance degrades significantly.',
      'Move "Probe x" and "Probe y" to test different edge angles and boundaries.',
    ],
    whyItMatters:
      'This edge-preserving property makes bilateral filtering essential in tone mapping for HDR displays and flash/no-flash photography.',
  },
  'patch-based-comparison': {
    title: 'Patch-Based Comparison & Non-Local Means',
    unit: 'Unit 4: Bilateral Filtering',
    concept:
      'Comparing individual noisy pixels can be unreliable because a random noise spike might trick the range weight. Patch-based comparison compares small n×n windows around pixels using Sum of Squared Differences (SSD) for robust similarity.',
    whatYouSee:
      'Input image with red probe dot and offset neighbour. Grids display the two n×n patches and their difference matrix.',
    whatToTry: [
      'Adjust "Neighbour offset Δx" and "Δy" to compare the probed patch with different nearby patches.',
      'Add noise and notice how the averaged SSD across the patch is far more stable than the single-pixel squared difference.',
      'Change "Patch size" from 3×3 to 7×7 to see how larger patches capture texture patterns.',
    ],
    whyItMatters:
      'Patch comparison is the core mechanism behind Non-Local Means (NLM) denoising, block matching (BM3D), and patch-based texture synthesis.',
  },
  'patch': {
    title: 'Image Patch Representation',
    unit: 'Unit 4: Bilateral Filtering',
    concept:
      'A patch is a small crop of pixels (e.g., 5×5) that serves as a local visual "fingerprint" capturing texture, gradient orientation, and surface reflectance.',
    whatYouSee:
      'Input image with red probe dot and dashed patch box. Grids display the numeric values of the probe patch and an offset neighbour patch.',
    whatToTry: [
      'Move "Probe x" and "Probe y" across flat, textured, and edge regions to observe how the patch numbers change.',
      'Increase "Patch size" from 3 to 9 to see larger contextual windows.',
    ],
    whyItMatters:
      'Patches form the tokens in Vision Transformers (ViT) and the receptive fields in modern deep neural networks.',
  },

  // =========================================================================
  // UNIT 5: IMAGE FORMATION & ENHANCEMENT
  // =========================================================================
  'retinex': {
    title: 'The Retinex Theory',
    unit: 'Unit 5: Image Formation & Enhancement',
    concept:
      'Retinex (Retina + Cortex) models an observed image I(x, y) as the product of two physical components: Illumination L(x, y) (light falling on the scene, smooth and slowly varying) and Reflectance R(x, y) (the surface\'s true intrinsic color, sharp at edges): I = L · R.',
    whatYouSee:
      'Observed image I on the left, estimated illumination L in the middle, and recovered intrinsic reflectance R on the right, all tracked with the moving red probe dot.',
    whatToTry: [
      'Move "Probe x" and "Probe y" (or click the image) to move the red probe dot from a brightly lit area to a dark shadow.',
      'Observe the decomposition: while observed brightness I drops sharply in the shadow, the recovered reflectance R stays nearly constant!',
      'Adjust "Illumination smoothing σ" and "Reflectance gain" to fine-tune the separation.',
    ],
    whyItMatters:
      'Human visual color constancy (a white page looks white under bright sun or dim candlelight) is explained by Retinex processing in our brain.',
  },
  'illumination': {
    title: 'Illumination Component L(x,y)',
    unit: 'Unit 5: Image Formation & Enhancement',
    concept:
      'Illumination L(x, y) represents ambient lighting from the sun, lamps, or shadows. Because physical light diffuses smoothly across space, illumination varies slowly. We can estimate it by applying a wide Gaussian blur to the observed image.',
    whatYouSee:
      'Original observed image I and the estimated illumination field L with the moving red probe dot.',
    whatToTry: [
      'Slide "Illumination smoothing σ" from 6 to 35: watch fine surface texture disappear from L, leaving only the slow light-field gradient.',
      'Move the red probe dot to verify that L captures the broad ambient lighting level at that location.',
    ],
    whyItMatters:
      'Used in automated shadow removal and shading correction in industrial machine vision and document scanning.',
  },
  'reflectance': {
    title: 'Reflectance Component R(x,y)',
    unit: 'Unit 5: Image Formation & Enhancement',
    concept:
      'Reflectance R(x, y) is the true material property of the object (how much light it reflects, between 0% and 100%). Dividing the observed image by the estimated illumination (R = I / L) eliminates shadows and reveals true texture.',
    whatYouSee:
      'Observed image I and the recovered reflectance image R = I / L with the moving red probe dot.',
    whatToTry: [
      'Move the red probe dot into a deep shadow: observe how dividing by L reveals objects hidden in darkness.',
      'Inspect the math steps below: they show the exact division R = I / L at the coordinates of the red probe dot!',
    ],
    whyItMatters:
      'Essential for albedo extraction in 3D computer graphics reconstruction and face recognition under uncontrolled lighting.',
  },
  'illumination-reflectance-model': {
    title: 'Illumination–Reflectance Model (Log Domain)',
    unit: 'Unit 5: Image Formation & Enhancement',
    concept:
      'Because I = L · R is multiplicative, taking logarithms converts it into a simple addition: log I = log L + log R. This homomorphic framework lets you separate lighting and reflectance using linear frequency filters.',
    whatYouSee:
      'Observed image, smooth illumination field, and high-pass log-reflectance result with red probe dot.',
    whatToTry: [
      'Adjust "Reflectance gain" to scale the contrast of recovered log-details.',
      'Move the red probe dot to inspect how log-subtraction preserves fine edges while flattening out illumination gradients.',
    ],
    whyItMatters:
      'Forms the foundation of Homomorphic Filtering, widely used to enhance unevenly illuminated medical endoscopy and microscopy images.',
  },
  'gamma-correction': {
    title: 'Gamma Correction (Power-Law Enhancement)',
    unit: 'Unit 5: Image Formation & Enhancement',
    concept:
      'Human visual perception of brightness is non-linear (logarithmic/power-law): we are far more sensitive to small differences in dark shadows than in bright highlights. Adding a flat brightness constant washes out shadows; gamma correction curves brightness perceptually.',
    whatYouSee:
      'Output image with the non-linear transfer curve s = c·r^γ. The moving red probe dot tracks input intensity r, and a green tangent shows the derivative.',
    whatToTry: [
      'Set Gamma γ = 0.45 (< 1): watch deep shadow details brighten without blowing out the highlights into pure white.',
      'Set Gamma γ = 2.2 (> 1): watch highlights become richer and shadows darken.',
      'Slide "Probe Intensity r" to watch the probe marker glide along the power-law curve in real time.',
    ],
    whyItMatters:
      'Every digital display, video standard (sRGB, Rec.709, HDR10), and phone camera uses gamma correction (γ ≈ 2.2) to match human visual perception.',
  },
  'gamma-transformation': {
    title: 'Gamma Transformation Mechanics',
    unit: 'Unit 5: Image Formation & Enhancement',
    concept:
      'The power-law formula s = c·r^γ maps input r to output s. When γ < 1, the curve bends upward with steep derivative at low intensities, expanding dark tones. When γ = 1, it is a straight identity line. When γ > 1, the curve bends downward.',
    whatYouSee:
      'Enhanced image and interactive power-law curve plot with tangent slope and red probe marker.',
    whatToTry: [
      'Select preset "γ < 1 (expand shadows)" and see the curve arch upward.',
      'Select preset "γ = 1 (identity)" to see the linear diagonal where input exactly equals output.',
      'Select preset "γ > 1 (expand highlights)" to see shadow tones compressed.',
    ],
    whyItMatters:
      'Standard tool in digital radiography to expand contrast in dense bone or soft lung tissue without loss of dynamic range.',
  },
  'power-law-transformation': {
    title: 'The Power-Law Transformation Family',
    unit: 'Unit 5: Image Formation & Enhancement',
    concept:
      'Power-law transformations form an entire family of curves s = c·r^γ indexed by γ. Unlike data-driven histogram equalization, power-law transformations give the user direct mathematical control over tonal expansion.',
    whatYouSee:
      'Enhanced image on the left; family of curves (γ = 0.2, 0.5, 1.0, 2.0, 3.0) plotted on the same graph on the right.',
    whatToTry: [
      'Compare γ = 0.2 (steep early climb) against the straight diagonal line γ = 1.0.',
      'Adjust the scaling constant c to observe how it scales the overall maximum dynamic range.',
      'Compare power-law enhancement against histogram equalization in the math notes below.',
    ],
    whyItMatters:
      'Classic textbook concept from Gonzalez & Woods Digital Image Processing, used in cinema color grading (LUT generation).',
  },
};

/**
 * Returns the rich topic intro for a given slug, or a helpful default if not found.
 */
export function getTopicIntro(slug: string, fallbackTitle?: string, fallbackUnit?: string): TopicIntro {
  if (TOPIC_INTROS[slug]) {
    return TOPIC_INTROS[slug];
  }
  return {
    title: fallbackTitle || 'Interactive Lab',
    unit: fallbackUnit || 'Digital Image Processing',
    concept:
      'This interactive lab demonstrates how changing mathematical parameters transforms visual pixel data in real time.',
    whatYouSee:
      'Live visual stage showing input and output images with real-time indicators and corresponding mathematical plots.',
    whatToTry: [
      'Adjust the parameter sliders to observe the immediate effect on the image.',
      'Move probe coordinates to inspect specific pixel values in the numeric grids.',
      'Check the math derivations drawer for step-by-step calculus and arithmetic.',
    ],
    whyItMatters:
      'Core concept in digital image processing, computational photography, and computer vision.',
  };
}
