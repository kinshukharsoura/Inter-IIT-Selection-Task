import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ServingsScaler } from './ServingsScaler';

function Harness() {
  const [servings, setServings] = useState(4);
  return (
    <>
      <ServingsScaler baseServings={4} value={servings} onChange={setServings} />
      <output>current:{servings}</output>
    </>
  );
}

describe('ServingsScaler', () => {
  it('lets the user clear the field and type a new number', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText('Scale to');
    await user.clear(input);
    expect(input).toHaveValue(null); // empty while typing, not snapped back
    await user.type(input, '12');
    expect(screen.getByText('current:12')).toBeInTheDocument();
  });

  it('steps with the +/- buttons and resets to the base servings', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Increase servings' }));
    expect(screen.getByLabelText('Scale to')).toHaveValue(5);
    await user.click(screen.getByRole('button', { name: 'Reset to 4' }));
    expect(screen.getByLabelText('Scale to')).toHaveValue(4);
  });
});
