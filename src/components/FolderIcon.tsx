import { useState } from 'react';
import { folderColor } from '../folderColors';

interface Props {
  /** A folder colour id. Anything unknown draws the default blue. */
  color?: string;
  /** Rendered width in px. The height follows the folder's proportions. */
  size?: number;
  /** Its first letter or digit is embossed on the front, from 40px up. */
  label?: string;
  /**
   * Show the initial even below 40px, where nothing beside the folder names it
   * — the collapsed sidebar. A logo still needs 40px.
   */
  forceInitial?: boolean;
  /** A logo shown on the front instead of the letter, from 40px up. */
  imageUrl?: string;
  /**
   * For spacing and placement only. Don't use it to change the position, the
   * display or the transition: where it and a base class set the same property,
   * Tailwind's stylesheet order decides which wins, not the class list.
   */
  className?: string;
}

// Below this a letter or a logo is a smudge, so the folder is drawn plain. The
// exception is a forced initial, which is drawn bigger to make up for it.
const EMBLEM_MIN = 40;

// The share of a small folder's width that a forced initial takes: 10px on the
// 24px folder of the collapsed sidebar, where the 34% a roomy folder gives it
// would be 8px.
const FORCED_LETTER_SHARE = 0.42;

// A small folder gives its emblem a bigger share of its width: at 40px the plain
// 36% logo is 14px and the 26% letter 10px, which is hard to read. The share
// holds at 44% for the logo and 34% for the letter up to RAMP_START, falls on a
// straight line to the plain 36% and 26% at RAMP_END, and holds there. It is a
// ramp and not a step, because a step makes a folder just past it carry a smaller
// logo than a narrower one.
const RAMP_START = 56;
const RAMP_END = 88;

// The first letter or digit, upper-cased, so "@momo" is M and not "@". Array.from
// walks whole characters, so an emoji at the start is stepped over rather than
// cut in half, as charAt(0) would. A name with no letter or digit has none.
function initialOf(label: string | undefined): string | undefined {
  return Array.from(label ?? '').find((ch) => /[\p{L}\p{N}]/u.test(ch))?.toUpperCase();
}

// A macOS-style folder in one of the ten folder colours, chosen the way you
// colour a folder in Finder or OneDrive. Always decorative: everywhere it
// appears, the name is given beside it. Mostly that is the name written out. In
// the collapsed sidebar, which has no room for names, it is the row's label and
// title, and the folder carries the initial instead. Hovering an ancestor
// marked `group/folder` lifts the folder and dips its front panel, as if it were
// opening. The group is named because a card that lifts itself on hover, as a
// business card does, is usually a `group` too, and the folder would then rise
// a second time on top of the card's own lift.
//
// The emblem is HTML over the SVG rather than SVG <image>, because an HTML
// image reliably reports a failed load, and a failed logo falls back to the
// letter. The failure is remembered against the URL that failed, not as a flag,
// because editing a client re-renders its folder rather than remounting it: a
// corrected URL has to get its turn without a reload.
export default function FolderIcon({
  color, size = 20, label, forceInitial = false, imageUrl, className = '',
}: Props) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const c = folderColor(color);
  const height = Math.round(size * 0.8125);
  const roomy = size >= EMBLEM_MIN;
  // How far along the ramp this folder is: 0 up to RAMP_START, 1 from RAMP_END.
  const ramp = Math.min(Math.max((size - RAMP_START) / (RAMP_END - RAMP_START), 0), 1);
  const logoSize = Math.round(size * (0.44 - 0.08 * ramp));
  const letterSize = Math.round(size * (roomy ? 0.34 - 0.08 * ramp : FORCED_LETTER_SHARE));
  const showLogo = roomy && !!imageUrl && imageUrl !== failedUrl;
  const initial = roomy || forceInitial ? initialOf(label) : undefined;
  // A 1px outline in the colour's edge tone, on a small folder only and in
  // light mode only: on the dark canvas even yellow stands off at 8:1.
  const edge = !roomy && c.edge
    ? { stroke: c.edge, strokeWidth: 1, vectorEffect: 'non-scaling-stroke' as const }
    : {};

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
          className="dark:[stroke:none]"
          {...edge}
        />
        {/* The front panel, lighter, hinged at the bottom. */}
        <rect
          x="2"
          y="14"
          width="60"
          height="36"
          rx="4"
          fill={c.front}
          {...edge}
          className="dark:[stroke:none] [transform-box:fill-box] origin-bottom transition-transform duration-150 ease-out-soft [@media(hover:hover)]:group-hover/folder:[transform:scaleY(.94)]"
        />
      </svg>
      {(showLogo || initial) && (
        // Centred on the front panel, which runs from 14 to 50 of the SVG's 52
        // units: 27% down from the top and 4% up from the bottom. Centred on the
        // lower 72% of the folder instead, the emblem sat about 1px low at 40px,
        // and its ring crossed the panel's bottom edge.
        <span className="absolute inset-x-0 top-[27%] bottom-[4%] flex items-center justify-center">
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
