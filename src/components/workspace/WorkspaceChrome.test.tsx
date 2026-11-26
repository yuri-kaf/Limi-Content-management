import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkspaceTabs from './WorkspaceTabs';
import WorkspaceMenu from './WorkspaceMenu';
import BusinessScopeBar from './BusinessScopeBar';
import { tabsFor } from '../../workspace';
import { Business } from '../../types';

const BAKERY: Business = { id: 'b1', name: 'Bakery', color: 'orange', about: '', createdAt: 1 };
const CAFE: Business = { id: 'b2', name: 'Cafe', color: 'green', about: '', createdAt: 2 };

// The inline view buttons, leaving out the phone's single "View: ..." trigger.
const views = (nav: HTMLElement) =>
  within(nav).getAllByRole('button')
    .map((t) => t.getAttribute('aria-label'))
    .filter((n) => n && !n.startsWith('View:'));

describe('WorkspaceTabs', () => {
  it('marks the current view and reports the one chosen', async () => {
    const onSelect = vi.fn();
    render(<WorkspaceTabs tabs={tabsFor('admin')} active="content" onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: 'Posts' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Overview' })).not.toHaveAttribute('aria-current');
    await userEvent.click(screen.getByRole('button', { name: 'Campaigns' }));
    expect(onSelect).toHaveBeenCalledWith('campaigns');
  });

  it('names every view for the team, in order', () => {
    render(<WorkspaceTabs tabs={tabsFor('admin')} active="calendar" onSelect={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: 'Client views' });
    expect(views(nav)).toEqual(['Posts', 'Calendar', 'Campaigns', 'Ideas', 'Overview']);
    // The phone's one-button form says where you are.
    expect(within(nav).getByRole('button', { name: 'View: Calendar' })).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Calendar' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows a client only their three views', () => {
    render(<WorkspaceTabs tabs={tabsFor('client')} active="content" onSelect={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: 'Client views' });
    expect(views(nav)).toEqual(['Posts', 'Calendar', 'Ideas']);
  });

  it('puts the actions after the views', () => {
    render(
      <WorkspaceTabs tabs={tabsFor('admin')} active="content" onSelect={vi.fn()} actions={<button>More</button>} />
    );
    const nav = screen.getByRole('navigation', { name: 'Client views' });
    expect(within(nav).getByRole('button', { name: 'More' })).toBeInTheDocument();
  });
});

describe('WorkspaceMenu', () => {
  const list = () => screen.queryByRole('menu', { name: 'Client actions' });

  it('runs the chosen action and closes', async () => {
    const onAddBusiness = vi.fn();
    render(<WorkspaceMenu onEditClient={vi.fn()} onAddBusiness={onAddBusiness} onNewCampaign={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Client actions' }));
    expect(within(list()!).getAllByRole('menuitem').map((m) => m.textContent))
      .toEqual(['New campaign', 'Add business', 'Edit client']);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add business' }));
    expect(onAddBusiness).toHaveBeenCalled();
    expect(list()).not.toBeInTheDocument();
  });

  it('leaves out actions that are not available yet', async () => {
    render(<WorkspaceMenu onEditClient={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Client actions' }));
    expect(within(list()!).getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Edit client']);
  });

  it('closes on Escape and hands focus back to its button', async () => {
    render(<WorkspaceMenu onEditClient={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Client actions' });
    await userEvent.click(trigger);
    // The menu takes focus on the first item when it opens.
    expect(screen.getByRole('menuitem', { name: 'Edit client' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(list()).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on a press outside', async () => {
    render(
      <>
        <WorkspaceMenu onEditClient={vi.fn()} />
        <p>Elsewhere</p>
      </>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Client actions' }));
    await userEvent.click(screen.getByText('Elsewhere'));
    expect(list()).not.toBeInTheDocument();
  });
});

describe('BusinessScopeBar', () => {
  it('renders nothing for a single business', () => {
    const { container } = render(
      <BusinessScopeBar businesses={[BAKERY]} value={undefined} onChange={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('offers all businesses and each one, marking the current scope', async () => {
    const onChange = vi.fn();
    render(<BusinessScopeBar businesses={[BAKERY, CAFE]} value="b2" onChange={onChange} />);
    expect(screen.getByRole('button', { name: 'Cafe' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All businesses' })).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'All businesses' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
    await userEvent.click(screen.getByRole('button', { name: 'Bakery' }));
    expect(onChange).toHaveBeenCalledWith('b1');
  });

  it('marks each business with a small folder in its colour', () => {
    render(<BusinessScopeBar businesses={[BAKERY, CAFE]} value={undefined} onChange={vi.fn()} />);
    const colours = [...document.querySelectorAll('[data-folder-color]')].map((el) =>
      el.getAttribute('data-folder-color')
    );
    expect(colours).toEqual(['orange', 'green']);
  });
});
