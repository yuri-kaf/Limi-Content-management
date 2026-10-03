import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { Location, NavigateFunction } from 'react-router-dom';

// Drives the real page with the store and auth replaced by plain objects the
// tests can fill and inspect. Everything below the page — tabs, board, modals
// — is the real thing.
const h = vi.hoisted(() => {
  const item = (id: string, over: Record<string, unknown> = {}) => ({
    id,
    title: `Post ${id}`,
    driveLink: `https://example.com/${id}.mp4`,
    driveFileId: '',
    mediaType: 'video',
    caption: `Caption ${id}`,
    hashtags: '',
    platforms: [],
    notes: '',
    status: 'editing',
    createdAt: 1,
    scheduledAt: 0,
    uploadedByEmail: 'admin@x.test',
    clientReview: 'pending',
    reviewNote: '',
    businessId: 'main',
    ...over,
  });
  return {
    client: {
      id: 'A',
      name: 'Acme',
      about: '',
      createdAt: 1,
      businesses: [
        { id: 'main', name: 'Acme Main', color: 'blue', about: '', createdAt: 1 },
        { id: 'b2', name: 'Acme Cafe', color: 'green', about: '', createdAt: 2 },
      ],
      content: [item('X'), item('Y', { businessId: 'b2', createdAt: 2 })],
    },
    user: {
      id: 'u1', name: 'Admin', email: 'admin@x.test', role: 'admin',
      assignedClientIds: [] as string[], createdAt: 1,
    },
    ideas: [] as unknown[],
    loc: null as Location | null,
    navigate: null as NavigateFunction | null,
    fns: {} as Record<string, any>,
  };
});

vi.mock('../store', () => ({
  useClients: () => ({ clients: [h.client], loading: false, ...h.fns.store }),
  useCampaigns: () => ({ campaigns: [], loading: false, ...h.fns.campaigns }),
  useShareActions: () => ({ createShare: h.fns.createShare, revokeShare: vi.fn() }),
  useShareReconciler: () => {},
  useComments: () => ({ comments: [], loading: false }),
  useIdeas: () => ({
    ideas: h.ideas, loading: false, addIdea: vi.fn(), setIdeaStatus: vi.fn(),
    deleteIdea: vi.fn(), addIdeaComment: vi.fn(),
  }),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: h.user, status: 'signed-in', userEmail: h.user.email, logout: vi.fn(),
  }),
}));

import { ThemeProvider } from '../contexts/ThemeContext';
import ClientWorkspacePage from './ClientWorkspacePage';

function Probe() {
  h.loc = useLocation();
  h.navigate = useNavigate();
  return null;
}

function go(to: string | number) {
  act(() => {
    if (typeof to === 'number') h.navigate!(to);
    else h.navigate!(to);
  });
}

function renderAt(url: string | string[]) {
  const entries = Array.isArray(url) ? url : [url];
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <Routes>
          <Route path="/client/:id/campaign/:campaignId" element={<><ClientWorkspacePage /><Probe /></>} />
          <Route path="/client/:id/:tab?" element={<><ClientWorkspacePage /><Probe /></>} />
          <Route path="*" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );
}

// The detail sheet, found by its title heading.
function sheet(title: string): HTMLElement {
  return screen.getByRole('heading', { level: 2, name: title }).closest('.fixed') as HTMLElement;
}

beforeEach(() => {
  localStorage.clear();
  window.matchMedia = ((q: string) => ({
    matches: true, media: q, onchange: null,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: vi.fn(async () => {}) }, configurable: true,
  });
  h.fns.store = {
    addContent: vi.fn(async () => 'NEW'),
    updateContent: vi.fn(async () => {}),
    deleteContent: vi.fn(async () => {}),
    updateContentStatus: vi.fn(async () => {}),
    updateClientReview: vi.fn(async () => {}),
    addComment: vi.fn(async () => {}),
    addBusiness: vi.fn(async () => 'nb'),
    updateBusiness: vi.fn(async () => {}),
    deleteBusiness: vi.fn(async () => {}),
    updateClient: vi.fn(async () => {}),
  };
  h.fns.campaigns = {
    addCampaign: vi.fn(async () => 'c-new'),
    updateCampaign: vi.fn(async () => {}),
    setCampaignStatus: vi.fn(async () => {}),
    deleteCampaign: vi.fn(async () => {}),
  };
  h.fns.createShare = vi.fn(async (i: { id: string }) => `https://limi.example/review/${i.id}`);
  h.user = { ...h.user, role: 'admin', assignedClientIds: [] };
  h.ideas = [];
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ClientWorkspacePage', () => {
  it('reopens the edit form for the item now selected, never with the last one’s fields', async () => {
    const user = userEvent.setup();
    renderAt('/client/A?item=X');
    await user.click(within(sheet('Post X')).getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Content Title')).toHaveValue('Post X');

    // ⌘K → a content hit in the same client, while the form is open.
    go('/client/A?item=Y');
    await user.click(within(sheet('Post Y')).getByRole('button', { name: 'Edit' }));

    expect(screen.getAllByLabelText('Content Title')).toHaveLength(1);
    expect(screen.getByLabelText('Content Title')).toHaveValue('Post Y');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(h.fns.store.updateContent).toHaveBeenCalledWith(
      'A', 'Y',
      expect.objectContaining({ title: 'Post Y', driveLink: 'https://example.com/Y.mp4' })
    );
  });

  it('shows each item’s own review link, not the one made for the previous item', async () => {
    const user = userEvent.setup();
    renderAt('/client/A?item=X');
    await user.click(within(sheet('Post X')).getByRole('button', { name: /create review link/i }));
    expect(await within(sheet('Post X')).findByText('https://limi.example/review/X')).toBeInTheDocument();

    go('/client/A?item=Y');
    expect(within(sheet('Post Y')).queryByText('https://limi.example/review/X')).toBeNull();
  });

  it('turns an idea into content in one write that also marks the idea', async () => {
    const user = userEvent.setup();
    h.ideas = [{
      id: 'i1', title: 'Idea one', description: 'Desc', links: ['https://example.com/ref.mp4'],
      status: 'accepted', createdByEmail: 'c@x', createdByName: 'C', createdAt: 1,
    }];
    renderAt('/client/A/ideas');
    await user.click(screen.getByRole('button', { name: /make content/i }));
    await user.click(screen.getByRole('button', { name: 'Add Content' }));
    await vi.waitFor(() => expect(h.fns.store.addContent).toHaveBeenCalled());
    expect(h.fns.store.addContent).toHaveBeenCalledWith(
      'A', expect.objectContaining({ title: 'Idea one' }), { convertsIdeaId: 'i1' }
    );
    expect(window.alert).not.toHaveBeenCalled();
  });

  it('closes the sheet without losing the business scope, and keeps it across tabs', async () => {
    const user = userEvent.setup();
    renderAt('/client/A?b=b2&item=Y');
    await user.click(within(sheet('Post Y')).getByRole('button', { name: 'Close' }));
    expect(h.loc!.pathname).toBe('/client/A');
    expect(h.loc!.search).toBe('?b=b2');
    expect(screen.queryByRole('heading', { level: 2, name: 'Post Y' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Calendar' }));
    expect(h.loc!.pathname).toBe('/client/A/calendar');
    expect(h.loc!.search).toBe('?b=b2');
  });

  it('opens nothing for an item id from another client', () => {
    renderAt('/client/A?item=FOREIGN');
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
  });

  it('sends a client from a campaign page to Content', () => {
    h.user = { ...h.user, role: 'client', assignedClientIds: ['A'] };
    renderAt('/client/A/campaign/c1');
    expect(h.loc!.pathname).toBe('/client/A');
  });

  it('does not open an item still in Editing for a client, who never sees that stage', () => {
    h.user = { ...h.user, role: 'client', assignedClientIds: ['A'] };
    renderAt('/client/A?item=X');
    expect(screen.queryByRole('heading', { level: 2, name: 'Post X' })).toBeNull();
  });

  it('shows Content for an unknown tab', () => {
    renderAt('/client/A/nope');
    expect(screen.getByRole('button', { name: 'Content' })).toHaveAttribute('aria-current', 'page');
  });

  it('gives every place a top-level heading', () => {
    renderAt('/client/A/calendar');
    expect(screen.getByRole('heading', { level: 1, name: 'Acme — Calendar' })).toBeInTheDocument();
  });

  it('opens a new campaign once it is created, then closes the form', async () => {
    const user = userEvent.setup();
    renderAt('/client/A/campaigns');
    await user.click(screen.getByRole('button', { name: 'New campaign' }));
    await user.type(screen.getByLabelText('Name'), 'Launch');
    await user.click(screen.getByRole('button', { name: 'Create campaign' }));
    await vi.waitFor(() => expect(h.loc!.pathname).toBe('/client/A/campaign/c-new'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('adds no history entry when the place already showing is chosen again', async () => {
    const user = userEvent.setup();
    renderAt(['/', '/client/A/calendar']);
    await user.click(screen.getByRole('button', { name: 'Calendar' }));
    go(-1);
    expect(h.loc!.pathname).toBe('/');
  });
});
