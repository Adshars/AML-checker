import { Form, Alert } from 'react-bootstrap';
import {
  IDENTITY_MODES,
  IDENTITY_MODE_LABELS,
  SANCTIONS_LABEL,
  NO_SERVICE_MESSAGE,
  hasAnyService,
} from '../constants/services';

/**
 * Organization service package picker (registration and SuperAdmin edit form)
 * @param {{ value: { sanctions: boolean, identityMode: string }, onChange: Function, disabled?: boolean, idPrefix?: string }} props
 */
const ServicesSelector = ({ value, onChange, disabled = false, idPrefix = 'services' }) => {
  const noService = !hasAnyService(value);

  return (
    <div data-testid="services-selector">
      <Form.Check
        type="checkbox"
        id={`${idPrefix}-sanctions`}
        label={SANCTIONS_LABEL}
        checked={value.sanctions}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, sanctions: e.target.checked })}
        className="mb-3"
        data-testid="services-sanctions"
      />

      <Form.Label as="div" className="fw-semibold mb-2" id={`${idPrefix}-identity-label`}>
        Identity service
      </Form.Label>
      <div role="radiogroup" aria-labelledby={`${idPrefix}-identity-label`}>
        {IDENTITY_MODES.map((mode) => (
          <Form.Check
            key={mode}
            type="radio"
            id={`${idPrefix}-identity-${mode}`}
            name={`${idPrefix}-identityMode`}
            label={IDENTITY_MODE_LABELS[mode]}
            value={mode}
            checked={value.identityMode === mode}
            disabled={disabled}
            onChange={() => onChange({ ...value, identityMode: mode })}
            data-testid={`services-identity-${mode}`}
          />
        ))}
      </div>

      {noService && (
        <Alert variant="warning" className="mt-3 mb-0 py-2" data-testid="services-none-warning">
          {NO_SERVICE_MESSAGE}.
        </Alert>
      )}
    </div>
  );
};

export default ServicesSelector;
