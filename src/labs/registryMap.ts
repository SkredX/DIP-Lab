import { LabModule } from './types';
import {
  digitalImageLab,
  grayscaleImageLab,
  pixelIntensityLab,
  intensityLevelsLab,
  imageAsMatrixLab,
  intensityTransformationLab,
  imageHistogramLab,
  intensityProbabilityLab,
  pdfLab,
  cdfLab,
} from './unit1Labs';
import {
  histogramEqualizationLab,
  equalizationMappingLab,
  normalizedHistogramLab,
  histogramTransformationLab,
  inverseHistogramTransformationLab,
  histogramMatchingLab,
  histogramSpecificationLab,
  cdfMatchingLab,
  globalHistogramProcessingLab,
  localVsGlobalLab,
} from './unit2Labs';
import {
  spatialFilteringLab,
  neighborhoodProcessingLab,
  kernelMaskLab,
  convolutionLab,
  boxFilterLab,
  meanFilterLab,
  smoothingLab,
  gaussianFilteringLab,
  gaussianFunctionLab,
  gaussianWeightingLab,
  gaussianSmoothingLab,
  edgeBlurringLab,
} from './unit3Labs';
import {
  bilateralFilteringLab,
  spatialWeightLab,
  rangeWeightLab,
  spatialSigmaLab,
  rangeSigmaLab,
  bilateralWeightLab,
  edgePreservingSmoothingLab,
  patchBasedComparisonLab,
  patchLab,
} from './unit4Labs';
import {
  retinexLab,
  illuminationLab,
  reflectanceLab,
  illuminationReflectanceModelLab,
  gammaCorrectionLab,
  gammaTransformationLab,
  powerLawTransformationLab,
} from './unit5Labs';

export const LAB_MODULES: Record<string, LabModule> = {
  // Unit 1
  'digital-image': digitalImageLab,
  'grayscale-image': grayscaleImageLab,
  'pixel-intensity': pixelIntensityLab,
  'intensity-levels': intensityLevelsLab,
  'image-as-matrix': imageAsMatrixLab,
  'intensity-transformation': intensityTransformationLab,
  'image-histogram': imageHistogramLab,
  'intensity-probability': intensityProbabilityLab,
  'pdf': pdfLab,
  'cdf': cdfLab,

  // Unit 2
  'histogram-equalization': histogramEqualizationLab,
  'equalization-mapping': equalizationMappingLab,
  'normalized-histogram': normalizedHistogramLab,
  'histogram-transformation': histogramTransformationLab,
  'inverse-histogram-transformation': inverseHistogramTransformationLab,
  'histogram-matching': histogramMatchingLab,
  'histogram-specification': histogramSpecificationLab,
  'cdf-matching': cdfMatchingLab,
  'global-histogram-processing': globalHistogramProcessingLab,
  'local-vs-global': localVsGlobalLab,

  // Unit 3
  'spatial-filtering': spatialFilteringLab,
  'neighborhood-processing': neighborhoodProcessingLab,
  'kernel-mask': kernelMaskLab,
  'convolution-filtering': convolutionLab,
  'box-filter': boxFilterLab,
  'mean-filter': meanFilterLab,
  'smoothing': smoothingLab,
  'gaussian-filtering': gaussianFilteringLab,
  'gaussian-function': gaussianFunctionLab,
  'gaussian-weighting': gaussianWeightingLab,
  'gaussian-smoothing': gaussianSmoothingLab,
  'edge-blurring': edgeBlurringLab,

  // Unit 4
  'bilateral-filtering': bilateralFilteringLab,
  'spatial-weight': spatialWeightLab,
  'range-weight': rangeWeightLab,
  'spatial-sigma': spatialSigmaLab,
  'range-sigma': rangeSigmaLab,
  'bilateral-weight': bilateralWeightLab,
  'edge-preserving-smoothing': edgePreservingSmoothingLab,
  'patch-based-comparison': patchBasedComparisonLab,
  'patch': patchLab,

  // Unit 5
  'retinex': retinexLab,
  'illumination': illuminationLab,
  'reflectance': reflectanceLab,
  'illumination-reflectance-model': illuminationReflectanceModelLab,
  'gamma-correction': gammaCorrectionLab,
  'gamma-transformation': gammaTransformationLab,
  'power-law-transformation': powerLawTransformationLab,
};

export function getLabModule(slug: string): LabModule | undefined {
  return LAB_MODULES[slug];
}
