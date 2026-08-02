import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HistoryPage from '../pages/HistoryPage';
import { AuthContext } from '../context/AuthContext';

// Mock ExtendedDetails to isolate HistoryPage behaviour
vi.mock('../components/ExtendedDetails', () => ({
  default: () => <div data-testid="extended-details" />,
}));

vi.mock('../services/api', () => ({
  getHistory: vi.fn(),
  exportHistory: vi.fn(),
  default: {},
}));

vi.mock('../utils/pdfConfirmation', () => ({
  generateConfirmationPdf: vi.fn(),
}));

import { getHistory, exportHistory } from '../services/api';
import { generateConfirmationPdf } from '../utils/pdfConfirmation';

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

const renderPage = (user = { organizationName: 'PrzykładowaFirma Sp. z o.o.' }) =>
  render(
    <AuthContext.Provider value={{ user }}>
      <MemoryRouter>
        <HistoryPage />
      </MemoryRouter>
    </AuthContext.Provider>
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

  it('renders a numbered page button for every page when there are few pages', async () => {
    getHistory.mockResolvedValue({
      data: [MOCK_LOG_CLEAN],
      meta: { totalPages: 3, currentPage: 1, totalItems: 25 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('pagination-page-1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('pagination-page-1')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByTestId('pagination-page-2')).toBeInTheDocument();
    expect(screen.getByTestId('pagination-page-3')).toBeInTheDocument();
  });

  it('fetches the selected page when a numbered page button is clicked', async () => {
    getHistory.mockResolvedValue({
      data: [MOCK_LOG_CLEAN],
      meta: { totalPages: 3, currentPage: 1, totalItems: 25 },
    });

    renderPage();

    await waitFor(() => expect(screen.getByTestId('pagination-page-2')).toBeInTheDocument());
    getHistory.mockClear();

    fireEvent.click(screen.getByTestId('pagination-page-2'));

    await waitFor(() => {
      expect(getHistory).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    });
  });

  it('collapses distant page numbers behind an ellipsis when there are many pages', async () => {
    getHistory.mockResolvedValue({
      data: [MOCK_LOG_CLEAN],
      meta: { totalPages: 10, currentPage: 1, totalItems: 100 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('pagination-page-1')).toBeInTheDocument();
    });
    expect(screen.getByTestId('pagination-page-10')).toBeInTheDocument();
    expect(screen.queryByTestId('pagination-page-5')).not.toBeInTheDocument();
  });

  describe('CSV export', () => {
    const csvBlob = new Blob(['a;b'], { type: 'text/csv' });
    let clickSpy;

    beforeEach(() => {
      getHistory.mockResolvedValue({
        data: [MOCK_LOG_CLEAN],
        meta: { totalPages: 1, currentPage: 1, totalItems: 1 },
      });
      exportHistory.mockResolvedValue({ blob: csvBlob, filename: 'aml-history-2026-07-31.csv' });
      window.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      window.URL.revokeObjectURL = vi.fn();
      clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    });

    it('renders an Export CSV button in the page header', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByTestId('history-table')).toBeInTheDocument());
      expect(screen.getByTestId('export-csv-btn')).toBeInTheDocument();
    });

    it('exports with the current filters and no pagination params when clicked', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByTestId('history-table')).toBeInTheDocument());

      fireEvent.change(screen.getByLabelText(/search/i), { target: { value: 'Putin' } });
      fireEvent.click(screen.getByTestId('export-csv-btn'));

      await waitFor(() => expect(exportHistory).toHaveBeenCalled());
      const args = exportHistory.mock.calls[0][0];
      expect(args.search).toBe('Putin');
      expect(args.page).toBeUndefined();
      expect(args.limit).toBeUndefined();
    });

    it('triggers a file download with the returned blob and filename', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByTestId('history-table')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('export-csv-btn'));

      await waitFor(() => expect(clickSpy).toHaveBeenCalled());
      expect(window.URL.createObjectURL).toHaveBeenCalledWith(csvBlob);
    });

    it('shows an error alert when export fails', async () => {
      exportHistory.mockRejectedValue({ message: 'Export failed' });
      renderPage();
      await waitFor(() => expect(screen.getByTestId('history-table')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('export-csv-btn'));

      await waitFor(() => {
        expect(screen.getByText('Export failed')).toBeInTheDocument();
      });
    });

    it('reserves space for the spinner up front so the button does not resize when exporting starts', async () => {
      renderPage();
      await waitFor(() => expect(screen.getByTestId('history-table')).toBeInTheDocument());

      // The spinner must already be in the DOM (just hidden) before any click —
      // otherwise inserting it on click changes the button's width.
      expect(screen.getByTestId('export-spinner')).toHaveStyle({ visibility: 'hidden' });
    });

    it('makes the spinner visible (without changing button width) while exporting', async () => {
      exportHistory.mockImplementation(() => new Promise(() => {}));
      renderPage();
      await waitFor(() => expect(screen.getByTestId('history-table')).toBeInTheDocument());

      fireEvent.click(screen.getByTestId('export-csv-btn'));

      await waitFor(() => {
        expect(screen.getByTestId('export-spinner')).toHaveStyle({ visibility: 'visible' });
      });
    });
  });

  describe('PDF confirmation download', () => {
    beforeEach(() => {
      getHistory.mockResolvedValue({
        data: [MOCK_LOG_CLEAN],
        meta: { totalPages: 1, currentPage: 1, totalItems: 1 },
      });
    });

    const openModal = async () => {
      renderPage();
      await waitFor(() => expect(screen.getByTestId('history-details-btn')).toBeInTheDocument());
      fireEvent.click(screen.getByTestId('history-details-btn'));
      await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
      return screen.getByRole('dialog');
    };

    it('renders a Download PDF button in the modal footer, next to Close', async () => {
      const dialog = await openModal();
      const footer = within(dialog.querySelector('.modal-footer'));
      expect(footer.getByTestId('download-pdf-btn')).toBeInTheDocument();
      expect(footer.getByRole('button', { name: /close/i })).toBeInTheDocument();
    });

    it('generates the PDF for the selected log using the organization name from the auth session', async () => {
      const dialog = await openModal();
      fireEvent.click(within(dialog).getByTestId('download-pdf-btn'));

      expect(generateConfirmationPdf).toHaveBeenCalledWith(MOCK_LOG_CLEAN, 'PrzykładowaFirma Sp. z o.o.');
    });

    it('shows an error alert in the modal if PDF generation fails', async () => {
      generateConfirmationPdf.mockImplementation(() => {
        throw new Error('pdf generation failed');
      });
      const dialog = await openModal();
      fireEvent.click(within(dialog).getByTestId('download-pdf-btn'));

      await waitFor(() => {
        expect(within(dialog).getByText(/pdf generation failed/i)).toBeInTheDocument();
      });
    });
  });
});
