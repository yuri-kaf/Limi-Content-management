import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../store', () => ({
  useComments: () => ({ comments: [], loading: false }),
}));

import CommentThread from './CommentThread';

describe('CommentThread timestamp', () => {
  it('marks a timestamp that is not a time as invalid, and says why', async () => {
    render(<CommentThread clientId="c" contentId="i" showTimestamp onSend={vi.fn()} />);
    const stamp = screen.getByPlaceholderText('0:14');
    expect(stamp).toHaveAttribute('aria-invalid', 'false');
    await userEvent.type(stamp, '1:x');
    expect(stamp).toHaveAttribute('aria-invalid', 'true');
    expect(stamp).toHaveAccessibleDescription('Use m:ss, e.g. 0:14');
  });
});
