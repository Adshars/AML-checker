import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ExtendedDetails from '../components/ExtendedDetails';

describe('ExtendedDetails', () => {
  it('shows a placeholder message when there is no data', () => {
    render(<ExtendedDetails data={null} />);
    expect(screen.getByText('No additional details available.')).toBeInTheDocument();
  });

  it('shows a placeholder message for an empty data object', () => {
    render(<ExtendedDetails data={{}} />);
    expect(screen.getByText('No additional details available.')).toBeInTheDocument();
  });

  it('formats camelCase keys as Title Case labels', () => {
    render(<ExtendedDetails data={{ birthPlace: 'Warsaw' }} />);
    expect(screen.getByText('Birth Place')).toBeInTheDocument();
    expect(screen.getByText('Warsaw')).toBeInTheDocument();
  });

  it('renders priority fields before non-priority fields, in priority order', () => {
    render(<ExtendedDetails data={{ nationality: 'PL', name: 'Jan Kowalski', birthDate: '1980-01-01' }} />);
    const rows = screen.getAllByRole('row');
    const labels = rows.map((row) => row.querySelector('td')?.textContent);
    expect(labels).toEqual(['Name', 'Birth Date', 'Nationality']);
  });

  it('filters out technical/ignored fields such as schema and datasets', () => {
    render(<ExtendedDetails data={{ name: 'Jan Kowalski', schema: 'Person', datasets: ['ofac'] }} />);
    expect(screen.getByText('Jan Kowalski')).toBeInTheDocument();
    expect(screen.queryByText('Schema')).not.toBeInTheDocument();
    expect(screen.queryByText('Datasets')).not.toBeInTheDocument();
  });

  it('renders array values as a list', () => {
    render(<ExtendedDetails data={{ alias: ['Johnny', 'JK'] }} />);
    expect(screen.getByText('Johnny')).toBeInTheDocument();
    expect(screen.getByText('JK')).toBeInTheDocument();
  });

  it('omits fields whose value is an empty array', () => {
    render(<ExtendedDetails data={{ name: 'Jan Kowalski', weakAlias: [] }} />);
    expect(screen.queryByText('Weak Alias')).not.toBeInTheDocument();
  });
});
