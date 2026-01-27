import { useState } from 'react';
import { Card, Form, Button, Spinner, Alert, ListGroup, Modal, Table } from 'react-bootstrap';
import coreService from '../services/coreService';

function ScreeningPanel() {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name field is required.');
      return;
    }

    setLoading(true);
    try {
      const result = await coreService.checkEntity({ name: trimmedName, fuzzy: true, limit: 10 });
      console.log('API RESPONSE STRUCTURE:', result);
      console.log('Full JSON response:', JSON.stringify(result, null, 2));

      // DATA NORMALIZATION - extract hits array from various possible structures
      const hits = result?.data || result?.results || result?.hits || [];
      const matchStatus = result?.result || (Array.isArray(hits) && hits.length > 0 ? 'HIT' : 'CLEAN');

      console.log('Normalized data:', { matchStatus, hits });

      // Store normalized structure
      setResults({
        result: matchStatus,
        data: Array.isArray(hits) ? hits : [],
      });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'An error occurred during the check.';
      console.error('API Error:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const isClean = results?.result === 'CLEAN';
  const isHit = results?.result === 'HIT';
  const hasData = Array.isArray(results?.data) && results.data.length > 0;

  const handleEntityClick = (entity) => {
    setSelectedEntity(entity);
    setShowModal(true);
  };

  const formatKey = (key) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  const formatValue = (value) => {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value || '-';
  };

  return (
    <>
      <Card>
        <Card.Header>Entity Screening</Card.Header>
        <Card.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="screeningName">
              <Form.Label>Entity name</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Form.Group>

            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? 'Checking…' : 'Check'}
            </Button>
          </Form>

          {error && (
            <Alert className="mt-3" variant="warning">
              {error}
            </Alert>
          )}

          {loading && (
            <div className="mt-3 d-flex align-items-center">
              <Spinner animation="border" role="status" size="sm" className="me-2" />
              <span>Loading…</span>
            </div>
          )}

          {!loading && results && (
            <div className="mt-3">
              {isClean && (
                <Alert variant="success">✓ No sanctions found (CLEAN)</Alert>
              )}

              {isHit && (
                <>
                  <Alert variant="danger">⚠ Sanction hits detected!</Alert>

                  {hasData ? (
                    <ListGroup>
                      {results.data.map((hit, idx) => (
                        <ListGroup.Item 
                          key={hit.id || idx}
                          onClick={() => handleEntityClick(hit)}
                          style={{ cursor: 'pointer' }}
                          className="action"
                        >
                          <div className="d-flex justify-content-between align-items-start">
                            <div>
                              <div className="fw-semibold">{hit.name || 'Unknown name'}</div>
                              <div className="text-muted">
                                Schema: <span>{hit.schema || 'N/A'}</span>
                              </div>
                              <div className="text-muted">
                                Countries: <span>
                                  {Array.isArray(hit.country) 
                                    ? hit.country.join(', ') 
                                    : (hit.country || 'N/A')}
                                </span>
                              </div>
                            </div>
                            <div className="text-nowrap">
                              Score: <strong>
                                {typeof hit.score === 'number' 
                                  ? hit.score.toFixed(2) 
                                  : (hit.score ?? 'N/A')}
                              </strong>
                            </div>
                          </div>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  ) : (
                    <Alert variant="info">No details available for this result.</Alert>
                  )}
                </>
              )}

              {!isClean && !isHit && (
                <Alert variant="secondary">No result or unknown response status. Debug: {results?.result}</Alert>
              )}
            </div>
          )}
        </Card.Body>
      </Card>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Entity Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedEntity && (
            <>
              <h5 className="mb-3">{selectedEntity.name || 'Unknown Entity'}</h5>
              <Table striped bordered hover responsive>
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(selectedEntity).map(([key, value]) => {
                    if (key === 'id' || value === null || (typeof value === 'object' && !Array.isArray(value))) {
                      return null;
                    }
                    return (
                      <tr key={key}>
                        <td>
                          <strong>{formatKey(key)}</strong>
                        </td>
                        <td>{formatValue(value)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default ScreeningPanel;
