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
    await userEvent.click(screen.getByRole('button', { name: /New Idea/ }));
    await userEvent.type(screen.getByPlaceholderText('Behind the scenes of the new store'), 'Pop-up stall');
    await userEvent.click(screen.getByRole('button', { name: 'Submit Idea' }));
    expect(ideasApi.addIdea).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Pop-up stall', businessId: 'b2' })
    );
  });
});
