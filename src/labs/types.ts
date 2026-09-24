import React from 'react';
import { GrayImage } from '../engine/image/types';
import { Step } from '../engine/math/types';

export interface ParamDef {
  id: string;
  kind: 'slider' | 'toggle' | 'select';
  label: string;
  min?: number;
  max?: number;
  step?: number;
  default: any;
  unit?: string;
  options?: { value: string; label: string }[];
  advancedOnly?: boolean;
}

export interface PresetDef {
  label: string;
  params: Record<string, any>;
}

export interface LabStageProps {
  params: Record<string, any>;
  image: GrayImage;
  onImageChange?: (img: GrayImage) => void;
  highlightStep?: Step | null;
}

export interface LabModule {
  slug: string;
  params: ParamDef[];
  presets: PresetDef[];
  Stage: React.FC<LabStageProps>;
  Explain: React.FC<{ mode: 'beginner' | 'advanced'; params: Record<string, any> }>;
  buildSteps: (params: Record<string, any>, image: GrayImage, probedR?: number) => Step[];
}
