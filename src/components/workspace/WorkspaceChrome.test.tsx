import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkspaceTabs from './WorkspaceTabs';
import WorkspaceMenu from './WorkspaceMenu';
import BusinessScopeBar from './BusinessScopeBar';
import { tabsFor } from '../../workspace';
import { Business } from '../../types';

const BAKERY: Business = { id: 'b1', name: 'Bakery', color: 'orange', about: '', createdAt: 1 };
const CAFE: Business = { id: 'b2', name: 'Cafe', color: 'green', about: '', createdAt: 2 };

describe('WorkspaceTabs', () => {
  it('marks the current place and reports the one chosen', async () => {
    const onSelect = vi.fn();
    render(<WorkspaceTabs tabs={tabsFor('admin')} active="content" onSelect={onSelect} />);
    expect(screen.getByRole('button', { name: 'Content' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Overview' })).not.toHaveAttribute('aria-current');
    await userEvent.click(screen.getByRole('button', { name: 'Campaigns' }));
    expect(onSelect).toHaveBeenCalledWith('campaigns');
  });

  it('shows a client only their three places', () => {
    render(<WorkspaceTabs tabs={tabsFor('client')} active="content" onSelect={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: 'Client workspace' });
    expect(within(nav).getAllByRole('button').map((t) => t.textContent))
      .toEqual(['Content', 'Calendar', 'Ideas']);
  });
});

describe('WorkspaceMenu', () => {
  const list = () => screen.queryByRole('group', { name: 'Client actions' });

  it('runs the chosen action and closes', async () => {
    const onAddBusiness = vi.fn();
    render(<WorkspaceMenu onEditClient={vi.fn()} onAddBusiness={onAddBusiness} onNewCampaign={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Client actions' }));
    await userEvent.click(screen.getByRole('button', { name: 'Add business' }));
    expect(onAddBusiness).toHaveBeenCalled();
    expect(list()).not.toBeInTheDocument();
  });

  it('leaves out actions that are not available yet', async () => {
    render(<WorkspaceMenu onEditClient={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Client actions' }));
    expect(within(list()!).getAllByRole('button').map((m) => m.textContent)).toEqual(['Edit client']);
  });

  it('closes on Escape and hands focus back to its button', async () => {
    render(<WorkspaceMenu onEditClient={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Client actions' });
    await userEvent.click(trigger);
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Edit client' })).toHaveFocus();
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
});
