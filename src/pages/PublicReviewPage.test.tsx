import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PublicReviewPage from './PublicReviewPage';
import { Share } from '../types';

const share = vi.hoisted(() => ({
  value: null as unknown,
  submitDecision: vi.fn(),
}));

vi.mock('../store', () => ({
  useShare: () => ({ share: share.value, state: 'ready', submitDecision: share.submitDecision }),
}));

function make(over: Partial<Share> = {}): Share {
  return {
    id: 'tok', clientId: 'c', contentId: 'i', clientName: 'Momoland', title: 'Momo reel',
    mediaLink: 'https://drive.google.com/file/d/abc/view', caption: 'Fresh momos', hashtags: '#momo',
    createdAt: 1, createdByEmail: 'a@b.c', revoked: false, ...over,
  };
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/review/tok']}>
      <Routes>
        <Route path="/review/:token" element={<PublicReviewPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('PublicReviewPage', () => {
  beforeEach(() => {
    share.submitDecision.mockReset();
    share.submitDecision.mockResolvedValue(undefined);
  });

  it('shows the post and both decisions', () => {
    share.value = make();
    renderPage();
    expect(screen.getByRole('heading', { name: 'Momo reel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Approve/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Request changes/ })).toBeInTheDocument();
  });

  it('sends a change request with its note', async () => {
    share.value = make();
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /Request changes/ }));
    await userEvent.type(screen.getByPlaceholderText('What needs changing?'), 'Brighter thumbnail');
    await userEvent.click(screen.getByRole('button', { name: 'Send feedback' }));
    expect(share.submitDecision).toHaveBeenCalledWith('declined', 'Brighter thumbnail');
  });

  it('words a decline as a change request once it is decided', () => {
    share.value = make({ decision: 'declined', decisionNote: 'Brighter thumbnail' });
    renderPage();
    expect(screen.getByText('Changes requested')).toBeInTheDocument();
    expect(screen.getByText('Brighter thumbnail')).toBeInTheDocument();
  });
});
