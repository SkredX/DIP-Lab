import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { TOPICS, UNITS } from '../content/registry';
import { getLabModule } from '../labs/registryMap';
import { LabLayout } from '../components/shell/LabLayout';
import { Slider } from '../components/controls/Slider';
import { Toggle } from '../components/controls/Toggle';
import { ImagePicker } from '../components/controls/ImagePicker';
import { ProceduralPreset, generateProceduralImage } from '../engine/image/procedural';
import { GrayImage } from '../engine/image/types';
import { useAppStore } from '../state/store';
import { Step } from '../engine/math/types';

export const LabPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { viewMode } = useAppStore();

  const topicMeta = useMemo(() => TOPICS.find((t) => t.slug === slug), [slug]);
  const labModule = useMemo(() => (slug ? getLabModule(slug) : undefined), [slug]);

  // Find unit
  const unit = useMemo(
    () => (topicMeta ? UNITS.find((u) => u.id === topicMeta.unitId) : undefined),
    [topicMeta]
  );

  // Find prev/next topics in registry order
  const { prevTopic, nextTopic } = useMemo(() => {
    if (!topicMeta) return { prevTopic: undefined, nextTopic: undefined };
    const idx = TOPICS.findIndex((t) => t.slug === topicMeta.slug);
    const prev = idx > 0 ? TOPICS[idx - 1] : undefined;
    const next = idx < TOPICS.length - 1 ? TOPICS[idx + 1] : undefined;
    return { prevTopic: prev, nextTopic: next };
  }, [topicMeta]);

  // Initial parameters
  const [params, setParams] = useState<Record<string, any>>(() => {
    if (!labModule) return {};
    const initial: Record<string, any> = {};
    for (const p of labModule.params) {
      initial[p.id] = p.default;
    }
    return initial;
  });

  // Reset params on slug change
  useEffect(() => {
    if (labModule) {
      const initial: Record<string, any> = {};
      for (const p of labModule.params) {
        initial[p.id] = p.default;
      }
      setParams(initial);
    }
  }, [labModule, slug]);

  // Sample image state
  const defaultPreset: ProceduralPreset = useMemo(() => {
    if (slug === 'histogram-equalization') return 'lowContrast';
    if (slug === 'checker' || slug === 'digital-image') return 'checker';
    if (slug === 'global-histogram-processing') return 'uneven';
    return 'lowContrast';
  }, [slug]);

  const [currentPreset, setCurrentPreset] = useState<ProceduralPreset | 'custom'>(defaultPreset);
  const [image, setImage] = useState<GrayImage>(() => generateProceduralImage(defaultPreset, 128));

  // Reset image when default preset changes
  useEffect(() => {
    setCurrentPreset(defaultPreset);
    setImage(generateProceduralImage(defaultPreset, 128));
  }, [defaultPreset]);

  const handleSelectPreset = (preset: ProceduralPreset) => {
    setCurrentPreset(preset);
    setImage(generateProceduralImage(preset, 128));
  };

  const handleCustomImage = (customImg: GrayImage) => {
    setCurrentPreset('custom');
    setImage(customImg);
  };

  const handleParamChange = useCallback((id: string, val: any) => {
    setParams((prev) => ({ ...prev, [id]: val }));
  }, []);

  const handleApplyPreset = (presetParams: Record<string, any>) => {
    setParams((prev) => ({ ...prev, ...presetParams }));
  };

  const handleReset = () => {
    if (!labModule) return;
    const initial: Record<string, any> = {};
    for (const p of labModule.params) {
      initial[p.id] = p.default;
    }
    setParams(initial);
  };

  // Compute live generative math steps
  const steps: Step[] = useMemo(() => {
    if (!labModule?.buildSteps) return [];
    try {
      return labModule.buildSteps(params, image);
    } catch (err) {
      console.error('Error generating steps:', err);
      return [];
    }
  }, [labModule, params, image]);

  if (!topicMeta || !labModule) {
    return <Navigate to="/" replace />;
  }

  const { Stage, Explain } = labModule;

  // Filter params by viewMode (hide advancedOnly if beginner)
  const visibleParams = labModule.params.filter(
    (p) => viewMode === 'advanced' || !p.advancedOnly
  );

  return (
    <LabLayout
      unitTitle={unit?.title || 'Digital Image Processing'}
      topicTitle={topicMeta.title}
      hook={topicMeta.hook}
      prevTopic={prevTopic ? { slug: prevTopic.slug, title: prevTopic.title } : undefined}
      nextTopic={nextTopic ? { slug: nextTopic.slug, title: nextTopic.title } : undefined}
      presets={labModule.presets}
      onApplyPreset={handleApplyPreset}
      onReset={handleReset}
      steps={steps}
      childrenStage={<Stage params={params} image={image} onImageChange={setImage} />}
      childrenControls={
        <div className="space-y-4">
          <ImagePicker
            currentPreset={currentPreset}
            onSelectPreset={handleSelectPreset}
            onCustomImageLoaded={handleCustomImage}
          />

          <div className="pt-2 border-t border-border-light dark:border-border-dark space-y-3">
            {visibleParams.map((p) => {
              if (p.kind === 'slider') {
                return (
                  <Slider
                    key={p.id}
                    id={p.id}
                    label={p.label}
                    min={p.min ?? 0}
                    max={p.max ?? 100}
                    step={p.step ?? 1}
                    value={params[p.id] ?? p.default}
                    defaultValue={p.default}
                    unit={p.unit}
                    onChange={(val) => handleParamChange(p.id, val)}
                  />
                );
              }
              if (p.kind === 'toggle') {
                return (
                  <Toggle
                    key={p.id}
                    id={p.id}
                    label={p.label}
                    checked={params[p.id] ?? p.default}
                    onChange={(checked) => handleParamChange(p.id, checked)}
                  />
                );
              }
              if (p.kind === 'select' && p.options) {
                return (
                  <div key={p.id} className="space-y-1.5 py-1">
                    <label
                      htmlFor={p.id}
                      className="text-xs font-medium text-text-light dark:text-text-dark block"
                    >
                      {p.label}
                    </label>
                    <select
                      id={p.id}
                      value={params[p.id] ?? p.default}
                      onChange={(e) => handleParamChange(p.id, e.target.value)}
                      className="w-full text-xs p-2 rounded-xl border border-border-light dark:border-border-dark bg-surface-mutedLight dark:bg-surface-mutedDark text-text-light dark:text-text-dark focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      {p.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      }
      childrenExplain={<Explain mode={viewMode} params={params} />}
    />
  );
};
