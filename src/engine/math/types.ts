export interface StepHighlight {
  plot: string; // identifier of the plot, e.g. 'curve', 'histogram', 'cdf'
  kind: 'point' | 'range' | 'tangent';
  at: number | [number, number];
}

export interface Step {
  id: string;
  title: string;
  latex: string;
  substituted?: string;
  rationale?: string;
  value?: number | number[];
  highlight?: StepHighlight;
}

export interface StepEngineInput {
  params: Record<string, any>;
  probedR?: number;
  stats?: {
    totalPixels?: number;
    countAtR?: number;
    pdfAtR?: number;
    cdfAtR?: number;
  };
}
