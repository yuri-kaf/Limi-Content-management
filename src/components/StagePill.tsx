import { useTheme } from '../contexts/ThemeContext';
import { ContentStatus } from '../types';
import { STAGES } from '../utils';

interface Props {
  status: ContentStatus;
  /** Rendered before the label, for the "3 Review" form used on client cards. */
  count?: number;
}

// A stage as a soft tinted label rather than a saturated dot. The tint/text
// pairs are validated against WCAG AA in src/color.test.ts.
//
// This exists as a component because the pairs have to be applied as inline
// styles — they are data, not classes — and an inline style cannot express a
// dark-mode variant. Reading the theme here means every caller gets the right
// pair without repeating the choice, and there is one place to change if the
// palette moves again.
export default function StagePill({ status, count }: Props) {
  const { theme } = useTheme();
  const stage = STAGES.find((s) => s.id === status);
  if (!stage) return null;

  const dark = theme === 'dark';
  return (
    <span
      className="inline-flex items-center gap-1 px-2 h-[22px] rounded-tile text-[11px] font-medium whitespace-nowrap"
      style={{
        backgroundColor: dark ? stage.tintDark : stage.tint,
        color: dark ? stage.textDark : stage.text,
      }}
    >
      {count !== undefined && <span className="tabular-nums font-semibold">{count}</span>}
      {stage.label}
    </span>
  );
}
