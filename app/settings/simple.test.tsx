import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import SettingsPage from './page';

describe('Simple Settings Page Test', () => {
  it('renders the main heading', async () => {
    render(<SettingsPage />);
    expect(await screen.findByRole('heading', { name: /configuration & analytics/i })).toBeInTheDocument();
  });
});
