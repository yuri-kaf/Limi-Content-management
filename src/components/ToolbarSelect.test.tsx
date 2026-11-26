import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToolbarSelect from './ToolbarSelect';

describe('ToolbarSelect', () => {
  it('stays a native select, drawn like the toolbar buttons with its own chevron', async () => {
    const onChange = vi.fn();
    render(
      <ToolbarSelect aria-label="Campaign" value="" onChange={onChange}>
        <option value="">All campaigns</option>
        <option value="c1">Summer</option>
      </ToolbarSelect>
    );
    const select = screen.getByRole('combobox', { name: 'Campaign' });
    expect(select.tagName).toBe('SELECT');
    // An M3 outlined chip: 32px (40px on touch), outlined, its own chevron.
    expect(select).toHaveClass('appearance-none', 'h-8', '[@media(hover:none)]:h-10', 'rounded-full', 'bg-raised');
    // The chevron is drawing only: hidden from assistive tech, and it lets a
    // click through to the select under it.
    const chevron = select.parentElement!.querySelector('[data-icon]')!;
    expect(chevron).toHaveAttribute('aria-hidden', 'true');
    expect(chevron.getAttribute('class')).toContain('pointer-events-none');
    await userEvent.selectOptions(select, 'c1');
    expect(onChange).toHaveBeenCalled();
  });

  // Its look is fixed: a className would be dropped silently, so the type
  // refuses one.
  it('takes no className', () => {
    render(
      // @ts-expect-error -- className is not a ToolbarSelect prop
      <ToolbarSelect aria-label="Status" className="custom-extra"><option>Live</option></ToolbarSelect>
    );
    expect(screen.getByRole('combobox', { name: 'Status' })).not.toHaveClass('custom-extra');
  });
});

