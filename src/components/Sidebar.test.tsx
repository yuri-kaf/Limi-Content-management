import type { ComponentProps } from 'react';
import { render, screen, within } from '@testing-library/react';
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

  // The rail is 48px. Logo and button side by side need 80px with the
  // header's padding, so in the rail they stack.
  it('stacks the brand row in the 48px rail, so nothing overhangs it', () => {
    setup({ collapsed: true });
    const header = screen.getByRole('button', { name: 'Expand sidebar' }).parentElement!;
    expect(header).toHaveClass('flex-col');
    expect(header).not.toHaveClass('px-3');
  });

  // 28px beside the brand on the desktop sidebar, but the phone drawer's close
  // button keeps btnIcon's 36px.
  it('keeps the collapse button small only on the desktop sidebar', () => {
    setup();
    const button = screen.getByRole('button', { name: 'Collapse sidebar' });
    expect(button).toHaveClass('lg:!w-7', 'lg:!h-7');
    expect(button).not.toHaveClass('!w-7');
  });

  it('renders no client labels when collapsed to the rail', () => {
    setup({ collapsed: true });
    expect(screen.queryByText('Acme')).not.toBeInTheDocument();
  });

  it('draws each client as a folder in its colour', () => {
    setup({
      nav: {
        clients: [
          { id: 'acme', name: 'Acme', color: 'green', attention: 0 },
          { id: 'bolt', name: 'Bolt', attention: 0 },
        ],
        showTeam: false,
      },
    });
    const colours = [...document.querySelectorAll('[data-folder-color]')].map((el) =>
      el.getAttribute('data-folder-color')
    );
    // A client without a colour gets the default blue folder.
    expect(colours).toEqual(['green', 'blue']);
  });

  it("shows each client's initial on its folder in the rail, where the name is hidden", () => {
    // Several clients have no colour, so without the initial the rail would be a
    // column of identical blue folders. The row's label still names each one.
    setup({ collapsed: true });
    const acme = screen.getByRole('button', { name: 'Acme, 3 awaiting review' });
    const bolt = screen.getByRole('button', { name: 'Bolt' });
    expect(within(acme).getByText('A')).toBeInTheDocument();
    expect(within(bolt).getByText('B')).toBeInTheDocument();
  });

  it('leaves the initial off the folder while the name is written beside it', () => {
    setup();
    const acme = screen.getByRole('button', { name: 'Acme, 3 awaiting review' });
    const bolt = screen.getByRole('button', { name: 'Bolt' });
    expect(within(acme).queryByText('A')).not.toBeInTheDocument();
    expect(within(bolt).queryByText('B')).not.toBeInTheDocument();
  });

  it('names the page buttons in the rail, where only their icons show', () => {
    setup({ collapsed: true });
    for (const name of ['Today', 'Clients', 'Team']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('title', name);
    }
  });

  it('leaves the page buttons to their written names when expanded', () => {
    // A tooltip there would only repeat the word beside the icon.
    setup();
    expect(screen.getByRole('button', { name: 'Today' })).not.toHaveAttribute('title');
  });
});
