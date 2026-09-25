import React, { useRef, useState } from 'react';
import { PRESETS, ProceduralPreset, REAL_SAMPLES, generateProceduralImage, loadImageFromUrl, loadUserImage } from '../../engine/image/procedural';
import { GrayImage } from '../../engine/image/types';
import { Upload, Image as ImageIcon, Camera, ChevronDown } from 'lucide-react';
import { useAppStore } from '../../state/store';

interface ImagePickerProps {
  /** A generated test preset id, the id of a real reference photo prefixed 'real:', or 'custom' for an uploaded photo. */
  currentPreset: ProceduralPreset | 'custom' | string;
  onSelectPreset: (preset: ProceduralPreset) => void;
  onCustomImageLoaded: (img: GrayImage) => void;
  /** Called when the user picks one of the bundled real reference photos (id from REAL_SAMPLES). */
  onSelectRealSample?: (id: string) => void;
}

// Small live thumbnail rendered straight from the procedural generator, so people
// pick a photo by recognising it — not by reading its filename.
const Thumb: React.FC<{ id: ProceduralPreset }> = ({ id }) => {
  const [url, setUrl] = useState<string | null>(null);
  React.useEffect(() => {
    const img = generateProceduralImage(id, 48);
    const canvas = document.createElement('canvas');
    canvas.width = img.w; canvas.height = img.h;
    const ctx = canvas.getContext('2d')!;
    const id2 = ctx.createImageData(img.w, img.h);
    for (let i = 0; i < img.data.length; i++) { id2.data[i * 4] = id2.data[i * 4 + 1] = id2.data[i * 4 + 2] = img.data[i]; id2.data[i * 4 + 3] = 255; }
    ctx.putImageData(id2, 0, 0);
    setUrl(canvas.toDataURL());
  }, [id]);
  return url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-surface-mutedLight dark:bg-surface-mutedDark" />;
};

export const ImagePicker: React.FC<ImagePickerProps> = ({ currentPreset, onSelectPreset, onCustomImageLoaded, onSelectRealSample }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [morePatterns, setMorePatterns] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState<string | null>(null);
  const { viewMode } = useAppStore();

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please choose an image file (JPG, PNG, etc).'); return; }
    setError(null);
    try { onCustomImageLoaded(await loadUserImage(file, 256)); }
    catch { setError('Could not open that image — please try a different photo.'); }
  };

  const handleRealSample = async (id: string, url: string) => {
    setError(null);
    setLoadingSample(id);
    try {
      const img = await loadImageFromUrl(url, 256);
      onSelectRealSample?.(id);
      onCustomImageLoaded(img);
    } catch {
      setError('Could not load that reference photo — please try another.');
    } finally {
      setLoadingSample(null);
    }
  };

  const photoPresets = PRESETS.filter((p) => p.photo);
  const patternPresets = PRESETS.filter((p) => !p.photo);

  return (
    <div className="space-y-3 py-2">
      {/* Prominent upload call-to-action */}
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files?.[0]); }}
        className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 border-dashed transition-all text-left ${
          dragOver ? 'border-accent bg-accent/10' : 'border-accent/40 hover:border-accent hover:bg-accent/5'
        }`}
      >
        <span className="flex-shrink-0 w-9 h-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center"><Upload className="w-4 h-4" /></span>
        <span className="min-w-0">
          <span className="block text-xs font-semibold text-text-light dark:text-text-dark">Use your own photo</span>
          <span className="block text-[11px] text-text-muted truncate">Drop an image here, or tap to choose one from your device</span>
        </span>
      </button>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      {error && <p className="text-[11px] text-secondary px-1">{error}</p>}

      {/* Real reference photographs bundled with the app */}
      <div className="flex items-center gap-1.5 text-xs font-medium text-text-light dark:text-text-dark px-0.5">
        <Camera className="w-3.5 h-3.5 text-accent" /> {viewMode === 'beginner' ? 'Or pick a real reference photo' : 'Reference photos'}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {REAL_SAMPLES.map((sample) => (
          <button
            key={sample.id}
            type="button"
            title={sample.description}
            disabled={loadingSample !== null}
            onClick={() => handleRealSample(sample.id, sample.url)}
            className={`group rounded-xl overflow-hidden border text-left transition-all disabled:opacity-60 ${
              currentPreset === `real:${sample.id}` ? 'border-accent ring-2 ring-accent/40' : 'border-border-light dark:border-border-dark hover:border-accent/50'
            }`}
          >
            <div className="aspect-[4/3] w-full overflow-hidden bg-surface-mutedLight dark:bg-surface-mutedDark relative">
              <img src={sample.url} alt={sample.name} className="w-full h-full object-cover grayscale group-hover:scale-105 transition-transform" loading="lazy" />
              {loadingSample === sample.id && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-[10px] font-medium">Loading…</div>
              )}
            </div>
            <div className={`px-1.5 py-1 text-[10px] font-medium truncate ${currentPreset === `real:${sample.id}` ? 'text-accent' : 'text-text-muted'}`}>{sample.name}</div>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 text-xs font-medium text-text-light dark:text-text-dark px-0.5 pt-1">
        <ImageIcon className="w-3.5 h-3.5 text-accent" /> {viewMode === 'beginner' ? 'Or pick a generated example' : 'Generated test images'}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {photoPresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            title={preset.description}
            onClick={() => onSelectPreset(preset.id)}
            className={`group rounded-xl overflow-hidden border text-left transition-all ${
              currentPreset === preset.id ? 'border-accent ring-2 ring-accent/40' : 'border-border-light dark:border-border-dark hover:border-accent/50'
            }`}
          >
            <div className="aspect-[4/3] w-full overflow-hidden bg-surface-mutedLight dark:bg-surface-mutedDark"><Thumb id={preset.id} /></div>
            <div className={`px-1.5 py-1 text-[10px] font-medium truncate ${currentPreset === preset.id ? 'text-accent' : 'text-text-muted'}`}>{preset.name}</div>
          </button>
        ))}
      </div>

      {viewMode === 'advanced' && (
        <div className="pt-1">
          <button type="button" onClick={() => setMorePatterns((v) => !v)} className="flex items-center gap-1 text-[11px] font-semibold text-text-muted hover:text-accent">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${morePatterns ? 'rotate-180' : ''}`} /> Test patterns (gradient, checkerboard, ripples)
          </button>
          {morePatterns && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {patternPresets.map((preset) => (
                <button key={preset.id} type="button" title={preset.description} onClick={() => onSelectPreset(preset.id)}
                  className={`rounded-xl overflow-hidden border text-left transition-all ${currentPreset === preset.id ? 'border-accent ring-2 ring-accent/40' : 'border-border-light dark:border-border-dark hover:border-accent/50'}`}>
                  <div className="aspect-[4/3] w-full overflow-hidden bg-surface-mutedLight dark:bg-surface-mutedDark"><Thumb id={preset.id} /></div>
                  <div className={`px-1.5 py-1 text-[10px] font-medium truncate ${currentPreset === preset.id ? 'text-accent' : 'text-text-muted'}`}>{preset.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {currentPreset === 'custom' && (
        <div className="text-[11px] text-accent font-medium px-2 py-1.5 rounded-lg bg-accent/10">Using your uploaded photo (resized to fit)</div>
      )}
      {typeof currentPreset === 'string' && currentPreset.startsWith('real:') && (
        <div className="text-[11px] text-accent font-medium px-2 py-1.5 rounded-lg bg-accent/10">
          Using the {REAL_SAMPLES.find((s) => `real:${s.id}` === currentPreset)?.name ?? 'reference'} photo (resized to fit)
        </div>
      )}
    </div>
  );
};
