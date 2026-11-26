import { MoreHorizontal, Pencil, Building2, Megaphone } from '../../icons';
import Menu, { MenuEntry } from '../m3/Menu';
import { btnIcon } from '../../ui';

interface Props {
  onEditClient: () => void;
  /** Absent until the client has its first business, so a new one cannot swallow old content. */
  onAddBusiness?: () => void;
  /** Absent for the same reason: a campaign needs a business to belong to. */
  onNewCampaign?: () => void;
}

// The client's actions, in the app's one menu.
export default function WorkspaceMenu({ onEditClient, onAddBusiness, onNewCampaign }: Props) {
  const items: MenuEntry[] = [];
  if (onNewCampaign) items.push({ key: 'campaign', label: 'New campaign', icon: <Megaphone size={18} />, onSelect: onNewCampaign });
  if (onAddBusiness) items.push({ key: 'business', label: 'Add business', icon: <Building2 size={18} />, onSelect: onAddBusiness });
  items.push({ key: 'edit', label: 'Edit client', icon: <Pencil size={18} />, onSelect: onEditClient });

  return (
    <Menu
      label="Client actions"
      align="end"
      minWidth={200}
      items={items}
      trigger={(p) => (
        <button {...p} className={btnIcon} aria-label="Client actions">
          <MoreHorizontal size={18} />
        </button>
      )}
    />
  );
}
