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
  showLeads: true,
};

function setup(over: Partial<ComponentProps<typeof Sidebar>> = {}) {
  const props = {
    nav,
    activeClientId: undefined,
    activePath: '/',
    collapsed: false,
    onNavigate: vi.fn(),
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

  // The Material rail: each place is an icon in a pill with its name under
  // it, the current one in the red container.
  it('names each place under its icon in the rail, and marks the current one', () => {
    setup({ collapsed: true, activePath: '/leads', leadsDue: 2 });
    const leads = screen.getByRole('button', { name: 'Leads, 2 follow-ups due' });
    expect(leads).toHaveAttribute('aria-current', 'page');
    expect(leads).toHaveTextContent('Leads');
    expect(within(leads).getByText('2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Today' })).not.toHaveAttribute('aria-current');
  });

  it('has no account or theme controls: those live in the top bar', () => {
    setup();
    expect(screen.queryByRole('button', { name: /sign out|theme/i })).not.toBeInTheDocument();
  });

  it('closes from its own button in the phone drawer', async () => {
    const onClose = vi.fn();
    setup({ onClose });
    await userEvent.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(onClose).toHaveBeenCalled();
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
        showLeads: false,
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

  it('leaves the page buttons to their written names', () => {
    // A tooltip there would only repeat the word beside or under the icon.
    setup();
    expect(screen.getByRole('button', { name: 'Today' })).not.toHaveAttribute('title');
    setup({ collapsed: true });
    expect(screen.getAllByRole('button', { name: 'Today' })[1]).not.toHaveAttribute('title');
  });
});
