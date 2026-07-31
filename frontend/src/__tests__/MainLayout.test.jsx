import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import MainLayout from '../components/MainLayout';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockLogout = vi.fn();

const renderLayout = (user) =>
  render(
    <AuthContext.Provider value={{ user, logout: mockLogout }}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<div>Dashboard content</div>} />
            <Route path="/check" element={<div>Check content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );

describe('MainLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.getItem.mockReturnValue(null);
  });

  it('renders full menu for an admin user', () => {
    renderLayout({ email: 'admin@test.com', role: 'admin' });

    expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('nav-check')).toBeInTheDocument();
    expect(screen.getByTestId('nav-history')).toBeInTheDocument();
    expect(screen.getByTestId('nav-users')).toBeInTheDocument();
    expect(screen.getByTestId('nav-developer')).toBeInTheDocument();
    expect(screen.getByTestId('nav-settings')).toBeInTheDocument();
    expect(screen.getByTestId('logout-btn')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-new-org')).not.toBeInTheDocument();
  });

  it('hides Users and Developer links for a non-admin user', () => {
    renderLayout({ email: 'user@test.com', role: 'user' });

    expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
    expect(screen.getByTestId('nav-check')).toBeInTheDocument();
    expect(screen.getByTestId('nav-history')).toBeInTheDocument();
    expect(screen.getByTestId('nav-settings')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-users')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-developer')).not.toBeInTheDocument();
  });

  it('renders only the New Organization link for a superadmin user', () => {
    renderLayout({ email: 'super@test.com', role: 'superadmin' });

    expect(screen.getByTestId('nav-new-org')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-dashboard')).not.toBeInTheDocument();
    expect(screen.queryByTestId('nav-check')).not.toBeInTheDocument();
  });

  it('calls logout and navigates to /login when logout is clicked', () => {
    renderLayout({ email: 'admin@test.com', role: 'admin' });

    fireEvent.click(screen.getByTestId('logout-btn'));

    expect(mockLogout).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('starts expanded and persists collapsed state to localStorage on toggle', () => {
    renderLayout({ email: 'admin@test.com', role: 'admin' });

    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('sidebar-collapse-toggle'));

    expect(localStorage.setItem).toHaveBeenCalledWith('aml_sidebar_collapsed', 'true');
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });

  it('initializes collapsed when aml_sidebar_collapsed is stored as true', () => {
    localStorage.getItem.mockReturnValue('true');

    renderLayout({ email: 'admin@test.com', role: 'admin' });

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
  });

  it('opens the mobile overlay via the hamburger button and closes it via the backdrop', () => {
    renderLayout({ email: 'admin@test.com', role: 'admin' });

    expect(screen.queryByTestId('sidebar-overlay')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('sidebar-hamburger-btn'));
    expect(screen.getByTestId('sidebar-overlay')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('sidebar-overlay'));
    expect(screen.queryByTestId('sidebar-overlay')).not.toBeInTheDocument();
  });

  it('closes the mobile overlay after navigating via a nav link', () => {
    renderLayout({ email: 'admin@test.com', role: 'admin' });

    fireEvent.click(screen.getByTestId('sidebar-hamburger-btn'));
    expect(screen.getByTestId('sidebar-overlay')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('nav-check'));
    expect(screen.queryByTestId('sidebar-overlay')).not.toBeInTheDocument();
  });
});
