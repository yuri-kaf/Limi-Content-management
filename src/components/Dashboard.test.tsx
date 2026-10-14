import { render, screen } from '@testing-library/react';
import Dashboard from './Dashboard';
import { Client, ContentItem } from '../types';

function item(over: Partial<ContentItem>): ContentItem {
  return {
    id: 'i', title: 'T', driveLink: '', driveFileId: '', status: 'editing', createdAt: 1,
    uploadedByEmail: 'a@b.c', clientReview: 'pending', ...over,
  } as ContentItem;
}

const clients: Client[] = [{
  id: 'a', name: 'Momoland', about: '', businesses: [], createdAt: 1,
  content: [item({ id: '1', status: 'review' }), item({ id: '2', status: 'posted' })],
}];

describe('Dashboard', () => {
  it("breaks the pipeline down under the board's own stage names", () => {
    render(<Dashboard clients={clients} role="admin" />);
    for (const name of ['Editing', 'Review', 'To Post', 'Posted']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
  });

  it('gives a client their own three numbers', () => {
    const now = Date.now();
    const soon = now + 24 * 60 * 60 * 1000;
    const own: Client[] = [{
      ...clients[0],
      content: [
        item({ id: '1', status: 'posted', createdAt: now }),
        item({ id: '2', status: 'review' }),
        item({ id: '3', status: 'review' }),
        item({ id: '4', status: 'to-post', scheduledAt: soon }),
        item({ id: '5', status: 'to-post', scheduledAt: soon }),
        item({ id: '6', status: 'to-post', scheduledAt: soon }),
      ],
    }];
    render(<Dashboard clients={own} role="client" />);
    // The tile is the label's row's parent; its number sits under the label.
    const tile = (label: string) => screen.getByText(label).parentElement!.parentElement!;
    expect(tile('Posted this month')).toHaveTextContent(/^Posted this month1$/);
    expect(tile('Needs your review')).toHaveTextContent(/^Needs your review2Waiting on you$/);
    expect(tile('Scheduled next 7 days')).toHaveTextContent(/^Scheduled next 7 days3$/);
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
  });
});
