import { Business } from '../../types';
import { folderColor } from '../../folderColors';
import { scopeChip } from '../../ui';

interface Props {
  businesses: Business[];
  /** The business the workspace is scoped to, or undefined for all of them. */
  value: string | undefined;
  onChange: (businessId: string | undefined) => void;
}

// With one business there is nothing to choose, so this renders nothing and a
// single-business client looks exactly as it did before businesses existed.
// The colour dot is never the only cue: every chip carries the business name.
export default function BusinessScopeBar({ businesses, value, onChange }: Props) {
  if (businesses.length < 2) return null;
  return (
    <div
      role="group"
      aria-label="Business"
      className="flex items-center gap-1 px-4 h-10 flex-shrink-0 border-b border-hairline dark:border-hairline-dark overflow-x-auto [scrollbar-width:none]"
    >
      <button onClick={() => onChange(undefined)} aria-pressed={!value} className={scopeChip(!value)}>
        All businesses
      </button>
      {businesses.map((b) => (
        <button
          key={b.id}
          onClick={() => onChange(b.id)}
          aria-pressed={value === b.id}
          className={scopeChip(value === b.id)}
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: folderColor(b.color).swatch }}
            aria-hidden="true"
          />
          {b.name}
        </button>
      ))}
    </div>
  );
}
