import { useTheme } from '../contexts/ThemeContext';
import { ContentStatus } from '../types';
import { STAGES } from '../utils';
import { stageTabRow, stageTab } from '../ui';

export interface StageTab {
  id: ContentStatus;
  label: string;
  count: number;
}

interface Props {
  tabs: StageTab[];
  active: ContentStatus;
  onChange: (status: ContentStatus) => void;
}

// The phone board's stage switcher. Hand-scrolling a row of columns sideways
// hides both how many stages there are and how much sits in each; four tabs
// show every count at once and reach any stage in one tap.
//
// The active tab is underlined in that stage's own colour, so the colour
// vocabulary the pills already established carries the selection instead of a
// second, unrelated highlight.
export default function StageTabs({ tabs, active, onChange }: Props) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  return (
    <div className={stageTabRow} role="tablist" aria-label="Stage">
      {tabs.map((tab) => {
        const on = tab.id === active;
        const stage = STAGES.find((s) => s.id === tab.id);
        const accent = (dark ? stage?.textDark : stage?.text) ?? undefined;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab.id)}
            className={stageTab(on)}
            style={on ? { borderBottomColor: accent } : undefined}
          >
            <span className="text-[12px] font-semibold leading-none truncate max-w-full px-1">
              {tab.label}
            </span>
            <span
              className="text-[10px] font-semibold tabular-nums leading-none"
              style={on ? { color: accent } : undefined}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
