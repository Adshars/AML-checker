import { Page, Locator } from '@playwright/test';

export class HistoryPage {
  private readonly searchInput: Locator;
  private readonly statusSelect: Locator;
  private readonly dateFromInput: Locator;
  private readonly dateToInput: Locator;
  readonly filterBtn: Locator;
  readonly clearFilterBtn: Locator;
  readonly historyTable: Locator;
  readonly historyRows: Locator;
  readonly detailsBtns: Locator;
  readonly detailsModal: Locator;
  readonly paginationInfo: Locator;
  readonly paginationPrev: Locator;
  readonly paginationNext: Locator;
  readonly exportCsvBtn: Locator;

  constructor(private readonly page: Page) {
    this.searchInput = this.page.getByLabel('Search (Name/Query)');
    this.statusSelect = this.page.getByLabel('Status');
    this.dateFromInput = this.page.getByLabel('Date From');
    this.dateToInput = this.page.getByLabel('Date To');
    this.filterBtn = this.page.getByTestId('filter-btn');
    this.clearFilterBtn = this.page.getByTestId('clear-filter-btn');
    this.historyTable = this.page.getByTestId('history-table');
    this.historyRows = this.page.getByTestId('history-row');
    this.detailsBtns = this.page.getByTestId('history-details-btn');
    this.detailsModal = this.page.getByTestId('history-details-modal');
    this.paginationInfo = this.page.getByTestId('pagination-info');
    this.paginationPrev = this.page.getByTestId('pagination-prev');
    this.paginationNext = this.page.getByTestId('pagination-next');
    this.exportCsvBtn = this.page.getByTestId('export-csv-btn');
  }

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
