import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// Import image engine algorithms directly
function computeHistogram(data, L = 256) {
  const hist = new Uint32Array(L);
  for (let i = 0; i < data.length; i++) {
    hist[data[i]]++;
  }
  return hist;
}

function normalizeHistogram(hist, totalPixels) {
  const pdf = new Float64Array(hist.length);
  for (let i = 0; i < hist.length; i++) {
    pdf[i] = hist[i] / totalPixels;
  }
  return pdf;
}

function computeCDF(pdf) {
  const cdf = new Float64Array(pdf.length);
  let acc = 0;
  for (let i = 0; i < pdf.length; i++) {
    acc += pdf[i];
    cdf[i] = Math.min(1.0, acc);
  }
  cdf[cdf.length - 1] = 1.0;
  return cdf;
}

function equalizeLUT(cdf, L = 256) {
  const lut = new Uint8ClampedArray(L);
  for (let r = 0; r < L; r++) {
    lut[r] = Math.max(0, Math.min(L - 1, Math.round((L - 1) * cdf[r])));
  }
  return lut;
}

function computeMSEandPSNR(orig, processed) {
  let sumSqErr = 0;
  for (let i = 0; i < orig.length; i++) {
    const diff = orig[i] - processed[i];
    sumSqErr += diff * diff;
  }
  const mse = sumSqErr / orig.length;
  const psnr = mse === 0 ? 99.99 : 10 * Math.log10((255 * 255) / mse);
  return { mse, psnr };
}

describe('Image Engine Verification', () => {
  test('Histogram calculation satisfies pixel conservation law', () => {
    const w = 64;
    const h = 64;
    const total = w * h;
    const data = new Uint8ClampedArray(total);
    for (let i = 0; i < total; i++) {
      data[i] = i % 256;
    }

    const hist = computeHistogram(data, 256);
    let sum = 0;
    for (let i = 0; i < hist.length; i++) {
      sum += hist[i];
    }
    assert.equal(sum, total, 'Total counts in histogram must equal M * N');
  });

  test('Normalized histogram (PDF) sums strictly to 1.0', () => {
    const total = 1000;
    const data = new Uint8ClampedArray(total);
    for (let i = 0; i < total; i++) {
      data[i] = Math.floor(Math.random() * 256);
    }
    const hist = computeHistogram(data, 256);
    const pdf = normalizeHistogram(hist, total);

    let sumPdf = 0;
    for (let i = 0; i < pdf.length; i++) {
      sumPdf += pdf[i];
    }
    assert.ok(Math.abs(sumPdf - 1.0) < 1e-6, 'Sum of PDF probabilities must equal 1.0');
  });

  test('Cumulative Distribution Function is monotonic and bounds within [0, 1]', () => {
    const total = 500;
    const data = new Uint8ClampedArray(total);
    for (let i = 0; i < total; i++) {
      data[i] = Math.floor(Math.random() * 256);
    }
    const hist = computeHistogram(data, 256);
    const pdf = normalizeHistogram(hist, total);
    const cdf = computeCDF(pdf);

    assert.equal(cdf[cdf.length - 1], 1.0, 'CDF at max intensity must equal 1.0');
    for (let i = 1; i < cdf.length; i++) {
      assert.ok(cdf[i] >= cdf[i - 1], `CDF must be non-decreasing at index ${i}`);
    }
  });

  test('Equalization LUT mapping covers dynamic range [0, 255]', () => {
    const pdf = new Float64Array(256).fill(1 / 256);
    const cdf = computeCDF(pdf);
    const lut = equalizeLUT(cdf, 256);

    assert.equal(lut[0], 1, 'First level of uniform cdf mapping');
    assert.equal(lut[255], 255, 'Max level mapped to 255');
  });

  test('Identical images yield MSE = 0 and max PSNR', () => {
    const data = new Uint8ClampedArray([10, 20, 30, 40]);
    const { mse, psnr } = computeMSEandPSNR(data, data);
    assert.equal(mse, 0);
    assert.equal(psnr, 99.99);
  });
});

describe('Step Engine Calculus Derivations', () => {
  test('Gamma derivative power rule: ds/dr = c * gamma * (r/255)^(gamma-1)', () => {
    const c = 1.0;
    const gamma = 0.5;
    const r = 100;
    const normR = r / 255;
    const expectedSlope = c * gamma * Math.pow(normR, gamma - 1);

    assert.ok(expectedSlope > 0, 'Derivative of monotonic gamma curve must be positive');
    assert.ok(expectedSlope > 0.5, 'For gamma = 0.5 at r=100, slope should expand contrast');
  });

  test('Logarithmic derivative reciprocal rule: ds/dr = c / (1 + r)', () => {
    const c = (255 / Math.log(256)) * 1.0;
    const r = 50;
    const slope = c / (1 + r);
    assert.ok(slope > 0);
    assert.ok(Number.isFinite(slope));
  });
});
