import { useState } from 'react';
import { Card, Form, Button, Spinner, Alert, ListGroup, Modal, Badge } from 'react-bootstrap';
import useSanctionsCheck from '../hooks/useSanctionsCheck';
import { MATCH_STATUS } from '../constants/sanctions';
import ExtendedDetails from './ExtendedDetails';

function ScreeningPanel() {
  const [name, setName] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedEntity, setSelectedEntity] = useState(null);

  const { loading, error, results, checkEntity } = useSanctionsCheck();

  const handleSubmit = (e) => {
    e.preventDefault();
    checkEntity(name);
  };

  const isClean = results?.matchStatus === MATCH_STATUS.CLEAN;
  const isHit = results?.matchStatus === MATCH_STATUS.HIT;
  const hasEntities = results?.entities?.length > 0;

  const handleEntityClick = (entity) => {
    setSelectedEntity(entity);
    setShowModal(true);
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

                  {hasEntities ? (
                    <ListGroup>
                      {results.entities.map((entity, idx) => (
                        <ListGroup.Item
                          key={entity.id || idx}
                          onClick={() => handleEntityClick(entity)}
                          style={{ cursor: 'pointer' }}
                          className="action"
                        >
                          <div className="d-flex justify-content-between align-items-start">
                            <div>
                              <div className="fw-semibold">{entity.name}</div>
                              <div className="text-muted">
                                Schema: <span>{entity.raw.schema || 'N/A'}</span>
                              </div>
                              <div className="text-muted">
                                Countries: <span>
                                  {entity.countries.length > 0
                                    ? entity.countries.join(', ')
                                    : 'N/A'}
                                </span>
                              </div>
                              <div className="mt-1">
                                {entity.isSanctioned && <Badge bg="danger" className="me-1">Sanction</Badge>}
                                {entity.isPep && <Badge bg="warning" text="dark">PEP</Badge>}
                              </div>
                            </div>
                            <div className="text-nowrap">
                              Score: <strong>
                                {entity.score !== null
                                  ? entity.score.toFixed(2)
                                  : 'N/A'}
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
                <Alert variant="secondary">No result or unknown response status. Debug: {results?.matchStatus}</Alert>
              )}
            </div>
          )}
        </Card.Body>
      </Card>

      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>{selectedEntity?.name}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedEntity && (
            <>
              <div className="mb-4">
                <div className="text-muted mb-2">
                  <strong>Schema:</strong> {selectedEntity.raw.schema || 'N/A'}
                </div>
                <div className="text-muted mb-2">
                  <strong>Match Score:</strong> {selectedEntity.score?.toFixed(2) || 'N/A'}
                </div>
                <div className="text-muted mb-2">
                  <strong>Countries:</strong> {selectedEntity.countries.length > 0
                    ? selectedEntity.countries.join(', ')
                    : 'N/A'}
                </div>
                <div className="text-muted">
                  <strong>Datasets:</strong> {Array.isArray(selectedEntity.raw.datasets)
                    ? selectedEntity.raw.datasets.join(', ')
                    : (selectedEntity.raw.datasets || 'N/A')}
                </div>
              </div>

              <ExtendedDetails data={selectedEntity.raw.properties} />
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
