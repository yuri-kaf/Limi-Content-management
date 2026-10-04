import { useNavigate } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import { Client } from '../types';
import { awaitingReview } from '../nav';
import FolderIcon from './FolderIcon';
import ColorLabel from './ColorLabel';
import { btnIcon, faintText } from '../ui';

interface Props {
  client: Client;
  /** Absent when the viewer may not edit clients. */
  onEdit?: () => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// A client as a folder, the way Finder or OneDrive lays out a grid: the folder
// in the client's colour with its logo or initial on the front, and the name
// underneath. The one line of detail says what most needs saying — what is
// waiting on the client first, then how much there is.
//
// Two sibling buttons, not one inside the other (invalid HTML): the tile opens
// the client and the pencil edits it. The pencil is always visible where
// nothing can hover to reveal it.
//
// The tile's focus ring is solid brand, not the 30% tint the buttons draw: a
// focus indicator needs 3:1, and at 30% it was 1.6:1 on the light page.
//
// The outer `group` reveals the pencil. The tile alone is the `group/folder`
// that lifts the folder, so hovering the pencil beside it does not.
//
// The name is capped at the tile's width with max-w-full: break-words alone does
// not stop one long word, such as the handle "@thamel_momo_house_official", from
// widening the centred name past the tile, because the word sets the minimum
// width of a flex item. The title carries the whole name for one that the
// two-line clamp cuts.
export default function ClientFolder({ client, onEdit }: Props) {
  const navigate = useNavigate();
  const waiting = awaitingReview(client.content);

  return (
    <div className="group relative">
      <button
        onClick={() => navigate(`/client/${client.id}`)}
        className="group/folder w-full flex flex-col items-center gap-2 px-2 pt-4 pb-3 rounded-card text-center transition-[background-color,transform] duration-150 ease-out-soft hover:bg-tint dark:hover:bg-tint-dark active:scale-[.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <FolderIcon color={client.color} size={88} label={client.name} imageUrl={client.imageUrl} />
        <span
          title={client.name}
          className="max-w-full text-[13px] font-medium leading-snug text-ink dark:text-ink-dark line-clamp-2 break-words"
        >
          {client.name}
        </span>
        {waiting > 0 ? (
          <ColorLabel color="sky">{waiting} to review</ColorLabel>
        ) : (
          <span className={`text-[11px] ${faintText}`}>
            {client.content.length > 0 ? plural(client.content.length, 'item') : 'No content yet'}
          </span>
        )}
      </button>
      {onEdit && (
        <button
          onClick={onEdit}
          className={`${btnIcon} absolute top-1 right-1 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus:opacity-100`}
          aria-label={`Edit ${client.name}`}
        >
          <Pencil size={13} />
        </button>
      )}
    </div>
  );
}
