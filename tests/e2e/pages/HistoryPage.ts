import { Page } from '@playwright/test';

export class HistoryPage {
  private readonly searchInput = this.page.getByLabel('Search (Name/Query)');
  private readonly statusSelect = this.page.getByLabel('Status');
  private readonly dateFromInput = this.page.getByLabel('Date From');
  private readonly dateToInput = this.page.getByLabel('Date To');
  readonly filterBtn = this.page.getByTestId('filter-btn');
  readonly clearFilterBtn = this.page.getByTestId('clear-filter-btn');
  readonly historyTable = this.page.getByTestId('history-table');
  readonly historyRows = this.page.getByTestId('history-row');
  readonly detailsBtns = this.page.getByTestId('history-details-btn');
  readonly detailsModal = this.page.getByTestId('history-details-modal');
  readonly paginationInfo = this.page.getByTestId('pagination-info');
  readonly paginationPrev = this.page.getByTestId('pagination-prev');
  readonly paginationNext = this.page.getByTestId('pagination-next');

  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/history');
    await this.historyTable.waitFor({ state: 'visible' });
  }

  async applyFilters(opts: {
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<void> {
    if (opts.search !== undefined) await this.searchInput.fill(opts.search);
    if (opts.status !== undefined) await this.statusSelect.selectOption(opts.status);
    if (opts.dateFrom !== undefined) await this.dateFromInput.fill(opts.dateFrom);
    if (opts.dateTo !== undefined) await this.dateToInput.fill(opts.dateTo);
    await this.filterBtn.click();
  }

  async clearFilters(): Promise<void> {
    await this.clearFilterBtn.click();
  }

  async openDetails(index = 0): Promise<void> {
    await this.detailsBtns.nth(index).click();
    await this.detailsModal.waitFor({ state: 'visible' });
  }

  async closeDetails(): Promise<void> {
    // getByRole('button', { name: 'Close' }) matches both the × icon button (aria-label="Close")
    // and the visible "Close" button — use getByText to target only the labelled button.
    await this.detailsModal.getByText('Close', { exact: true }).click();
    await this.detailsModal.waitFor({ state: 'hidden' });
  }

  async rowCount(): Promise<number> {
    return this.historyRows.count();
  }
}
