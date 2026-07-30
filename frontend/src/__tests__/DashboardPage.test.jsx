import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '../pages/DashboardPage';

vi.mock('../services/api', () => ({
  getDashboardStats: vi.fn(),
  default: {},
}));

import { getDashboardStats } from '../services/api';

const baseLog = {
  id: 'log-1',
  searchQuery: 'Jane Doe',
  createdAt: '2026-07-01T10:00:00.000Z',
  isSanctioned: false,
  isPep: false,
};

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading state before the stats resolve', () => {
    getDashboardStats.mockReturnValue(new Promise(() => {}));
    render(<DashboardPage />);
    expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument();
  });

  it('shows a note that statistics cover the last 30 days', async () => {
    getDashboardStats.mockResolvedValue({
      totalChecks: 22,
      sanctionHits: 17,
      pepHits: 3,
      recentLogs: [],
    });
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/last 30 days/i)).toBeInTheDocument();
    });
  });

  it('renders the stat cards once data loads', async () => {
    getDashboardStats.mockResolvedValue({
      totalChecks: 22,
      sanctionHits: 17,
      pepHits: 3,
      recentLogs: [],
    });
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('stat-total-checks')).toHaveTextContent('22');
    });
    expect(screen.getByTestId('stat-sanction-hits')).toHaveTextContent('17');
    expect(screen.getByTestId('stat-pep-hits')).toHaveTextContent('3');
  });

  it('shows the activity chart when there are recent logs', async () => {
    getDashboardStats.mockResolvedValue({
      totalChecks: 1,
      sanctionHits: 0,
      pepHits: 0,
      recentLogs: [baseLog],
    });
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Activity Chart')).toBeInTheDocument();
    });
    expect(screen.queryByText('No activity data available yet.')).not.toBeInTheDocument();
  });

  it('shows a placeholder message when there is no activity data', async () => {
    getDashboardStats.mockResolvedValue({
      totalChecks: 0,
      sanctionHits: 0,
      pepHits: 0,
      recentLogs: [],
    });
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('No activity data available yet.')).toBeInTheDocument();
    });
  });

  it('renders recent activity rows with the correct result badge', async () => {
    getDashboardStats.mockResolvedValue({
      totalChecks: 2,
      sanctionHits: 1,
      pepHits: 0,
      recentLogs: [
        { ...baseLog, id: 'log-1', searchQuery: 'Clean Corp', isSanctioned: false, isPep: false },
        { ...baseLog, id: 'log-2', searchQuery: 'Flagged Corp', isSanctioned: true, isPep: false },
      ],
    });
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByTestId('recent-activity-table')).toBeInTheDocument();
    });
    expect(screen.getByText('Clean Corp')).toBeInTheDocument();
    expect(screen.getByText('Flagged Corp')).toBeInTheDocument();
    expect(screen.getByText('Clear')).toBeInTheDocument();
    expect(screen.getByText('Sanction')).toBeInTheDocument();
  });

  it('shows a placeholder message when there is no recent activity', async () => {
    getDashboardStats.mockResolvedValue({
      totalChecks: 0,
      sanctionHits: 0,
      pepHits: 0,
      recentLogs: [],
    });
    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('No recent activity.')).toBeInTheDocument();
    });
  });
});
