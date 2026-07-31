import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeveloperPage from '../pages/DeveloperPage';

vi.mock('../services/api', () => ({
  getOrganizationKeys: vi.fn(),
  resetOrganizationSecret: vi.fn(),
  default: {},
}));

import { getOrganizationKeys, resetOrganizationSecret } from '../services/api';

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  writeText.mockClear();
  Object.assign(navigator, { clipboard: { writeText } });
});

const renderPage = async (apiKey = 'pk_live_abc123') => {
  getOrganizationKeys.mockResolvedValue({ apiKey });
  const utils = render(<DeveloperPage />);
  await waitFor(() => expect(screen.getByTestId('api-key-display')).toHaveValue(apiKey));
  return utils;
};

describe('DeveloperPage', () => {
  it('displays the API key once loaded', async () => {
    await renderPage('pk_live_abc123');
    expect(screen.getByTestId('api-key-display')).toHaveValue('pk_live_abc123');
  });

  it('copies the API key to the clipboard and shows a temporary confirmation', async () => {
    await renderPage('pk_live_abc123');

    fireEvent.click(screen.getByTestId('copy-api-key-btn'));

    expect(writeText).toHaveBeenCalledWith('pk_live_abc123');
    await waitFor(() => {
      expect(screen.getByTestId('copy-api-key-btn')).toHaveAccessibleName(/copied/i);
    });
  });

  it('has an accessible name on the copy button before it is clicked', async () => {
    await renderPage();
    expect(screen.getByTestId('copy-api-key-btn')).toHaveAccessibleName(/copy/i);
  });

  it('opens the reset modal and shows an error for an incorrect password', async () => {
    resetOrganizationSecret.mockRejectedValue({ response: { status: 403 } });
    await renderPage();

    fireEvent.click(screen.getByTestId('reset-secret-btn'));
    await userEvent.type(screen.getByLabelText('Enter your password to confirm'), 'wrong-password');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(screen.getByTestId('reset-error-alert')).toHaveTextContent('Incorrect password');
    });
  });

  it('reveals the new secret on a successful reset and allows copying it', async () => {
    resetOrganizationSecret.mockResolvedValue({ newApiSecret: 'sk_live_newsecret' });
    await renderPage();

    fireEvent.click(screen.getByTestId('reset-secret-btn'));
    await userEvent.type(screen.getByLabelText('Enter your password to confirm'), 'correct-password');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(screen.getByTestId('new-secret-display')).toHaveValue('sk_live_newsecret');
    });

    fireEvent.click(screen.getByTestId('copy-secret-btn'));
    expect(writeText).toHaveBeenCalledWith('sk_live_newsecret');
  });

  it('resets the form when the modal is closed and reopened', async () => {
    resetOrganizationSecret.mockRejectedValue({ response: { status: 403 } });
    await renderPage();

    fireEvent.click(screen.getByTestId('reset-secret-btn'));
    await userEvent.type(screen.getByLabelText('Enter your password to confirm'), 'wrong-password');
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => screen.getByTestId('reset-error-alert'));

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByTestId('reset-secret-btn'));

    expect(screen.queryByTestId('reset-error-alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Enter your password to confirm')).toHaveValue('');
  });
});
