import React, { useRef } from 'react';
import { PRESETS, ProceduralPreset, loadUserImage } from '../../engine/image/procedural';
import { GrayImage } from '../../engine/image/types';
import { Upload, Image as ImageIcon } from 'lucide-react';

interface ImagePickerProps {
  currentPreset: ProceduralPreset | 'custom';
  onSelectPreset: (preset: ProceduralPreset) => void;
  onCustomImageLoaded: (img: GrayImage) => void;
}

export const ImagePicker: React.FC<ImagePickerProps> = ({
  currentPreset,
  onSelectPreset,
  onCustomImageLoaded,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const customImg = await loadUserImage(file, 256);
      onCustomImageLoaded(customImg);
    } catch (err) {
      console.error('Failed to load user image:', err);
      alert('Could not load image. Please try a standard JPG/PNG file.');
    }
  };

  return (
    <div className="space-y-2 py-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-text-light dark:text-text-dark flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-accent" />
          Sample Image
        </span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
        >
          <Upload className="w-3 h-3" />
          Upload Image
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
        {PRESETS.map((preset) => {
          const isSelected = currentPreset === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset.id)}
              className={`p-2 rounded-xl text-left border transition-all text-[11px] ${
                isSelected
                  ? 'border-accent bg-accent/10 font-semibold text-accent'
                  : 'border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark text-text-muted hover:border-accent/40'
              }`}
            >
              <div className="truncate font-medium">{preset.name.split(' (')[0]}</div>
              <div className="text-[9px] text-text-muted truncate mt-0.5 opacity-80">
                {preset.id}
              </div>
            </button>
          );
        })}
      </div>
      {currentPreset === 'custom' && (
        <div className="text-[11px] text-accent font-medium px-2 py-1 rounded-lg bg-accent/10">
          Using custom uploaded image (downscaled to ≤256px)
        </div>
      )}
    </div>
  );
};
