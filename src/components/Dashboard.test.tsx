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
    render(<Dashboard clients={clients} role="client" />);
    expect(screen.getByText('Needs your review')).toBeInTheDocument();
    expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
  });
});
