import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import ContentCard from './ContentCard';
import { ContentItem } from '../types';
import { focusRingInset, lift } from '../ui';

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

const DRIVE = 'https://drive.google.com/file/d/1aBcDeFgHiJkLmNoPqRsTuVwXyZ012345/view';
const ONEDRIVE = 'https://limi-my.sharepoint.com/:v:/g/personal/a/EaBc?e=x';
const lateMark = () => document.querySelector('.icon-alert-circle');

async function openMenu(title = 'Momo reel') {
  await userEvent.click(screen.getByRole('button', { name: `${title} actions` }));
  return screen.getByRole('menu');
}

describe('ContentCard', () => {
  // The board uses the queue's rule: a slot earlier today is "today", not the
  // red late mark.
  it('does not mark a slot earlier today as late, but does an earlier day', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 7, 20, 15, 0, 0));
    try {
      const { unmount } = renderCard({
        item: item({ status: 'to-post', scheduledAt: new Date(2026, 7, 20, 9, 0, 0).getTime() }),
      });
      expect(lateMark()).toBeNull();
      unmount();
      renderCard({
        item: item({ status: 'to-post', scheduledAt: new Date(2026, 7, 19, 9, 0, 0).getTime() }),
      });
      expect(lateMark()).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  // No outline and no pastel: white on the grey board lane, filled on the
  // white page of a stage grid. The stage rides along for the dot.
  it('is white on a board lane and filled on the page', () => {
    renderCard({ item: item({ status: 'to-post' }) });
    const lane = cardOf('Momo reel');
    expect(lane).toHaveAttribute('data-stage', 'to-post');
    expect(lane).toHaveClass('bg-canvas');
    expect(lane.className).not.toMatch(/\bborder\b/);
    render(<ContentCard item={item({ id: 'i2', title: 'Grid reel' })} surface="page" draggable={false} />);
    expect(cardOf('Grid reel')).toHaveClass('bg-raised');
  });

  it('shows the campaign and the client decision', () => {
    renderCard({
      item: item({ clientReview: 'approved' }),
      campaign: { name: 'Dashain sale', color: 'orange' },
    });
    expect(screen.getByText('Dashain sale')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('says "Changes asked" for a post the client sent back', () => {
    renderCard({ item: item({ clientReview: 'declined' }) });
    expect(screen.getByText('Changes asked')).toBeInTheDocument();
  });

  // OneDrive never gives a picture without a Microsoft sign-in, so the card is
  // text first: no empty frame, the kind of post as an icon.
  it('shows no picture frame for a link that cannot give one', () => {
    renderCard({ item: item({ driveLink: ONEDRIVE }) });
    expect(cardOf('Momo reel').querySelector('img')).toBeNull();
    expect(screen.getByLabelText('Video')).toBeInTheDocument();
  });

  it('shows a small picture where the link gives one', () => {
    renderCard({ item: item({ driveLink: DRIVE }) });
    expect(cardOf('Momo reel').querySelector('img')).not.toBeNull();
  });

  // A focus indicator needs 3:1. At 40% the ring was 1.9:1 on the light page.
  it('draws a solid inset focus ring, whether or not the card can move', () => {
    renderCard();
    render(<ContentCard item={item({ id: 'i2', title: 'Static reel' })} draggable={false} />);
    for (const title of ['Momo reel', 'Static reel']) {
      expect(cardOf(title).className).toContain(focusRingInset);
      expect(cardOf(title).className).not.toMatch(/ring-(?:brand|focus)\//);
    }
  });

  it('keeps every action in its menu, reachable without a hover', async () => {
    const actions = { onEdit: vi.fn(), onDelete: vi.fn() };
    renderCard({ ...actions, item: item({ driveLink: DRIVE }) });
    const trigger = screen.getByRole('button', { name: 'Momo reel actions' });
    // Faded in on hover where there is a pointer; always there on a touch screen.
    expect(trigger.className).toContain('[@media(hover:hover)]:opacity-0');
    expect(trigger.className).not.toMatch(/(^|\s)opacity-0/);
    const menu = await openMenu();
    expect(within(menu).getAllByRole('menuitem').map((m) => m.textContent)).toEqual([
      'Open in Google Drive', 'Edit', 'Delete',
    ]);
  });

  it('moves to another stage from its menu', async () => {
    const onMove = vi.fn();
    renderCard({ onMove });
    await openMenu();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Move to To post' }));
    expect(onMove).toHaveBeenCalledWith('to-post');
  });

  it('turns Delete red in its menu', async () => {
    renderCard({ onDelete: vi.fn() });
    await openMenu();
    expect(screen.getByRole('menuitem', { name: 'Delete' }).className).toContain('text-brand-text');
  });

  it('lifts on hover where it sits on the board', () => {
    renderCard();
    expect(cardOf('Momo reel').className).toContain(lift);
  });

  // useSortable answers every new items array with an instant transition,
  // which as an inline style would beat the lift's own easing.
  it("keeps the lift's easing when the board renders again", () => {
    const view = renderCard();
    view.rerender(onBoard());
    expect(cardOf('Momo reel').style.transition).toBe('');
  });

  it("keeps the room of the menu on the drag copy, with nothing to press", () => {
    renderCard({ onEdit: vi.fn(), isOverlay: true });
    const copy = cardOf('Momo reel');
    expect(copy.querySelector('[data-menu-slot]')).not.toBeNull();
    expect(copy.querySelectorAll('button')).toHaveLength(0);
  });

  it('tilts the copy that follows the pointer during a drag, and straightens it as it settles', () => {
    renderCard({ isOverlay: true });
    const card = cardOf('Momo reel');
    expect(card.className).toContain('rotate-[1.5deg]');
    expect(card.className).toContain('[.settling_&]:rotate-0');
    expect(card.className).not.toContain(lift);
  });

  it('shows its stage as a chip that moves it, in a stage grid', async () => {
    const onMove = vi.fn();
    render(<ContentCard item={item()} surface="page" showStage onMove={onMove} draggable={false} />);
    await userEvent.click(screen.getByRole('button', { name: 'Stage: Review. Change stage' }));
    expect(screen.getByRole('menuitemradio', { name: 'Review' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('menuitemradio', { name: 'Posted' }));
    expect(onMove).toHaveBeenCalledWith('posted');
  });
});

// A card that cannot move: on a client's board, and in a stage grid. It never
// registers with dnd-kit, so it needs no DndContext around it.
describe('ContentCard that cannot move', () => {
  function renderStatic(props: CardProps = {}) {
    return render(<ContentCard item={item()} {...props} draggable={false} />);
  }

  it('lifts like any card under a pointer', () => {
    renderStatic({ item: item({ status: 'posted' }) });
    const card = cardOf('Momo reel');
    expect(card).toHaveAttribute('data-stage', 'posted');
    expect(card).toHaveClass(...lift.split(' '), 'cursor-pointer');
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

  it('leaves a key pressed on its menu button to the menu', async () => {
    const onCardClick = vi.fn();
    renderStatic({ item: item({ driveLink: DRIVE }), onCardClick });
    act(() => screen.getByRole('button', { name: 'Momo reel actions' }).focus());
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(onCardClick).not.toHaveBeenCalled();
  });
});
