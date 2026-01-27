import { useContext } from 'react';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const MainLayout = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  // Debug log
  console.log('User Role:', user?.role);

  // Case-insensitive admin check
  const isAdmin = user?.role?.toUpperCase() === 'ADMIN' || user?.role?.toUpperCase() === 'SUPERADMIN';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      <Navbar bg="dark" variant="dark" expand="lg" className="mb-3">
        <Container>
          <Navbar.Brand>AML Checker</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link as={NavLink} to="/check">
                Check
              </Nav.Link>
              <Nav.Link as={NavLink} to="/history">
                History
              </Nav.Link>
              {isAdmin && (
                <Nav.Link as={NavLink} to="/users">
                  Users
                </Nav.Link>
              )}
              {isAdmin && (
                <Nav.Link as={NavLink} to="/developer">
                  Developer
                </Nav.Link>
              )}
              <Nav.Link as={NavLink} to="/settings">
                Settings
              </Nav.Link>
            </Nav>
            <Nav>
              <Navbar.Text className="me-3">
                Welcome: <strong>{user?.email}</strong> | Role: <strong>{user?.role}</strong>
              </Navbar.Text>
              <Button variant="outline-light" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>
      <Outlet />
    </>
  );
};

export default MainLayout;
