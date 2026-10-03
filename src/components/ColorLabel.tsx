import { ReactNode } from 'react';
import { folderColorVars, folderTint } from '../folderColors';

interface Props {
  color: string | undefined;
  children: ReactNode;
  className?: string;
  /** The full text on hover, for a label narrow enough to truncate. */
  title?: string;
}

// A short tinted label in one of the folder colours — a campaign on a card, a
// campaign's status. The colours arrive as custom properties, so the label
// follows the theme without reading it (see folderColorVars). It sets no
// max-width of its own: a caller that needs a cap passes one, and a built-in
// max-w-full would beat it, because Tailwind orders same-property utilities
// itself, whatever their order in the class list.
export default function ColorLabel({ color, children, className = '', title }: Props) {
  return (
    <span
      title={title}
      className={`inline-flex items-center min-w-0 px-1.5 h-[18px] rounded-tile text-[10px] font-semibold whitespace-nowrap ${folderTint} ${className}`}
      style={folderColorVars(color)}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}
