import { useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Container, Card, Form, Button, Alert, InputGroup, Modal } from 'react-bootstrap';
import { Eye, EyeSlash } from 'react-bootstrap-icons';
import { AuthContext } from '../context/AuthContext';
import { requestPasswordReset } from '../services/api';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (location.state?.resetMessage) {
      setInfoMessage(location.state.resetMessage);
      // Clean up message from history state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation - check if fields are not empty
    if (!email.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      await login(email, password);
      // Success - redirect to check page (FIXED)
      navigate('/check');
    } catch (err) {
      // Error - display error message
      setError(err.response?.data?.error || err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: '400px', width: '100%' }}>
        <Card>
          <Card.Body>
            <h2 className="text-center mb-4">AML Checker</h2>
            <h5 className="text-center mb-4 text-muted">Sign In</h5>

            {error && (
              <Alert variant="danger" onClose={() => setError('')} dismissible>
                {error}
              </Alert>
            )}

            {infoMessage && (
              <Alert variant="success" onClose={() => setInfoMessage('')} dismissible>
                {infoMessage}
              </Alert>
            )}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3" controlId="formEmail">
                <Form.Label>Email address</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="Enter email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3" controlId="formPassword">
                <Form.Label>Password</Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <Button
                    variant="outline-secondary"
                    onClick={() => setShowPassword(!showPassword)}
                    type="button"
                    disabled={loading}
                  >
                    {showPassword ? <EyeSlash /> : <Eye />}
                  </Button>
                </InputGroup>
              </Form.Group>

              <div className="d-flex justify-content-end mb-3">
                <Button variant="link" className="p-0" type="button" onClick={() => setShowResetModal(true)}>
                  Forgot Password?
                </Button>
              </div>

              <Button
                variant="primary"
                type="submit"
                className="w-100"
                disabled={loading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </Form>
          </Card.Body>
        </Card>
      </div>

      <Modal show={showResetModal} onHide={() => setShowResetModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Reset Password</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {resetStatus && (
            <Alert variant="success" className="mb-3" onClose={() => setResetStatus('')} dismissible>
              {resetStatus}
            </Alert>
          )}
          {resetError && (
            <Alert variant="danger" className="mb-3" onClose={() => setResetError('')} dismissible>
              {resetError}
            </Alert>
          )}
          <Form
            onSubmit={async (e) => {
              e.preventDefault();
              setResetStatus('');
              setResetError('');

              try {
                setResetLoading(true);
                await requestPasswordReset(resetEmail);
                setResetStatus('Link sent! Check your email or logs.');
                setTimeout(() => setShowResetModal(false), 800);
              } catch (err) {
                const msg = err?.response?.data?.error || 'Failed to send reset link';
                setResetError(msg);
              } finally {
                setResetLoading(false);
              }
            }}
          >
            <Form.Group className="mb-3" controlId="resetEmail">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                disabled={resetLoading}
              />
            </Form.Group>

            <Button variant="primary" type="submit" className="w-100" disabled={resetLoading}>
              {resetLoading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default LoginPage;
