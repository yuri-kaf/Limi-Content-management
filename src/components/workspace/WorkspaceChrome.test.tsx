import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkspaceTabs from './WorkspaceTabs';
import WorkspaceMenu from './WorkspaceMenu';
import BusinessScopeBar from './BusinessScopeBar';
import { tabsFor } from '../../workspace';
import { Business } from '../../types';

const BAKERY: Business = { id: 'b1', name: 'Bakery', color: 'orange', about: '', createdAt: 1 };
const CAFE: Business = { id: 'b2', name: 'Cafe', color: 'green', about: '', createdAt: 2 };

describe('WorkspaceTabs', () => {
  it('marks the active tab and reports the one chosen', async () => {
    const onSelect = vi.fn();
    render(<WorkspaceTabs tabs={tabsFor('admin')} active="content" onSelect={onSelect} />);
    expect(screen.getByRole('tab', { name: 'Content' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'false');
    await userEvent.click(screen.getByRole('tab', { name: 'Campaigns' }));
    expect(onSelect).toHaveBeenCalledWith('campaigns');
  });

  it('shows a client only their three tabs', () => {
    render(<WorkspaceTabs tabs={tabsFor('client')} active="content" onSelect={vi.fn()} />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Content', 'Calendar', 'Ideas']);
  });
});

describe('WorkspaceMenu', () => {
  it('runs the chosen action and closes', async () => {
    const onAddBusiness = vi.fn();
    render(<WorkspaceMenu onEditClient={vi.fn()} onAddBusiness={onAddBusiness} onNewCampaign={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Client actions' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Add business' }));
    expect(onAddBusiness).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('leaves out actions that are not available yet', async () => {
    render(<WorkspaceMenu onEditClient={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Client actions' }));
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Edit client']);
  });

  it('closes on Escape', async () => {
    render(<WorkspaceMenu onEditClient={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Client actions' }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
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
