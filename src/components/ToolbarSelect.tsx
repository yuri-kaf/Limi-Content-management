import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from '../icons';
import { focusRing } from '../ui';

// A native <select> drawn as an M3 outlined chip, like the filter chips beside
// it: 32px under a pointer, 40px where there is none, a hairline outline, the
// chevron drawn over the right edge. It stays native for its keyboard and
// screen-reader behaviour and the OS picker on a phone; only the closed control
// is restyled. No className: the look is fixed, and one passed in would be dropped.
type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'>;

const wrap = 'relative inline-flex min-w-0 max-w-[150px] sm:max-w-[220px] flex-shrink-0';
const select = `appearance-none w-full h-8 [@media(hover:none)]:h-10 pl-3 pr-8 truncate bg-raised dark:bg-raised-dark border border-transparent rounded-full text-[12px] font-medium text-ink-soft dark:text-ink-softdark hover:bg-hover dark:hover:bg-hover-dark hover:text-ink dark:hover:text-ink-dark transition-colors cursor-pointer ${focusRing}`;

export default function ToolbarSelect(props: Props) {
  return (
    <span className={wrap}>
      <select {...props} className={select} />
      <ChevronDown
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint dark:text-ink-faintdark"
      />
    </span>
  );
}
