import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

describe('login screen', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('shows the sign-in form when the user is logged out', async () => {
    await import('./main');

    expect(await screen.findByRole('heading', { name: 'TaskBoard' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('demo@example.com')).toBeInTheDocument();
  });
});
