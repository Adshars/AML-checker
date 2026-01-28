import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Form, Button, Alert, Container, Row, Col, InputGroup } from 'react-bootstrap';
import { Eye, EyeSlash } from 'react-bootstrap-icons';
import { confirmPasswordReset } from '../services/api';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const userId = searchParams.get('id') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token || !userId) {
      setStatus({ type: 'error', message: 'Missing or invalid reset link parameters.' });
    }
  }, [token, userId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: '', message: '' });

    if (!token || !userId) {
      setStatus({ type: 'error', message: 'Reset link is invalid.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: 'Passwords do not match' });
      return;
    }

    try {
      setLoading(true);
      await confirmPasswordReset({ userId, token, newPassword });
      setStatus({ type: 'success', message: 'Password reset successful. Redirecting to login...' });
      setTimeout(() => navigate('/login', { state: { resetMessage: 'Password reset successful. Please login.' } }), 900);
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to reset password';
      setStatus({ type: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <Row className="w-100 justify-content-center">
        <Col md={6} lg={5}>
          <Card>
            <Card.Body>
              <Card.Title className="mb-4 text-center">Set a New Password</Card.Title>
              {status.message && (
                <Alert variant={status.type === 'success' ? 'success' : 'danger'}>{status.message}</Alert>
              )}
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3" controlId="newPassword">
                  <Form.Label>New Password</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <Button
                      variant="outline-secondary"
                      type="button"
                      onClick={() => setShowNew((prev) => !prev)}
                    >
                      {showNew ? <EyeSlash /> : <Eye />}
                    </Button>
                  </InputGroup>
                </Form.Group>

                <Form.Group className="mb-3" controlId="confirmPassword">
                  <Form.Label>Confirm Password</Form.Label>
                  <InputGroup>
                    <Form.Control
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                    <Button
                      variant="outline-secondary"
                      type="button"
                      onClick={() => setShowConfirm((prev) => !prev)}
                    >
                      {showConfirm ? <EyeSlash /> : <Eye />}
                    </Button>
                  </InputGroup>
                </Form.Group>

                <Button variant="primary" type="submit" className="w-100" disabled={loading}>
                  {loading ? 'Setting...' : 'Set New Password'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ResetPasswordPage;
