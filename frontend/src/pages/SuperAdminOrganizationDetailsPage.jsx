import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Container, Card, Row, Col, Button, Modal, Spinner, Alert } from 'react-bootstrap';
import { IconArrowLeft } from '@tabler/icons-react';
import { toast } from 'react-toastify';
import { getOrganization, updateOrganizationServices } from '../services/organizationService';
import ServicesSelector from '../components/ServicesSelector';
import ServiceBadges from '../components/ServiceBadges';
import { hasAnyService, normalizeServices, PROPAGATION_NOTICE } from '../constants/services';

const sameServices = (a, b) => a.sanctions === b.sanctions && a.identityMode === b.identityMode;

const SuperAdminOrganizationDetailsPage = () => {
  const { id } = useParams();
  const [organization, setOrganization] = useState(null);
  const [services, setServices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;

    const fetchOrganization = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await getOrganization(id);
        if (ignore) return;
        setOrganization(data);
        setServices(normalizeServices(data.services));
      } catch (err) {
        if (ignore) return;
        const message = err?.response?.status === 404
          ? 'Organization not found.'
          : err?.response?.data?.error || err.message || 'Failed to load organization';
        setLoadError(message);
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchOrganization();
    return () => {
      ignore = true;
    };
  }, [id]);

  const savedServices = organization ? normalizeServices(organization.services) : null;
  const isDirty = Boolean(services && savedServices && !sameServices(services, savedServices));
  const canSave = isDirty && hasAnyService(services) && !saving;

  const handleConfirmSave = async () => {
    setSaving(true);
    try {
      const updated = await updateOrganizationServices(id, services);
      setOrganization((prev) => ({ ...prev, ...updated }));
      setServices(normalizeServices(updated.services));
      toast.success('Organization services updated');
      setShowConfirm(false);
    } catch (err) {
      toast.error(err?.response?.data?.error || err.message || 'Failed to update services');
      setShowConfirm(false);
    } finally {
      setSaving(false);
    }
  };

  const backLink = (
    <Link to="/superadmin" className="d-inline-flex align-items-center mb-3" data-testid="back-to-organizations">
      <IconArrowLeft size={16} stroke={1.75} className="me-1" />
      Back to organizations
    </Link>
  );

  if (loading) {
    return (
      <Container className="mt-4">
        <div className="d-flex align-items-center justify-content-center py-5">
          <Spinner animation="border" role="status" className="me-2" />
          <span>Loading organization…</span>
        </div>
      </Container>
    );
  }

  if (loadError) {
    return (
      <Container className="mt-4">
        {backLink}
        <Alert variant="danger" data-testid="organization-load-error">{loadError}</Alert>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      {backLink}
      <h2 className="mb-3" data-testid="organization-name">{organization.name}</h2>

      <Row className="g-3">
        <Col lg={5}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title as="h5" className="mb-3">Organization</Card.Title>
              <dl className="row mb-0">
                <dt className="col-sm-5">Name</dt>
                <dd className="col-sm-7">{organization.name}</dd>
                <dt className="col-sm-5">Address</dt>
                <dd className="col-sm-7">
                  {[organization.address, organization.city, organization.country].filter(Boolean).join(', ') || '—'}
                </dd>
                <dt className="col-sm-5">Created</dt>
                <dd className="col-sm-7">
                  {organization.createdAt ? new Date(organization.createdAt).toLocaleString() : '—'}
                </dd>
                <dt className="col-sm-5">Users</dt>
                <dd className="col-sm-7" data-testid="organization-user-count">{organization.userCount ?? 0}</dd>
                <dt className="col-sm-5">Current services</dt>
                <dd className="col-sm-7 mb-0"><ServiceBadges services={organization.services} /></dd>
              </dl>
            </Card.Body>
          </Card>
        </Col>

        <Col lg={7}>
          <Card className="h-100">
            <Card.Body>
              <Card.Title as="h5" className="mb-3">Services</Card.Title>
              <ServicesSelector value={services} onChange={setServices} disabled={saving} idPrefix="org-services" />
              <p className="text-muted small mt-3 mb-3" data-testid="propagation-notice">{PROPAGATION_NOTICE}</p>
              <div className="d-flex gap-2">
                <Button
                  variant="primary"
                  onClick={() => setShowConfirm(true)}
                  disabled={!canSave}
                  data-testid="save-services-btn"
                >
                  Save
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={() => setServices(savedServices)}
                  disabled={!isDirty || saving}
                  data-testid="reset-services-btn"
                >
                  Discard changes
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Modal show={showConfirm} onHide={() => !saving && setShowConfirm(false)} centered data-testid="confirm-services-modal">
        <Modal.Header closeButton>
          <Modal.Title>Confirm service change</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Change services of <strong>{organization.name}</strong>?</p>
          <Alert variant="warning" className="mb-0">
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="text-muted">From:</span> <ServiceBadges services={savedServices} />
            </div>
            <div className="d-flex align-items-center gap-2 mb-2">
              <span className="text-muted">To:</span> <ServiceBadges services={services} />
            </div>
            <small className="text-muted">{PROPAGATION_NOTICE}</small>
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowConfirm(false)} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={handleConfirmSave} disabled={saving} data-testid="confirm-services-btn">
            {saving ? <><Spinner animation="border" size="sm" className="me-2" />Saving...</> : 'Save changes'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default SuperAdminOrganizationDetailsPage;
