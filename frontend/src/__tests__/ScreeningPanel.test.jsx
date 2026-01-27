import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScreeningPanel from '../components/ScreeningPanel';
import coreService from '../services/coreService';

// Mock coreService
vi.mock('../services/coreService', () => ({
  default: {
    checkEntity: vi.fn(),
  }
}));

describe('ScreeningPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render form with input and submit button', () => {
    render(<ScreeningPanel />);

    expect(screen.getByLabelText(/entity name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check/i })).toBeInTheDocument();
  });

  it('should show validation error for empty name', async () => {
    render(<ScreeningPanel />);

    const form = screen.getByRole('button', { name: /check/i }).closest('form');
    const inputField = screen.getByLabelText(/entity name/i);
    
    // Remove HTML5 validation to test JS validation
    inputField.removeAttribute('required');
    
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/name field is required/i)).toBeInTheDocument();
    });

    expect(coreService.checkEntity).not.toHaveBeenCalled();
  });

  it('should trim whitespace and reject empty input', async () => {
    render(<ScreeningPanel />);

    const input = screen.getByLabelText(/entity name/i);
    await userEvent.type(input, '   ');

    const submitButton = screen.getByRole('button', { name: /check/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/name field is required/i)).toBeInTheDocument();
    });

    expect(coreService.checkEntity).not.toHaveBeenCalled();
  });

  it('should call coreService.checkEntity with trimmed name', async () => {
    coreService.checkEntity.mockResolvedValue({
      result: 'CLEAN',
      data: []
    });

    render(<ScreeningPanel />);

    const input = screen.getByLabelText(/entity name/i);
    await userEvent.type(input, '  John Doe  ');

    const submitButton = screen.getByRole('button', { name: /check/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(coreService.checkEntity).toHaveBeenCalledWith({
        name: 'John Doe',
        fuzzy: true,
        limit: 10
      });
    });
  });

  it('should show loading spinner during API call', async () => {
    coreService.checkEntity.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<ScreeningPanel />);

    const input = screen.getByLabelText(/entity name/i);
    await userEvent.type(input, 'Test');

    const submitButton = screen.getByRole('button', { name: /check/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  it('should display CLEAN result with success alert', async () => {
    coreService.checkEntity.mockResolvedValue({
      result: 'CLEAN',
      data: []
    });

    render(<ScreeningPanel />);

    const input = screen.getByLabelText(/entity name/i);
    await userEvent.type(input, 'John Doe');

    const submitButton = screen.getByRole('button', { name: /check/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/no sanctions found/i)).toBeInTheDocument();
    });
  });

  it('should display HIT result with danger alert and list', async () => {
    coreService.checkEntity.mockResolvedValue({
      result: 'HIT',
      data: [
        {
          id: '1',
          name: 'Vladimir Putin',
          schema: 'Person',
          country: ['RU'],
          score: 1.0
        },
        {
          id: '2',
          name: 'Putin Foundation',
          schema: 'Organization',
          country: ['RU'],
          score: 0.85
        }
      ]
    });

    render(<ScreeningPanel />);

    const input = screen.getByLabelText(/entity name/i);
    await userEvent.type(input, 'Putin');

    const submitButton = screen.getByRole('button', { name: /check/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/sanction hits detected/i)).toBeInTheDocument();
      expect(screen.getByText('Vladimir Putin')).toBeInTheDocument();
      expect(screen.getByText('Putin Foundation')).toBeInTheDocument();
    });
  });

  it('should normalize API response with different structures', async () => {
    // Test case 1: data in "data" field
    coreService.checkEntity.mockResolvedValue({
      data: [{ id: '1', name: 'Test Entity' }]
    });

    render(<ScreeningPanel />);
    const input = screen.getByLabelText(/entity name/i);
    await userEvent.type(input, 'Test');
    fireEvent.click(screen.getByRole('button', { name: /check/i }));

    await waitFor(() => {
      expect(screen.getByText(/sanction hits detected/i)).toBeInTheDocument();
    });

    vi.clearAllMocks();

    // Test case 2: data in "results" field
    coreService.checkEntity.mockResolvedValue({
      results: [{ id: '2', name: 'Another Entity' }]
    });

    await userEvent.clear(input);
    await userEvent.type(input, 'Another');
    fireEvent.click(screen.getByRole('button', { name: /check/i }));

    await waitFor(() => {
      expect(screen.getByText('Another Entity')).toBeInTheDocument();
    });
  });

  it('should display error message on API failure', async () => {
    coreService.checkEntity.mockRejectedValue({
      response: {
        data: {
          message: 'Service temporarily unavailable'
        }
      }
    });

    render(<ScreeningPanel />);

    const input = screen.getByLabelText(/entity name/i);
    await userEvent.type(input, 'Test');

    const submitButton = screen.getByRole('button', { name: /check/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/service temporarily unavailable/i)).toBeInTheDocument();
    });
  });

  it('should handle API error without response data', async () => {
    coreService.checkEntity.mockRejectedValue({
      message: 'Network error'
    });

    render(<ScreeningPanel />);

    const input = screen.getByLabelText(/entity name/i);
    await userEvent.type(input, 'Test');

    const submitButton = screen.getByRole('button', { name: /check/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it('should open modal when entity is clicked', async () => {
    coreService.checkEntity.mockResolvedValue({
      result: 'HIT',
      data: [
        {
          id: '1',
          name: 'Vladimir Putin',
          schema: 'Person',
          country: ['RU'],
          score: 1.0,
          birthDate: '1952-10-07',
          datasets: ['ofac', 'un-sc']
        }
      ]
    });

    render(<ScreeningPanel />);

    const input = screen.getByLabelText(/entity name/i);
    await userEvent.type(input, 'Putin');
    fireEvent.click(screen.getByRole('button', { name: /check/i }));

    await waitFor(() => {
      expect(screen.getByText('Vladimir Putin')).toBeInTheDocument();
    });

    // Click on the entity
    fireEvent.click(screen.getByText('Vladimir Putin'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
