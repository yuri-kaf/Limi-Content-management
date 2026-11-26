import { useNavigate } from 'react-router-dom';
import { Pencil } from '../icons';
import { Client } from '../types';
import { awaitingReview } from '../nav';
import FolderIcon from './FolderIcon';
import ColorLabel from './ColorLabel';
import { badgeBtn, card, faintText, focusRing, revealOnGroupHover } from '../ui';

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
// the client and the pencil edits it. The pencil is a badge on the tile's
// corner with its own surface, so it reads even where it overlaps the folder.
// It fades in under a pointer or with focus inside the tile, and is always
// shown where nothing can hover.
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
        className={`group/folder ${card} w-full flex items-center gap-3 pl-3 pr-3 py-2.5 min-h-[60px] text-left transition-[background-color,transform] duration-150 ease-out-soft hover:bg-hover dark:hover:bg-hover-dark active:scale-[.99] ${focusRing}`}
      >
        <FolderIcon color={client.color} size={44} label={client.name} imageUrl={client.imageUrl} />
        <span className="flex-1 min-w-0 flex flex-col gap-0.5 items-start">
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
        </span>
      </button>
      {onEdit && (
        <button
          onClick={onEdit}
          className={`${badgeBtn} ${revealOnGroupHover} absolute top-1/2 -translate-y-1/2 right-2`}
          aria-label={`Edit ${client.name}`}
        >
          <Pencil size={13} />
        </button>
      )}
    </div>
  );
}
