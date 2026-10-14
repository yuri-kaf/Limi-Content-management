import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Business, Idea } from '../types';

// IdeasView reads ideas through the store, which talks to Firestore; the test
// swaps in a plain object it can fill and inspect.
const ideasApi = vi.hoisted(() => ({
  ideas: [] as Idea[],
  loading: false,
  addIdea: vi.fn(async () => {}),
  setIdeaStatus: vi.fn(),
  deleteIdea: vi.fn(),
  addIdeaComment: vi.fn(),
}));

vi.mock('../store', () => ({
  useIdeas: () => ideasApi,
  useComments: () => ({ comments: [], loading: false }),
}));

import IdeasView from './IdeasView';
import { focusRing } from '../ui';

const BAKERY: Business = { id: 'b1', name: 'Bakery', color: 'orange', about: '', createdAt: 1 };
const CAFE: Business = { id: 'b2', name: 'Cafe', color: 'green', about: '', createdAt: 2 };

function idea(id: string, title: string, businessId?: string): Idea {
  return {
    id, title, description: '', links: [], status: 'new',
    createdByEmail: 'a@b.c', createdByName: 'A', createdAt: 1,
    ...(businessId ? { businessId } : {}),
  };
}

describe('IdeasView — business scope', () => {
  beforeEach(() => ideasApi.addIdea.mockClear());

  it("shows only the scoped business's ideas, counting older ones as the first business", () => {
    ideasApi.ideas = [idea('a', 'Old idea'), idea('b', 'Cafe idea', 'b2')];
    render(<IdeasView clientId="acme" businesses={[BAKERY, CAFE]} businessId="b1" canTriage onConvert={vi.fn()} />);
    expect(screen.getByText('Old idea')).toBeInTheDocument();
    expect(screen.queryByText('Cafe idea')).not.toBeInTheDocument();
  });

  it('shows every idea with no scope', () => {
    ideasApi.ideas = [idea('a', 'Old idea'), idea('b', 'Cafe idea', 'b2')];
    render(<IdeasView clientId="acme" businesses={[BAKERY, CAFE]} canTriage onConvert={vi.fn()} />);
    expect(screen.getByText('Cafe idea')).toBeInTheDocument();
  });

  it('files a new idea under the scoped business', async () => {
    ideasApi.ideas = [];
    render(<IdeasView clientId="acme" businesses={[BAKERY, CAFE]} businessId="b2" canTriage onConvert={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /New idea/ }));
    await userEvent.type(screen.getByPlaceholderText('Behind the scenes of the new store'), 'Pop-up stall');
    await userEvent.click(screen.getByRole('button', { name: 'Submit idea' }));
    expect(ideasApi.addIdea).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Pop-up stall', businessId: 'b2' })
    );
  });

  it('files a new idea under no particular business when none is in scope', async () => {
    ideasApi.ideas = [];
    render(<IdeasView clientId="acme" businesses={[BAKERY, CAFE]} canTriage onConvert={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /New idea/ }));
    await userEvent.type(screen.getByPlaceholderText('Behind the scenes of the new store'), 'Pop-up stall');
    await userEvent.click(screen.getByRole('button', { name: 'Submit idea' }));
    const [data] = ideasApi.addIdea.mock.calls[0] as unknown as [object];
    expect('businessId' in data).toBe(false);
  });
});

describe('IdeasView — controls', () => {
  it('says whether the discussion is open', async () => {
    ideasApi.ideas = [idea('a', 'Old idea')];
    render(<IdeasView clientId="acme" businesses={[BAKERY]} canTriage onConvert={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: /discussion/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle.className).toContain(focusRing);
  });

  it('keeps the triage buttons at a 36px target, 44px on touch', () => {
    ideasApi.ideas = [idea('a', 'Old idea')];
    render(<IdeasView clientId="acme" businesses={[BAKERY]} canTriage onConvert={vi.fn()} />);
    for (const name of ['Accept', 'Decline', 'Delete']) {
      expect(screen.getByRole('button', { name })).toHaveClass(
        'min-w-9', 'min-h-9', '[@media(hover:none)]:min-w-[44px]', '[@media(hover:none)]:min-h-[44px]'
      );
    }
  });
});
