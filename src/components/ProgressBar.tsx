import { folderColor } from '../folderColors';

interface Props {
  /** 0 to 1. Anything outside is clamped. */
  value: number;
  color: string | undefined;
  /** Read out in place of the bar, e.g. "3 of 7 posted". */
  label: string;
}

// Spans rather than divs so a bar is valid inside a <button> (a campaign card).
// The fill never carries meaning alone — every use sits beside the same numbers
// written out — which is what lets a light swatch like yellow be the fill.
export default function ProgressBar({ value, color, label }: Props) {
  const safe = Number.isFinite(value) ? value : 0;
  const pct = Math.round(Math.min(1, Math.max(0, safe)) * 100);
  return (
    <span
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className="block h-1.5 w-full rounded-full bg-hairline dark:bg-hairline-dark overflow-hidden"
    >
      <span
        className="block h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
        style={{ width: `${pct}%`, backgroundColor: folderColor(color).swatch }}
      />
    </span>
  );
}
