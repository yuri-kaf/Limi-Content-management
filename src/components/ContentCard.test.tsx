import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import ContentCard from './ContentCard';
import { ContentItem } from '../types';

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
