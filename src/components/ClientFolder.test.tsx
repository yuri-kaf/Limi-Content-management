import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ClientFolder from './ClientFolder';
import { Client, ContentItem } from '../types';

function item(over: Partial<ContentItem>): ContentItem {
  return {
    id: 'i', title: 'T', driveLink: '', driveFileId: '', status: 'editing', createdAt: 1,
    uploadedByEmail: 'a@b.c', clientReview: 'pending', ...over,
  } as ContentItem;
}

function client(content: ContentItem[]): Client {
  return { id: 'momo', name: 'Momoland', about: '', color: 'orange', content, businesses: [], createdAt: 1 };
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function setup(c: Client, onEdit?: () => void) {
  render(
    <MemoryRouter initialEntries={['/clients']}>
      <Routes>
        <Route path="*" element={<><ClientFolder client={c} onEdit={onEdit} /><Where /></>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ClientFolder', () => {
  it('names the client under a folder in its colour', () => {
    setup(client([]));
    expect(screen.getByText('Momoland')).toBeInTheDocument();
    expect(document.querySelector('[data-folder-color="orange"]')).not.toBeNull();
  });

  it('says what is waiting on the client before how much there is', () => {
    setup(client([
      item({ id: 'a', status: 'review' }),
      item({ id: 'b', status: 'review' }),
      item({ id: 'c' }),
    ]));
    expect(screen.getByText('2 to review')).toBeInTheDocument();
    expect(screen.queryByText('3 items')).not.toBeInTheDocument();
  });

  it('counts the items when nothing is waiting', () => {
    setup(client([item({ id: 'a' }), item({ id: 'b', status: 'posted' })]));
    expect(screen.getByText('2 items')).toBeInTheDocument();
  });

  it('says "1 item", not "1 items"', () => {
    setup(client([item({ id: 'a' })]));
    expect(screen.getByText('1 item')).toBeInTheDocument();
  });

  it('carries the full name as a title, for a name the tile has to clamp', () => {
    const long = '@thamel_momo_house_official';
    setup({ ...client([]), name: long });
    expect(screen.getByText(long)).toHaveAttribute('title', long);
  });

  it('says so when there is no content', () => {
    setup(client([]));
    expect(screen.getByText('No content yet')).toBeInTheDocument();
  });

  it('opens the client', async () => {
    setup(client([]));
    await userEvent.click(screen.getByRole('button', { name: /Momoland/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/client/momo');
  });

  it('offers Edit to someone who may edit, without opening the client', async () => {
    const onEdit = vi.fn();
    setup(client([]), onEdit);
    await userEvent.click(screen.getByRole('button', { name: 'Edit Momoland' }));
    expect(onEdit).toHaveBeenCalled();
    expect(screen.getByTestId('where')).toHaveTextContent('/clients');
  });

  it('has no Edit for a viewer who may not edit', () => {
    setup(client([]));
    expect(screen.queryByRole('button', { name: 'Edit Momoland' })).not.toBeInTheDocument();
  });
});
