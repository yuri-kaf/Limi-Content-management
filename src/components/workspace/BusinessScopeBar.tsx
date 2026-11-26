import { Business } from '../../types';
import FolderIcon from '../FolderIcon';
import { scopeChip } from '../../ui';

interface Props {
  businesses: Business[];
  /** The business the workspace is scoped to, or undefined for all of them. */
  value: string | undefined;
  onChange: (businessId: string | undefined) => void;
  /** Chips only, to sit at the start of another row (the posts filter row). */
  inline?: boolean;
}

// With one business there is nothing to choose, so this renders nothing and a
// single-business client looks exactly as it did before businesses existed.
// The folder is never the only cue: every chip carries the business name.
export default function BusinessScopeBar({ businesses, value, onChange, inline = false }: Props) {
  if (businesses.length < 2) return null;
  return (
    <div
      role="group"
      aria-label="Business"
      className={inline
        ? 'flex items-center gap-1.5 flex-shrink-0 pr-1.5 mr-0.5 border-r border-hairline dark:border-hairline-dark'
        : 'flex items-center gap-1.5 px-5 h-12 flex-shrink-0 overflow-x-auto [scrollbar-width:none]'}
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
          <FolderIcon color={b.color} size={16} />
          {b.name}
        </button>
      ))}
    </div>
  );
}
