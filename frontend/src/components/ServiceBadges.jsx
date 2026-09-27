import { Badge } from 'react-bootstrap';
import { IDENTITY_MODE_BADGES, normalizeServices } from '../constants/services';

/**
 * Compact badges for an organization service package
 */
const ServiceBadges = ({ services }) => {
  const { sanctions, identityMode } = normalizeServices(services);

  return (
    <span className="d-inline-flex flex-wrap gap-1" data-testid="service-badges">
      {sanctions && <Badge bg="primary">Sanctions</Badge>}
      {identityMode !== 'NONE' && <Badge bg="info">{IDENTITY_MODE_BADGES[identityMode]}</Badge>}
    </span>
  );
};

export default ServiceBadges;
