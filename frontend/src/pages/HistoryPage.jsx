import { useEffect, useMemo, useState } from 'react';
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Form,
  Button,
  Pagination,
  Badge,
  Modal,
  Spinner,
  Alert,
} from 'react-bootstrap';
import { getHistory } from '../services/api';
import ExtendedDetails from '../components/ExtendedDetails';

const HistoryPage = () => {
  const [filters, setFilters] = useState({ search: '', status: '', startDate: '', endDate: '' });
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [logs, setLogs] = useState([]);
  const [meta, setMeta] = useState({ totalPages: 1, currentPage: 1, totalItems: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  // Helper: Extract Latin name from hitDetails or fallback to entityName
  const getLatinName = (entityName, hitDetails) => {
    // If we have hitDetails with name array, search for Latin version
    if (hitDetails && Array.isArray(hitDetails.name)) {
      const latin = hitDetails.name.find(n => /[a-zA-Z]/.test(n));
      if (latin) return latin;
      // Fallback to first name in array
      return hitDetails.name[0];
    }
    // If entityName is array (edge case)
    if (Array.isArray(entityName)) return entityName[0];
    // Fallback to direct entityName
    return entityName || 'Unknown Entity';
  };

  const statusParam = useMemo(() => {
    if (filters.status === 'hit') return true;
    if (filters.status === 'clean') return false;
    return undefined;
  }, [filters.status]);

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);

    // FIX: Append end-of-day time to endDate for inclusive filtering
    const endDateValue = filters.endDate ? `${filters.endDate}T23:59:59` : undefined;

    const params = {
      page,
      limit,
      search: filters.search || undefined,
      startDate: filters.startDate || undefined,
      endDate: endDateValue,
      hasHit: statusParam,
    };

    try {
      const data = await getHistory(params);
      setLogs(data?.data || []);
      setMeta({
        totalPages: data?.meta?.totalPages || 1,
        currentPage: data?.meta?.currentPage || page,
        totalItems: data?.meta?.totalItems || (data?.data?.length ?? 0),
      });
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filters.search, filters.status, filters.startDate, filters.endDate]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchHistory();
  };

  const handleClear = () => {
    setFilters({ search: '', status: '', startDate: '', endDate: '' });
    setPage(1);
    fetchHistory();
  };

  const openDetails = (log) => {
    setSelectedLog(log);
    setShowModal(true);
  };

  const closeDetails = () => {
    setShowModal(false);
    setSelectedLog(null);
  };

  const renderResultBadge = (log) => {
    if (log.isSanctioned === true) {
      return <Badge bg="danger">HIT SANCTION</Badge>;
    }
    if (log.isPep === true) {
      return <Badge bg="warning" text="dark">HIT PEP</Badge>;
    }
    if (log.hasHit === true) {
      return <Badge bg="danger">HIT</Badge>;
    }
    return <Badge bg="success">CLEAN</Badge>;
  };

  const renderUserCell = (userId, userEmail) => {
    if (userId === 'API') {
      return <Badge bg="secondary">API Key</Badge>;
    }
    return userEmail || userId || '—';
  };

  const formatDatasets = (datasets) => {
    if (Array.isArray(datasets)) return datasets.join(', ');
    if (typeof datasets === 'string') return datasets;
    return '—';
  };

  return (
    <Container className="mt-4">
      <h2 className="mb-3">History</h2>

      <Card className="mb-4">
        <Card.Header>Filters</Card.Header>
        <Card.Body>
          <Form onSubmit={handleFilterSubmit}>
            <Row className="g-3">
              <Col md={4}>
                <Form.Group controlId="filterSearch">
                  <Form.Label>Search (Name/Query)</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Enter search term"
                    value={filters.search}
                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  />
                </Form.Group>
              </Col>

              <Col md={2}>
                <Form.Group controlId="filterStatus">
                  <Form.Label>Status</Form.Label>
                  <Form.Select
                    value={filters.status}
                    onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="">All</option>
                    <option value="hit">Hit</option>
                    <option value="clean">Clean</option>
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={2}>
                <Form.Group controlId="filterStartDate">
                  <Form.Label>Date From</Form.Label>
                  <Form.Control
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                </Form.Group>
              </Col>

              <Col md={2}>
                <Form.Group controlId="filterEndDate">
                  <Form.Label>Date To</Form.Label>
                  <Form.Control
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                  />
                </Form.Group>
              </Col>

              <Col md={2} className="d-flex align-items-end gap-2">
                <Button type="submit" variant="primary" className="w-100" disabled={loading}>
                  Filter
                </Button>
                <Button type="button" variant="outline-secondary" className="w-100" onClick={handleClear} disabled={loading}>
                  Clear
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>Audit Logs</Card.Header>
        <Card.Body>
          {error && (
            <Alert variant="warning" className="mb-3">
              {error}
            </Alert>
          )}

          {loading ? (
            <div className="d-flex align-items-center justify-content-center py-4">
              <Spinner animation="border" role="status" className="me-2" />
              <span>Loading history…</span>
            </div>
          ) : (
            <>
              <Table striped bordered hover responsive className="mb-3">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>User</th>
                    <th>Search Query</th>
                    <th>Result</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted">
                        No data.
                      </td>
                    </tr>
                  )}

                  {logs.map((log) => (
                    <tr key={log.id || log._id || log.createdAt}>
                      <td>{log.createdAt ? new Date(log.createdAt).toLocaleString() : '—'}</td>
                      <td>{renderUserCell(log.userId, log.userEmail)}</td>
                      <td>{log.searchQuery || '—'}</td>
                      <td>{renderResultBadge(log)}</td>
                      <td>
                        <Button variant="outline-primary" size="sm" onClick={() => openDetails(log)}>
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <div className="d-flex align-items-center justify-content-between">
                <div className="text-muted">Page {meta.currentPage} of {meta.totalPages}</div>
                <Pagination className="mb-0">
                  <Pagination.Prev disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} />
                  <Pagination.Next disabled={page >= (meta.totalPages || 1)} onClick={() => setPage((p) => p + 1)} />
                </Pagination>
              </div>
            </>
          )}
        </Card.Body>
      </Card>

      <Modal show={showModal} onHide={closeDetails} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Log Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedLog && (
            <>
              {/* SECTION 1: System Metadata (Pretty Table at Top) */}
              <div className="mb-4">
                <h6 className="text-uppercase text-secondary small fw-bold mb-3">System Metadata</h6>
                <Table size="sm" borderless className="mb-0">
                  <tbody>
                    <tr>
                      <td className="text-muted" style={{ width: '140px' }}>Date:</td>
                      <td className="fw-medium">
                        {selectedLog.createdAt ? new Date(selectedLog.createdAt).toLocaleString() : '—'}
                      </td>
                    </tr>
                    <tr>
                      <td className="text-muted">User:</td>
                      <td>{renderUserCell(selectedLog.userId, selectedLog.userEmail)}</td>
                    </tr>
                    <tr>
                      <td className="text-muted">Search Query:</td>
                      <td className="fw-bold text-primary">"{selectedLog.searchQuery}"</td>
                    </tr>
                    <tr>
                      <td className="text-muted">Result:</td>
                      <td>{renderResultBadge(selectedLog)}</td>
                    </tr>
                  </tbody>
                </Table>
              </div>

              <hr className="my-3" />

              {/* SECTION 2: Entity Data (Header with Latin Name) */}
              <div className="mb-4">
                <h5 className="mb-1">
                  {getLatinName(selectedLog.entityName, selectedLog.hitDetails)}
                </h5>
                <p className="text-muted small mb-3">
                  {selectedLog.entityDescription || 
                   selectedLog.hitDetails?.position?.[0] || 
                   'No description available'}
                </p>
                {selectedLog.entityCountries && (
                  <p className="text-muted small mb-0">
                    <strong>Countries:</strong> {selectedLog.entityCountries}
                  </p>
                )}
                {selectedLog.entityDatasets && (
                  <p className="text-muted small">
                    <strong>Datasets:</strong> {formatDatasets(selectedLog.entityDatasets)}
                  </p>
                )}
              </div>

              <hr className="my-3" />

              {/* SECTION 3: Extended Details (Reusable Component) */}
              {/* Pass hitDetails (JSONB from database) */}
              <ExtendedDetails data={selectedLog.hitDetails} />

              {/* SECTION 4: Debug Info (Collapsible JSON) */}
              <div className="mt-4">
                <details>
                  <summary 
                    className="text-muted small" 
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                  >
                    📋 Show Raw Debug JSON
                  </summary>
                  <pre 
                    className="bg-light p-3 mt-2 rounded border small" 
                    style={{ maxHeight: '250px', overflow: 'auto' }}
                  >
                    {JSON.stringify(selectedLog, null, 2)}
                  </pre>
                </details>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeDetails}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default HistoryPage;
