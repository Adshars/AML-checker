import { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { AuthContext } from './context/AuthContext';
import { DEFAULT_SERVICES, isServiceEnabled } from './constants/services';
import { getHomeRoute } from './utils/homeRoute';
import LoginPage from './pages/LoginPage';
import SuperAdminPage from './pages/SuperAdminPage';
import SuperAdminOrganizationsPage from './pages/SuperAdminOrganizationsPage';
import SuperAdminOrganizationDetailsPage from './pages/SuperAdminOrganizationDetailsPage';
import DashboardPage from './pages/DashboardPage';
import CheckPage from './pages/CheckPage';
import HistoryPage from './pages/HistoryPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DeveloperPage from './pages/DeveloperPage';
import MainLayout from './components/MainLayout';

// Protected Route Component - requires authentication,
// optionally a role and/or an enabled organization service
export const ProtectedRoute = ({ children, requiredRole = null, requiredService = null }) => {
  const { user, services = DEFAULT_SERVICES, loading } = useContext(AuthContext);

  if (loading) {
    return <div className="text-center mt-5">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={getHomeRoute(user, services)} replace />;
  }

  if (requiredService && !isServiceEnabled(services, requiredService)) {
    return <Navigate to={getHomeRoute(user, services)} replace />;
  }

  return children;
};

// Root - first route available to the user
const HomeRedirect = () => {
  const { user, services = DEFAULT_SERVICES } = useContext(AuthContext);
  return <Navigate to={getHomeRoute(user, services)} replace />;
};

export const AppRoutes = () => (
  <Routes>
    <Route
      path="/"
      element={
        <ProtectedRoute>
          <HomeRedirect />
        </ProtectedRoute>
      }
    />

    {/* Public route - Login */}
    <Route path="/login" element={<LoginPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />

    {/* Protected routes with MainLayout */}
    <Route
      element={
        <ProtectedRoute>
          <MainLayout />
        </ProtectedRoute>
      }
    >
      <Route path="/dashboard" element={<ProtectedRoute requiredService="sanctions"><DashboardPage /></ProtectedRoute>} />
      <Route path="/check" element={<ProtectedRoute requiredService="sanctions"><CheckPage /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute requiredService="sanctions"><HistoryPage /></ProtectedRoute>} />
      <Route path="/users" element={<UsersPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/developer" element={<DeveloperPage />} />

      {/* SuperAdmin routes */}
      <Route
        path="/superadmin"
        element={<ProtectedRoute requiredRole="superadmin"><SuperAdminOrganizationsPage /></ProtectedRoute>}
      />
      <Route
        path="/superadmin/organizations/new"
        element={<ProtectedRoute requiredRole="superadmin"><SuperAdminPage /></ProtectedRoute>}
      />
      <Route
        path="/superadmin/organizations/:id"
        element={<ProtectedRoute requiredRole="superadmin"><SuperAdminOrganizationDetailsPage /></ProtectedRoute>}
      />
    </Route>
  </Routes>
);

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <ToastContainer position="top-right" autoClose={4000} newestOnTop />
    </BrowserRouter>
  );
}

export default App