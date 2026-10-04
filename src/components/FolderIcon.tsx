import { useState } from 'react';
import { folderColor } from '../folderColors';

interface Props {
  /** A folder colour id. Anything unknown draws the default blue. */
  color?: string;
  /** Rendered width in px. The height follows the folder's proportions. */
  size?: number;
  /** Its first letter or digit is embossed on the front, from 40px up. */
  label?: string;
  /** A logo shown on the front instead of the letter, from 40px up. */
  imageUrl?: string;
  /**
   * For spacing and placement only. Don't use it to change the position, the
   * display or the transition: where it and a base class set the same property,
   * Tailwind's stylesheet order decides which wins, not the class list.
   */
  className?: string;
}

// Below this a letter or a logo is a smudge, so the folder is drawn plain.
const EMBLEM_MIN = 40;

// A folder narrower than this is a small one, and its emblem takes a bigger
// share of it: at 40px the usual 36% logo is 14px and the 26% letter 10px,
// which is hard to read.
const SMALL_FOLDER = 64;

// The first letter or digit, upper-cased, so "@momo" is M and not "@". Array.from
// walks whole characters, so an emoji at the start is stepped over rather than
// cut in half, as charAt(0) would. A name with no letter or digit has none.
function initialOf(label: string | undefined): string | undefined {
  return Array.from(label ?? '').find((ch) => /[\p{L}\p{N}]/u.test(ch))?.toUpperCase();
}

// A macOS-style folder in one of the ten folder colours, chosen the way you
// colour a folder in Finder or OneDrive. Always decorative: everywhere it
// appears, the name is written beside it. Hovering an ancestor marked
// `group/folder` lifts the folder and dips its front panel, as if it were
// opening. The group is named because a card that lifts itself on hover, as a
// business card does, is usually a `group` too, and the folder would then rise
// a second time on top of the card's own lift.
//
// The emblem is HTML over the SVG rather than SVG <image>, because an HTML
// image reliably reports a failed load, and a failed logo falls back to the
// letter. The failure is remembered against the URL that failed, not as a flag,
// because editing a client re-renders its folder rather than remounting it: a
// corrected URL has to get its turn without a reload.
export default function FolderIcon({ color, size = 20, label, imageUrl, className = '' }: Props) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const c = folderColor(color);
  const height = Math.round(size * 0.8125);
  const roomy = size >= EMBLEM_MIN;
  const small = size < SMALL_FOLDER;
  const logoSize = Math.round(size * (small ? 0.5 : 0.36));
  const letterSize = Math.round(size * (small ? 0.34 : 0.26));
  const showLogo = roomy && !!imageUrl && imageUrl !== failedUrl;
  const initial = roomy ? initialOf(label) : undefined;

  return (
    <span
      aria-hidden="true"
      data-folder-color={c.id}
      className={`relative inline-block flex-shrink-0 transition-transform duration-150 ease-out-soft [@media(hover:hover)]:group-hover/folder:-translate-y-0.5 ${className}`}
      style={{ width: size, height }}
    >
      <svg viewBox="0 0 64 52" width={size} height={height} className="block overflow-visible">
        {/* The back panel and its tab, in the full colour. */}
        <path
          d="M2 7a4 4 0 0 1 4-4h14.6a4 4 0 0 1 3.2 1.6L26.4 8H58a4 4 0 0 1 4 4v34a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4z"
          fill={c.swatch}
        />
        {/* The front panel, lighter, hinged at the bottom. */}
        <rect
          x="2"
          y="14"
          width="60"
          height="36"
          rx="4"
          fill={c.front}
          className="[transform-box:fill-box] origin-bottom transition-transform duration-150 ease-out-soft [@media(hover:hover)]:group-hover/folder:[transform:scaleY(.94)]"
        />
      </svg>
      {(showLogo || initial) && (
        <span className="absolute inset-x-0 bottom-0 top-[28%] flex items-center justify-center">
          {showLogo ? (
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              onError={() => setFailedUrl(imageUrl)}
              className="rounded-[22%] object-cover ring-2 ring-white/70"
              style={{ width: logoSize, height: logoSize }}
            />
          ) : (
            <span
              className="font-semibold leading-none"
              style={{ color: c.emblem, fontSize: letterSize }}
            >
              {initial}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
