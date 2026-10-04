import { useState } from 'react';
import { folderColor } from '../folderColors';

interface Props {
  /** A folder colour id. Anything unknown draws the default blue. */
  color?: string;
  /** Rendered width in px. The height follows the folder's proportions. */
  size?: number;
  /** Its first letter is embossed on the front, from 40px up. */
  label?: string;
  /** A logo shown on the front instead of the letter, from 40px up. */
  imageUrl?: string;
  className?: string;
}

// Below this a letter or a logo is a smudge, so the folder is drawn plain.
const EMBLEM_MIN = 40;

// A macOS-style folder in one of the ten folder colours, chosen the way you
// colour a folder in Finder or OneDrive. Always decorative: everywhere it
// appears, the name is written beside it. Inside a `group`, hovering the group
// lifts the folder and dips its front panel, as if it were opening.
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
  const showLogo = roomy && !!imageUrl && imageUrl !== failedUrl;
  const initial = roomy ? label?.trim().charAt(0).toUpperCase() : undefined;

  return (
    <span
      aria-hidden="true"
      data-folder-color={c.id}
      className={`relative inline-block flex-shrink-0 transition-transform duration-150 ease-out-soft [@media(hover:hover)]:group-hover:-translate-y-0.5 ${className}`}
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
          className="[transform-box:fill-box] origin-bottom transition-transform duration-150 ease-out-soft [@media(hover:hover)]:group-hover:[transform:scaleY(.94)]"
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
              style={{ width: Math.round(size * 0.36), height: Math.round(size * 0.36) }}
            />
          ) : (
            <span
              className="font-semibold leading-none"
              style={{ color: c.emblem, fontSize: Math.round(size * 0.26) }}
            >
              {initial}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
