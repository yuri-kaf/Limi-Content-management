import type { ComponentProps } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Sidebar from './Sidebar';
import { NavModel } from '../nav';

const nav: NavModel = {
  clients: [
    { id: 'acme', name: 'Acme', attention: 3 },
    { id: 'bolt', name: 'Bolt', attention: 0 },
  ],
  showTeam: true,
};

function setup(over: Partial<ComponentProps<typeof Sidebar>> = {}) {
  const props = {
    nav,
    activeClientId: undefined,
    activePath: '/',
    userEmail: 'u@x.com',
    theme: 'light' as const,
    collapsed: false,
    onNavigate: vi.fn(),
    onToggleTheme: vi.fn(),
    onToggleCollapsed: vi.fn(),
    onSignOut: vi.fn(),
    ...over,
  };
  render(<Sidebar {...props} />);
  return props;
}

describe('Sidebar', () => {
  it('lists every client it is given', () => {
    setup();
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Bolt')).toBeInTheDocument();
  });

  it('shows an attention count only where there is one', () => {
    setup();
    expect(screen.getByLabelText('Acme, 3 awaiting review')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Bolt, .* awaiting/)).not.toBeInTheDocument();
  });

  it('hides Team when the model says so', () => {
    setup({ nav: { ...nav, showTeam: false } });
    expect(screen.queryByText('Team')).not.toBeInTheDocument();
  });

  it('shows Team when the model allows it', () => {
    setup();
    expect(screen.getByText('Team')).toBeInTheDocument();
  });

  it('navigates when a client is clicked', async () => {
    const props = setup();
    await userEvent.click(screen.getByText('Acme'));
    expect(props.onNavigate).toHaveBeenCalledWith('/client/acme');
  });

  it('renders no client labels when collapsed to the rail', () => {
    setup({ collapsed: true });
    expect(screen.queryByText('Acme')).not.toBeInTheDocument();
  });
});
