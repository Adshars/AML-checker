import { useContext, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  IconDashboard,
  IconSearch,
  IconHistory,
  IconUsers,
  IconKey,
  IconSettings,
  IconLogout,
  IconMenu2,
  IconChevronLeft,
  IconChevronRight,
  IconBuildingSkyscraper,
} from '@tabler/icons-react';
import { AuthContext } from '../context/AuthContext';
import './MainLayout.scss';

const SIDEBAR_COLLAPSED_KEY = 'aml_sidebar_collapsed';

const NAV_ITEMS = [
  { to: '/dashboard', testId: 'nav-dashboard', label: 'Dashboard', icon: IconDashboard },
  { to: '/check', testId: 'nav-check', label: 'Check', icon: IconSearch },
  { to: '/history', testId: 'nav-history', label: 'History', icon: IconHistory },
  { to: '/users', testId: 'nav-users', label: 'Users', icon: IconUsers, adminOnly: true },
  { to: '/developer', testId: 'nav-developer', label: 'Developer', icon: IconKey, adminOnly: true },
  { to: '/settings', testId: 'nav-settings', label: 'Settings', icon: IconSettings },
];

const MainLayout = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const isAdmin = user?.role?.toUpperCase() === 'ADMIN' || user?.role?.toUpperCase() === 'SUPERADMIN';
  const isSuperAdmin = user?.role === 'superadmin';

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true');
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const closeMobileMenu = () => setMobileOpen(false);

  const items = isSuperAdmin
    ? [{ to: '/superadmin', testId: 'nav-new-org', label: 'New Organization', icon: IconBuildingSkyscraper }]
    : NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);

  return (
    <div className={`app-shell${collapsed ? ' app-shell--collapsed' : ''}`} data-testid="app-shell">
      <button
        type="button"
        className="sidebar-hamburger-btn"
        data-testid="sidebar-hamburger-btn"
        aria-label={mobileOpen ? 'Zamknij menu' : 'Otwórz menu'}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((prev) => !prev)}
      >
        <IconMenu2 size={22} stroke={1.75} />
      </button>

      {mobileOpen && (
        <div
          className="sidebar-overlay"
          data-testid="sidebar-overlay"
          role="presentation"
          onClick={closeMobileMenu}
        />
      )}

      <aside className={`sidebar${mobileOpen ? ' sidebar--mobile-open' : ''}`} data-testid="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__brand-mark">AML</span>
          {!collapsed && <span className="sidebar__brand-text">AML Checker</span>}
        </div>

        <nav className="sidebar__nav">
          {items.map(({ to, testId, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={testId}
              className={({ isActive }) => `sidebar__link${isActive ? ' sidebar__link--active' : ''}`}
              onClick={closeMobileMenu}
            >
              <Icon size={18} stroke={1.75} className="sidebar__icon" />
              {!collapsed && <span className="sidebar__label">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          {!collapsed && user && (
            <div className="sidebar__user" data-testid="sidebar-user">
              <span className="sidebar__user-email">{user.email}</span>
              <span className="sidebar__user-role">{user.role}</span>
            </div>
          )}
          <button type="button" className="sidebar__logout" data-testid="logout-btn" onClick={handleLogout}>
            <IconLogout size={18} stroke={1.75} />
            {!collapsed && <span>Logout</span>}
          </button>
          <button
            type="button"
            className="sidebar__collapse-toggle"
            data-testid="sidebar-collapse-toggle"
            aria-label={collapsed ? 'Rozwiń menu' : 'Zwiń menu'}
            onClick={toggleCollapsed}
          >
            {collapsed ? <IconChevronRight size={18} stroke={1.75} /> : <IconChevronLeft size={18} stroke={1.75} />}
          </button>
        </div>
      </aside>

      <main className="app-shell__content">
        <Outlet />
      </main>
    </div>
  );
};

export default MainLayout;
