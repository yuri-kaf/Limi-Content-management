import { useState } from 'react';

/**
 * 'full' is the stacked lockup — the limi logotype over "creatives" over
 * "a NOMOR company". It needs about 40px of height before the two lower lines
 * are legible, so it belongs on sign-in, the public review page and the setup
 * guide, and nowhere in the app chrome.
 *
 * 'mark' is the square glyph for the places that have 20–32px: the sidebar
 * brand row, the collapsed rail, page headers.
 */
export type LogoVariant = 'full' | 'mark';

// Files live in public/, so they are served from the root and need no bundler
// involvement — which also means a logo can be replaced without a rebuild.
const SRC: Record<LogoVariant, string> = {
  full: '/limi-logo.png',
  // The same file the PWA manifest and the favicon point at, rather than a
  // third name for the same square: one icon, referenced from three places.
  mark: '/limi-icon.png',
};

// Width divided by height. Both dimensions are then written explicitly rather
// than left to `width: auto`, so the box occupies its final size before the
// image decodes and the row next to it never reflows.
const RATIO: Record<LogoVariant, number> = {
  full: 751 / 670,
  mark: 1,
};

interface Props {
  variant?: LogoVariant;
  /** Rendered height in pixels. Width follows from the aspect ratio. */
  size?: number;
  className?: string;
}

// The red lettered square the whole app used before there was an asset. Kept as
// the fallback rather than deleted: it covers a missing file and a failed load,
// and a broken-image glyph where the brand should be is worse than a letter.
function LetterMark({ size, className }: { size: number; className: string }) {
  return (
    <span
      className={`bg-brand rounded-tile inline-flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        className="text-white font-bold leading-none"
        style={{ fontSize: Math.max(9, Math.round(size * 0.52)) }}
      >
        L
      </span>
    </span>
  );
}

export default function Logo({ variant = 'mark', size = 20, className = '' }: Props) {
  const [failed, setFailed] = useState(false);

  if (failed) return <LetterMark size={size} className={className} />;

  return (
    <img
      src={SRC[variant]}
      alt="Limi"
      className={`flex-shrink-0 object-contain ${className}`}
      style={{ height: size, width: Math.round(size * RATIO[variant]) }}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
