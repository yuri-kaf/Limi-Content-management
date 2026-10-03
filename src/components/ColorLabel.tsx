import { ReactNode } from 'react';
import { folderColorVars, folderTint } from '../folderColors';

interface Props {
  color: string | undefined;
  children: ReactNode;
  className?: string;
}

// A short tinted label in one of the folder colours — a campaign on a card, a
// campaign's status. The colours arrive as custom properties, so the label
// follows the theme without reading it (see folderColorVars).
export default function ColorLabel({ color, children, className = '' }: Props) {
  return (
    <span
      className={`inline-flex items-center min-w-0 max-w-full px-1.5 h-[18px] rounded-tile text-[10px] font-semibold whitespace-nowrap ${folderTint} ${className}`}
      style={folderColorVars(color)}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
