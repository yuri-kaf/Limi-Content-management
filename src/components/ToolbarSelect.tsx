import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { toolbarSelect, toolbarSelectChevron, toolbarSelectWrap } from '../ui';

// A native <select> for a toolbar, drawn like the compact buttons beside it.
// It stays native for its keyboard and screen-reader behaviour and the OS
// picker on a phone; only the closed control is restyled: no OS chevron
// (appearance-none), and a lucide one drawn over its right edge instead.
// No className: the recipe is the look, and one passed in would be dropped.
type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'>;

export default function ToolbarSelect(props: Props) {
  return (
    <span className={toolbarSelectWrap}>
      <select {...props} className={toolbarSelect} />
      <ChevronDown size={13} aria-hidden="true" className={toolbarSelectChevron} />
    </span>
  );
}
