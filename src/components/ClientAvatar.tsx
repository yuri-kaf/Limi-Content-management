import { useState } from 'react';
import { folderColorVars, folderTint } from '../folderColors';

interface Props {
  name: string;
  imageUrl?: string;
  /** A folder colour id. Tints the lettered fallback; ignored when the picture loads. */
  color?: string;
  /** Rendered size in pixels. 18 in the nav tree, 22 in the header, 20 in lists. */
  size?: number;
  className?: string;
}

// A client's own picture is far faster to recognise than its initial, and it is
// what makes a workspace feel like *your* workspace. The lettered square is the
// fallback and also covers an image that fails to load; with a folder colour
// set, the square takes that colour, so the choice is visible straight away.
//
// The failure is state rather than a DOM mutation in onError, which React
// could undo on the next render.
export default function ClientAvatar({ name, imageUrl, color, size = 18, className = '' }: Props) {
  const [failed, setFailed] = useState(false);
  const showImage = !!imageUrl && !failed;
  const tinted = !showImage && !!color;

  return (
    <span
      className={`rounded-tile flex-shrink-0 inline-flex items-center justify-center overflow-hidden ${
        showImage
          ? ''
          : tinted
            ? `${folderTint} font-semibold`
            : 'bg-hover dark:bg-hover-dark text-ink-soft dark:text-ink-softdark font-semibold'
      } ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.46)),
        ...(tinted ? folderColorVars(color) : {}),
      }}
      aria-hidden="true"
    >
      {showImage ? (
        <img
          src={imageUrl}
          alt=""
          className="w-full h-full object-cover"
          draggable={false}
          onError={() => setFailed(true)}
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}
