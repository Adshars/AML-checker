import { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import CheckPage from './pages/CheckPage';
import HistoryPage from './pages/HistoryPage';
import UsersPage from './pages/UsersPage';
import SettingsPage from './pages/SettingsPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import MainLayout from './components/MainLayout';

// Protected Route Component - requires authentication
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return <div className="text-center mt-5">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Root - redirect to check page */}
        <Route path="/" element={<Navigate to="/check" replace />} />

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
          <Route path="/check" element={<CheckPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App