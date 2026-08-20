import { useState } from 'react';

interface Props {
  name: string;
  imageUrl?: string;
  /** Rendered size in pixels. 18 in the nav tree, 22 in the header, 20 in lists. */
  size?: number;
  className?: string;
}

// A client's own picture is far faster to recognise than its initial, and it is
// what makes a workspace feel like *your* workspace. The lettered square is the
// fallback and also covers an image that fails to load.
//
// This used to live inside Sidebar and swapped in the fallback by mutating the
// DOM from an onError handler — which React can undo on the next render. Here
// the failure is state, so the fallback survives a re-render.
export default function ClientAvatar({ name, imageUrl, size = 18, className = '' }: Props) {
  const [failed, setFailed] = useState(false);
  const showImage = !!imageUrl && !failed;

  return (
    <span
      className={`rounded-tile flex-shrink-0 inline-flex items-center justify-center overflow-hidden ${
        showImage ? '' : 'bg-hover dark:bg-hover-dark text-ink-soft dark:text-ink-softdark font-semibold'
      } ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(9, Math.round(size * 0.46)) }}
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
