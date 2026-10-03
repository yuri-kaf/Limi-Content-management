import { Check } from 'lucide-react';
import { FolderColor } from '../types';
import { FOLDER_COLORS } from '../folderColors';

interface Props {
  value: FolderColor;
  onChange: (color: FolderColor) => void;
  /** Names the group for screen readers, e.g. "Folder colour". */
  label: string;
}

// A radio group drawn as swatches, like choosing a folder colour in Finder or
// OneDrive. Every swatch carries its colour's name, so the choice never rests
// on telling two hues apart.
export default function ColorSwatchPicker({ value, onChange, label }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {FOLDER_COLORS.map((c) => {
        const on = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={c.label}
            title={c.label}
            onClick={() => onChange(c.id)}
            className={`w-7 h-7 rounded-full inline-flex items-center justify-center transition-transform duration-150 hover:scale-110 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ring-offset-2 ring-offset-canvas dark:ring-offset-canvas-dark ${
              on ? 'ring-2 ring-ink dark:ring-ink-dark' : ''
            }`}
            style={{ backgroundColor: c.swatch }}
          >
            {on && <Check size={14} strokeWidth={3} className="text-white drop-shadow" />}
          </button>
        );
      })}
    </div>
  );
}
