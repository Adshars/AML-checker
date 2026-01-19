import { useContext } from 'react';
import { Navbar, Container, Button, Card, Nav } from 'react-bootstrap';
import ScreeningPanel from '../components/ScreeningPanel';
import { AuthContext } from '../context/AuthContext';

const DashboardPage = () => {
  const { user, logout } = useContext(AuthContext);

  const handleLogout = () => {
    logout();
  };

  return (
    <>
      {/* Navigation Bar */}
      <Navbar bg="dark" variant="dark" className="mb-4">
        <Container>
          <Navbar.Brand>AML Checker</Navbar.Brand>
          <Nav className="ms-auto align-items-center">
            <Navbar.Text className="me-3">
              Zalogowany jako: <strong>{user?.email}</strong>
            </Navbar.Text>
            <Button variant="outline-light" size="sm" onClick={handleLogout}>
              Wyloguj
            </Button>
          </Nav>
        </Container>
      </Navbar>

      {/* Main Content */}
      <Container className="mt-4">
        <h2 className="mb-4">Panel Weryfikacji</h2>

        <Card>
          <Card.Body>
            <Card.Title>Witaj w systemie, {user?.firstName}!</Card.Title>
            <Card.Text>
              Twoja rola to: <strong>{user?.role}</strong>
            </Card.Text>
            <Card.Text className="text-muted">
              System AML Checker umożliwia weryfikację osób i organizacji w listach sankcyjnych.
            </Card.Text>
          </Card.Body>
        </Card>

        <div className="mt-4">
          <ScreeningPanel />
        </div>
      </Container>
    </>
  );
};

export default DashboardPage;
