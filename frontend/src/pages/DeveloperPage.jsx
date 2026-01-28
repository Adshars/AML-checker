import { useEffect, useState } from 'react';
import { Card, Button, Form, Row, Col, InputGroup, Modal, Alert } from 'react-bootstrap';
import { Clipboard, Check } from 'react-bootstrap-icons';
import { getOrganizationKeys, resetOrganizationSecret } from '../services/api';

const DeveloperPage = () => {
  const [apiKey, setApiKey] = useState('');
  const [copiedApi, setCopiedApi] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [modalStep, setModalStep] = useState('confirm'); // 'confirm' | 'success'
  const [newSecret, setNewSecret] = useState('');
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [modalError, setModalError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getOrganizationKeys();
        setApiKey(data?.apiKey || '');
      } catch (e) {
        // Optionally show alert/toast
      }
    })();
  }, []);

  const copyToClipboard = async (text, onDone) => {
    await navigator.clipboard.writeText(text);
    onDone(true);
    setTimeout(() => onDone(false), 1200);
  };

  const onOpenReset = () => {
    setShowModal(true);
    setModalStep('confirm');
    setNewSecret('');
    setConfirmPassword('');
    setModalError('');
  };

  const onConfirmReset = async (e) => {
    e.preventDefault();
    setModalError('');
    try {
      setLoading(true);
      const data = await resetOrganizationSecret(confirmPassword);
      setNewSecret(data?.newApiSecret || '');
      setModalStep('success');
    } catch (err) {
      const msg = err?.response?.status === 403
        ? 'Incorrect password'
        : err?.response?.data?.error || 'Failed to reset secret';
      setModalError(msg);
    } finally {
      setLoading(false);
    }
  };

  const onCloseModal = () => {
    setShowModal(false);
    setNewSecret('');
    setModalStep('confirm');
    setConfirmPassword('');
    setModalError('');
  };

  return (
    <Row className="justify-content-center">
      <Col md={10} lg={8}>
        <Card className="mb-4">
          <Card.Body>
            <Card.Title>Public API Key</Card.Title>
            <InputGroup className="mt-2">
              <Form.Control value={apiKey} readOnly />
              <Button
                variant="outline-secondary"
                type="button"
                onClick={() => copyToClipboard(apiKey, setCopiedApi)}
                disabled={!apiKey}
              >
                {copiedApi ? <Check /> : <Clipboard />}
              </Button>
            </InputGroup>
          </Card.Body>
        </Card>

        <Card>
          <Card.Body>
            <Card.Title>API Secret Key</Card.Title>
            <p className="text-muted mb-3">
              Reset reveals a new secret once. Store it securely.
            </p>
            <Button variant="danger" type="button" onClick={onOpenReset}>
              Reset Secret Key
            </Button>
          </Card.Body>
        </Card>

        <Modal show={showModal} onHide={onCloseModal} centered>
          <Modal.Header closeButton>
            <Modal.Title>Reset API Secret</Modal.Title>
          </Modal.Header>

          {modalStep === 'confirm' && (
            <Form onSubmit={onConfirmReset}>
              <Modal.Body>
                {modalError && <Alert variant="danger">{modalError}</Alert>}
                <Form.Group controlId="confirmPassword">
                  <Form.Label>Enter your password to confirm</Form.Label>
                  <Form.Control
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </Form.Group>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="secondary" type="button" onClick={onCloseModal}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={loading}>
                  {loading ? 'Confirming...' : 'Confirm'}
                </Button>
              </Modal.Footer>
            </Form>
          )}

          {modalStep === 'success' && (
            <>
              <Modal.Body>
                <Alert variant="warning" className="mb-3">
                  This key will be shown only once. Copy it now!
                </Alert>
                <InputGroup className="mb-2">
                  <Form.Control value={newSecret} readOnly />
                  <Button
                    variant="outline-secondary"
                    type="button"
                    onClick={() => copyToClipboard(newSecret, setCopiedSecret)}
                  >
                    {copiedSecret ? <Check /> : <Clipboard />}
                  </Button>
                </InputGroup>
              </Modal.Body>
              <Modal.Footer>
                <Button variant="primary" type="button" onClick={onCloseModal}>
                  Close
                </Button>
              </Modal.Footer>
            </>
          )}
        </Modal>
      </Col>
    </Row>
  );
};

export default DeveloperPage;
