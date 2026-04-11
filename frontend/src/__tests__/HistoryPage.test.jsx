import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HistoryPage from '../pages/HistoryPage';

// Mock ExtendedDetails to isolate HistoryPage behaviour
vi.mock('../components/ExtendedDetails', () => ({
  default: () => <div data-testid="extended-details" />,
}));

vi.mock('../services/api', () => ({
  getHistory: vi.fn(),
  default: {},
}));

import { getHistory } from '../services/api';

const MOCK_LOG_CLEAN = {
  id: '1',
  searchQuery: 'Jan Kowalski',
  userId: 'user-1',
  userEmail: 'user@test.com',
  hasHit: false,
  isSanctioned: false,
  isPep: false,
  createdAt: '2024-03-15T10:00:00.000Z',
};

const MOCK_LOG_HIT = {
  id: '2',
  searchQuery: 'Vladimir Putin',
  userId: 'user-1',
  userEmail: 'user@test.com',
  hasHit: true,
  isSanctioned: true,
  isPep: false,
  createdAt: '2024-03-16T12:00:00.000Z',
};

const MOCK_LOG_PEP = {
  id: '3',
  searchQuery: 'Test Person',
  userId: 'user-1',
  userEmail: 'user@test.com',
  hasHit: true,
  isSanctioned: false,
  isPep: true,
  createdAt: '2024-03-17T08:00:00.000Z',
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <HistoryPage />
    </MemoryRouter>
  );

describe('HistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders history table with fetched rows', async () => {
    getHistory.mockResolvedValue({
      data: [MOCK_LOG_CLEAN, MOCK_LOG_HIT],
      meta: { totalPages: 1, currentPage: 1, totalItems: 2 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('history-table')).toBeInTheDocument();
    });

    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    expect(screen.getByText('Vladimir Putin')).toBeInTheDocument();
  });

  it('shows loading spinner while fetching', async () => {
    getHistory.mockImplementation(() => new Promise(() => {}));
    renderPage();

    expect(screen.getByRole('status')).toBeInTheDocument(); // Bootstrap Spinner role="status"
  });

  it('shows error alert when fetch fails', async () => {
    getHistory.mockRejectedValue({ message: 'Network Error' });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network Error');
    });
  });

  it('renders CLEAN badge for non-hit log', async () => {
    getHistory.mockResolvedValue({
      data: [MOCK_LOG_CLEAN],
      meta: { totalPages: 1, currentPage: 1, totalItems: 1 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('CLEAN')).toBeInTheDocument();
    });
  });

  it('renders HIT SANCTION badge for sanctioned log', async () => {
    getHistory.mockResolvedValue({
      data: [MOCK_LOG_HIT],
      meta: { totalPages: 1, currentPage: 1, totalItems: 1 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('HIT SANCTION')).toBeInTheDocument();
    });
  });

  it('renders HIT PEP badge for PEP log', async () => {
    getHistory.mockResolvedValue({
      data: [MOCK_LOG_PEP],
      meta: { totalPages: 1, currentPage: 1, totalItems: 1 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('HIT PEP')).toBeInTheDocument();
    });
  });

  it('shows "No data." when result set is empty', async () => {
    getHistory.mockResolvedValue({
      data: [],
      meta: { totalPages: 1, currentPage: 1, totalItems: 0 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('No data.')).toBeInTheDocument();
    });
  });

  it('opens details modal when Details button is clicked', async () => {
    getHistory.mockResolvedValue({
      data: [MOCK_LOG_CLEAN],
      meta: { totalPages: 1, currentPage: 1, totalItems: 1 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('history-details-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('history-details-btn'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toHaveTextContent('Log Details');
    });
  });

  it('closes details modal when Close button is clicked', async () => {
    getHistory.mockResolvedValue({
      data: [MOCK_LOG_CLEAN],
      meta: { totalPages: 1, currentPage: 1, totalItems: 1 },
    });

    renderPage();

    await waitFor(() => expect(screen.getByTestId('history-details-btn')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('history-details-btn'));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog.querySelector('.modal-footer')).getByRole('button', { name: /close/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('shows "API Key" badge for API-authenticated log', async () => {
    getHistory.mockResolvedValue({
      data: [{ ...MOCK_LOG_CLEAN, userId: 'API' }],
      meta: { totalPages: 1, currentPage: 1, totalItems: 1 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('API Key')).toBeInTheDocument();
    });
  });

  it('renders pagination info', async () => {
    getHistory.mockResolvedValue({
      data: [MOCK_LOG_CLEAN],
      meta: { totalPages: 5, currentPage: 1, totalItems: 50 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('pagination-info')).toHaveTextContent('Page 1 of 5');
    });
  });
});
