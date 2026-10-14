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

  it('slides one underline to the current place once the tabs can be measured', () => {
    // jsdom lays nothing out, so give every tab an 80px box, side by side.
    const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(80);
    const left = vi
      .spyOn(HTMLElement.prototype, 'offsetLeft', 'get')
      .mockImplementation(function (this: HTMLElement) {
        const tabs = [...(this.parentElement?.querySelectorAll(':scope > button') ?? [])];
        return tabs.indexOf(this) * 80;
      });
    try {
      render(<WorkspaceTabs tabs={tabsFor('admin')} active="campaigns" onSelect={vi.fn()} />);
      const index = tabsFor('admin').findIndex((t) => t.id === 'campaigns');
      const bar = screen.getByTestId('tab-indicator');
      expect(bar.style.width).toBe('80px');
      expect(bar.style.left).toBe(`${index * 80}px`);
    } finally {
      width.mockRestore();
      left.mockRestore();
    }
  });

  it('re-measures when a tab itself changes size, not only the row', () => {
    // A late web font widens the labels without resizing the flex-1 row, so
    // each tab has to be watched as well.
    const watched: Element[] = [];
    const original = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      observe(el: Element) { watched.push(el); }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    try {
      render(<WorkspaceTabs tabs={tabsFor('client')} active="content" onSelect={vi.fn()} />);
      const nav = screen.getByRole('navigation', { name: 'Client workspace' });
      expect(watched).toContain(nav);
      for (const tab of within(nav).getAllByRole('button')) expect(watched).toContain(tab);
    } finally {
      globalThis.ResizeObserver = original;
    }
  });

  it('keeps the underline on the tab itself where nothing can be measured', () => {
    render(<WorkspaceTabs tabs={tabsFor('admin')} active="content" onSelect={vi.fn()} />);
    expect(screen.queryByTestId('tab-indicator')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Content' }).className).toContain('border-ink');
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

  it('marks each business with a small folder in its colour', () => {
    render(<BusinessScopeBar businesses={[BAKERY, CAFE]} value={undefined} onChange={vi.fn()} />);
    const colours = [...document.querySelectorAll('[data-folder-color]')].map((el) =>
      el.getAttribute('data-folder-color')
    );
    expect(colours).toEqual(['orange', 'green']);
  });
});
