import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToolbarSelect from './ToolbarSelect';
import { toolbarSelect, toolbarSelectWrap } from '../ui';

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
    expect(select.className).toBe(toolbarSelect);
    expect(toolbarSelect.split(' ')).toContain('appearance-none');
    expect(select.parentElement!.className).toBe(toolbarSelectWrap);
    // The chevron is drawing only: hidden from assistive tech, and it lets a
    // click through to the select under it.
    const chevron = select.parentElement!.querySelector('svg')!;
    expect(chevron).toHaveAttribute('aria-hidden', 'true');
    expect(chevron.getAttribute('class')).toContain('pointer-events-none');
    await userEvent.selectOptions(select, 'c1');
    expect(onChange).toHaveBeenCalled();
  });
});
