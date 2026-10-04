import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../contexts/ThemeContext';
import { QUEUE_SECTIONS, QueueGroup } from './QueueGroup';
import { ContentItem } from '../types';
import { TodayEntry } from '../today';

const NOW = new Date('2026-10-03T12:00:00Z').getTime();

function entry(title: string): TodayEntry {
  const item = {
    id: title, title, driveLink: '', driveFileId: '', status: 'review',
    createdAt: 1, uploadedByEmail: 'a@b.c', clientReview: 'pending',
  } as ContentItem;
  return { clientId: 'acme', clientName: 'Cafe', clientColor: 'green', item };
}

describe('QueueGroup', () => {
  beforeEach(() => localStorage.clear());

  it('lists each entry under its section and opens the one clicked', async () => {
    const onOpen = vi.fn();
    const e = entry('Menu reel');
    render(
      <ThemeProvider>
        <QueueGroup section={QUEUE_SECTIONS[0]} entries={[e]} now={NOW} onOpen={onOpen} />
      </ThemeProvider>
    );
    expect(screen.getByText('Waiting on a client')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Menu reel — Cafe/ }));
    expect(onOpen).toHaveBeenCalledWith(e);
  });

  it('names each row with its stage, since the label replaces what a reader would hear', () => {
    render(
      <ThemeProvider>
        <QueueGroup section={QUEUE_SECTIONS[0]} entries={[entry('Menu reel')]} now={NOW} onOpen={vi.fn()} />
      </ThemeProvider>
    );
    expect(screen.getByRole('button', { name: 'Menu reel — Cafe, Review' })).toBeInTheDocument();
  });

  it('can leave out the client where every row would name the same one', () => {
    render(
      <ThemeProvider>
        <QueueGroup
          section={QUEUE_SECTIONS[0]}
          entries={[entry('Menu reel')]}
          now={NOW}
          onOpen={vi.fn()}
          showSource={false}
        />
      </ThemeProvider>
    );
    expect(screen.getByRole('button', { name: 'Menu reel, Review' })).toBeInTheDocument();
    expect(screen.queryByText('Cafe')).not.toBeInTheDocument();
  });

  it('renders nothing for an empty section', () => {
    const { container } = render(
      <ThemeProvider>
        <QueueGroup section={QUEUE_SECTIONS[0]} entries={[]} now={NOW} onOpen={vi.fn()} />
      </ThemeProvider>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('marks a row with a folder in its client colour', () => {
    render(
      <ThemeProvider>
        <QueueGroup section={QUEUE_SECTIONS[0]} entries={[entry('Menu reel')]} now={NOW} onOpen={vi.fn()} />
      </ThemeProvider>
    );
    expect(document.querySelector('[data-folder-color="green"]')).not.toBeNull();
  });
});
