import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import ContentCard from './ContentCard';
import { ContentItem } from '../types';
import { lift } from '../ui';

function item(over: Partial<ContentItem> = {}): ContentItem {
  return {
    id: 'i1', title: 'Momo reel', driveLink: '', driveFileId: '', status: 'review',
    createdAt: 1, uploadedByEmail: 'a@b.c', clientReview: 'pending', ...over,
  } as ContentItem;
}

type CardProps = Partial<React.ComponentProps<typeof ContentCard>>;

// useSortable needs the contexts the board provides. The items array is a new
// one on every call, as KanbanColumn's is on every render.
function onBoard(props: CardProps = {}) {
  const it = props.item ?? item();
  return (
    <DndContext>
      <SortableContext items={[it.id]}>
        <ContentCard {...props} item={it} />
      </SortableContext>
    </DndContext>
  );
}

function renderCard(props: CardProps = {}) {
  return render(onBoard(props));
}

const cardOf = (title: string) => screen.getByText(title).closest('[data-stage]') as HTMLElement;

// A link with a thumbnail, which is what a draggable card puts its grip on.
const DRIVE = 'https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ012345/view';
const gripOf = (card: HTMLElement) => card.querySelector('.lucide-grip-vertical');

describe('ContentCard', () => {
  it("fills the card with its stage's pastel", () => {
    renderCard({ item: item({ status: 'to-post' }) });
    const card = cardOf('Momo reel');
    expect(card).toHaveAttribute('data-stage', 'to-post');
    expect(card.style.getPropertyValue('--sc-tint')).toBe('#faefcc');
    expect(card.style.getPropertyValue('--sc-tint-dark')).toBe('#3a2c10');
  });

  it('shows the campaign and the client decision as chips', () => {
    renderCard({
      item: item({ clientReview: 'approved' }),
      campaign: { name: 'Dashain sale', color: 'orange' },
    });
    expect(screen.getByText('Dashain sale')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  // A focus indicator needs 3:1. At 40% the ring was 1.9:1 on the light page.
  it('draws a solid focus ring, whether or not the card can move', () => {
    renderCard();
    render(<ContentCard item={item({ id: 'i2', title: 'Static reel' })} draggable={false} />);
    for (const title of ['Momo reel', 'Static reel']) {
      expect(cardOf(title)).toHaveClass(
        'focus:outline-none', 'focus-visible:ring-2', 'focus-visible:ring-focus',
        'dark:focus-visible:ring-focus-dark'
      );
      expect(cardOf(title).className).not.toMatch(/ring-(?:brand|focus)\//);
    }
  });

  it("rings the campaign label, so a campaign in the fill's own hue still shows", () => {
    renderCard({ item: item({ status: 'editing' }), campaign: { name: 'Dashain sale', color: 'purple' } });
    expect(screen.getByTitle('Dashain sale')).toHaveClass(
      'max-w-[96px]', 'ring-1', 'ring-black/5', 'dark:ring-white/10'
    );
  });

  it('turns Delete a lighter red under a hover in dark mode', () => {
    renderCard({ onDelete: vi.fn() });
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass(
      'hover:!text-brand-text', 'dark:hover:!text-brand-textdark'
    );
  });

  it('lifts on hover where it sits on the board', () => {
    renderCard();
    expect(cardOf('Momo reel').className).toContain('hover:-translate-y-0.5');
  });

  // useSortable answers every new items array with an instant transition,
  // which as an inline style would beat the lift's own easing.
  it("keeps the lift's easing when the board renders again", () => {
    const view = renderCard();
    view.rerender(onBoard());
    expect(cardOf('Momo reel').style.transition).toBe('');
  });

  it("keeps the drag copy's controls in their place but out of sight", () => {
    const actions = { onEdit: vi.fn(), onDelete: vi.fn() };
    const { unmount } = renderCard({ ...actions, isOverlay: true });
    expect(screen.getByRole('button', { name: 'Edit' }).parentElement).toHaveClass('invisible');
    unmount();
    renderCard(actions);
    expect(screen.getByRole('button', { name: 'Edit' }).parentElement).not.toHaveClass('invisible');
  });

  it('tilts the copy that follows the pointer during a drag, and straightens it as it settles', () => {
    renderCard({ isOverlay: true });
    const card = cardOf('Momo reel');
    expect(card.className).toContain('rotate-[1.5deg]');
    expect(card.className).toContain('[.settling_&]:rotate-0');
    expect(card.className).not.toContain('hover:-translate-y-0.5');
  });
});

// A card that cannot move: on a client's board, and on the phone board. It
// never registers with dnd-kit, so it needs no DndContext around it.
describe('ContentCard that cannot move', () => {
  function renderStatic(props: CardProps = {}) {
    return render(<ContentCard item={item()} {...props} draggable={false} />);
  }

  it('is filled and lifts like any card, but shows no grip', () => {
    renderStatic({ item: item({ status: 'posted', driveLink: DRIVE }) });
    const card = cardOf('Momo reel');
    expect(card).toHaveAttribute('data-stage', 'posted');
    expect(card.style.getPropertyValue('--sc-tint')).toBe('#dcf0e1');
    expect(card).toHaveClass(...lift.split(' '), 'cursor-pointer');
    expect(gripOf(card)).toBeNull();
    // The same card where it can move does have one.
    renderCard({ item: item({ id: 'i2', title: 'Board reel', driveLink: DRIVE }) });
    expect(gripOf(cardOf('Board reel'))).not.toBeNull();
  });

  it('opens on Enter and on Space, and Space does not also scroll the column', async () => {
    const onCardClick = vi.fn();
    renderStatic({ onCardClick });
    const card = cardOf('Momo reel');
    act(() => card.focus());
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(onCardClick).toHaveBeenCalledTimes(2);
    // fireEvent returns false when the handler prevented the default.
    expect(fireEvent.keyDown(card, { key: ' ' })).toBe(false);
  });

  it('leaves a key pressed on one of its links to the link', async () => {
    const onCardClick = vi.fn();
    renderStatic({ item: item({ driveLink: DRIVE }), onCardClick });
    const link = screen.getByRole('link', { name: 'Open in Google Drive' });
    // jsdom cannot navigate, so the click is recorded and stopped there.
    const followed = vi.fn((e: Event) => e.preventDefault());
    link.addEventListener('click', followed);
    act(() => link.focus());
    await userEvent.keyboard('{Enter}');
    await userEvent.keyboard(' ');
    expect(followed).toHaveBeenCalledTimes(1);
    expect(onCardClick).not.toHaveBeenCalled();
  });
});
