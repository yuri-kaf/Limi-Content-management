import { useRef } from 'react';
import { Check } from 'lucide-react';
import { FolderColor } from '../types';
import { FOLDER_COLORS } from '../folderColors';
import { contrastRatio } from '../color';

interface Props {
  value: FolderColor;
  onChange: (color: FolderColor) => void;
  /** Names the group for screen readers, e.g. "Folder colour". */
  label: string;
}

// The tick sits on the swatch itself, so it takes whichever of white or ink
// reads there: white all but disappears on yellow, green and teal.
function tickClass(swatch: string): string {
  return contrastRatio('#ffffff', swatch) >= 3 ? 'text-white' : 'text-ink';
}

// A radio group drawn as swatches, like choosing a folder colour in Finder or
// OneDrive. Every swatch carries its colour's name, so the choice never rests
// on telling two hues apart. It behaves as a radio group too: one Tab stop, on
// the chosen colour, and the arrow keys move the choice.
export default function ColorSwatchPicker({ value, onChange, label }: Props) {
  const swatches = useRef<(HTMLButtonElement | null)[]>([]);
  const chosen = FOLDER_COLORS.findIndex((c) => c.id === value);
  // With an unknown value nothing is chosen, and the first swatch takes the stop.
  const tabStop = chosen === -1 ? 0 : chosen;

  function choose(index: number) {
    const i = (index + FOLDER_COLORS.length) % FOLDER_COLORS.length;
    onChange(FOLDER_COLORS[i].id);
    swatches.current[i]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const to =
      e.key === 'ArrowRight' || e.key === 'ArrowDown' ? index + 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? index - 1
      : e.key === 'Home' ? 0
      : e.key === 'End' ? FOLDER_COLORS.length - 1
      : null;
    if (to === null) return;
    e.preventDefault();
    choose(to);
  }

  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {FOLDER_COLORS.map((c, i) => {
        const on = c.id === value;
        return (
          <button
            key={c.id}
            ref={(el) => {
              swatches.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={c.label}
            title={c.label}
            tabIndex={i === tabStop ? 0 : -1}
            onClick={() => onChange(c.id)}
            onKeyDown={(e) => onKeyDown(e, i)}
            // Focus is drawn as an outline and the choice as a ring, so on the
            // chosen swatch — where focus usually is — neither hides the other.
            className={`w-7 h-7 rounded-full inline-flex items-center justify-center transition-transform duration-150 hover:scale-110 motion-reduce:transition-none focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand ${
              on
                ? 'ring-2 ring-offset-2 ring-ink dark:ring-ink-dark ring-offset-canvas dark:ring-offset-canvas-dark'
                : ''
            }`}
            style={{ backgroundColor: c.swatch }}
          >
            {on && <Check size={14} strokeWidth={3} className={tickClass(c.swatch)} />}
          </button>
        );
      })}
    </div>
  );
}
