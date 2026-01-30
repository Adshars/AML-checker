import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Form, Button, Alert, Row, Col, Spinner, InputGroup } from 'react-bootstrap';
import { Eye, EyeSlash } from 'react-bootstrap-icons';
import { registerOrganization } from '../services/api';
import { AuthContext } from '../context/AuthContext';

const SuperAdminPage = () => {
  const [formData, setFormData] = useState({
    orgName: '',
    country: '',
    city: '',
    address: '',
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });

  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Auth context for logout
  const { logout } = useContext(AuthContext);
  const navigate = useNavigate();

  /**
   * Handle logout
   */
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  /**
   * Validate form data
   */
  const validateForm = () => {
    const errors = {};

    if (!formData.orgName.trim()) errors.orgName = 'Organization name is required';
    if (!formData.country.trim()) errors.country = 'Country is required';
    if (!formData.city.trim()) errors.city = 'City is required';
    if (!formData.address.trim()) errors.address = 'Address is required';
    if (!formData.firstName.trim()) errors.firstName = 'First name is required';
    if (!formData.lastName.trim()) errors.lastName = 'Last name is required';
    if (!formData.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Valid email is required';
    }
    if (!formData.password) errors.password = 'Password is required';
    else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    return errors;
  };

  /**
   * Handle form input change
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Validate
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setLoading(true);

    try {
      const response = await registerOrganization(formData);

      setSuccessMessage(
        `Organization "${response.organization.name}" created successfully! API credentials sent to ${response.user.email}.`
      );

      // Clear form
      setFormData({
        orgName: '',
        country: '',
        city: '',
        address: '',
        firstName: '',
        lastName: '',
        email: '',
        password: '',
      });
      setFormErrors({});
      setShowPassword(false);

      // ✅ SUCCESS MESSAGE REMAINS VISIBLE - User must manually dismiss it
      // Removed: setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      const msg = error.response?.data?.error || error.message || 'Failed to register organization';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div style={{ maxWidth: '600px', width: '100%' }}>
        <Card>
          <Card.Body>
            {/* Header with Logout button */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2 className="mb-0">SuperAdmin - Register Organization</h2>
              <Button variant="outline-danger" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>

            {successMessage && (
              <Alert variant="success" dismissible onClose={() => setSuccessMessage('')}>
                {successMessage}
              </Alert>
            )}

            {errorMessage && (
              <Alert variant="danger" dismissible onClose={() => setErrorMessage('')}>
                {errorMessage}
              </Alert>
            )}

            <Form onSubmit={handleSubmit}>
              {/* Organization Info */}
              <h5 className="mt-4 mb-3">Organization Information</h5>

              <Form.Group className="mb-3" controlId="orgName">
                <Form.Label>Organization Name</Form.Label>
                <Form.Control
                  type="text"
                  name="orgName"
                  value={formData.orgName}
                  onChange={handleInputChange}
                  isInvalid={!!formErrors.orgName}
                  disabled={loading}
                  placeholder="e.g., ACME Corporation"
                  required
                />
                <Form.Control.Feedback type="invalid">
                  {formErrors.orgName}
                </Form.Control.Feedback>
              </Form.Group>

              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group controlId="country">
                    <Form.Label>Country</Form.Label>
                    <Form.Control
                      type="text"
                      name="country"
                      value={formData.country}
                      onChange={handleInputChange}
                      isInvalid={!!formErrors.country}
                      disabled={loading}
                      placeholder="e.g., US"
                      required
                    />
                    <Form.Control.Feedback type="invalid">
                      {formErrors.country}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group controlId="city">
                    <Form.Label>City</Form.Label>
                    <Form.Control
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      isInvalid={!!formErrors.city}
                      disabled={loading}
                      placeholder="e.g., New York"
                      required
                    />
                    <Form.Control.Feedback type="invalid">
                      {formErrors.city}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3" controlId="address">
                <Form.Label>Address</Form.Label>
                <Form.Control
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  isInvalid={!!formErrors.address}
                  disabled={loading}
                  placeholder="e.g., 123 Business Ave"
                  required
                />
                <Form.Control.Feedback type="invalid">
                  {formErrors.address}
                </Form.Control.Feedback>
              </Form.Group>

              {/* Admin User Info */}
              <h5 className="mt-4 mb-3">Administrator Account</h5>

              <Row className="mb-3">
                <Col md={6}>
                  <Form.Group controlId="firstName">
                    <Form.Label>First Name</Form.Label>
                    <Form.Control
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleInputChange}
                      isInvalid={!!formErrors.firstName}
                      disabled={loading}
                      placeholder="John"
                      required
                    />
                    <Form.Control.Feedback type="invalid">
                      {formErrors.firstName}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group controlId="lastName">
                    <Form.Label>Last Name</Form.Label>
                    <Form.Control
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleInputChange}
                      isInvalid={!!formErrors.lastName}
                      disabled={loading}
                      placeholder="Smith"
                      required
                    />
                    <Form.Control.Feedback type="invalid">
                      {formErrors.lastName}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3" controlId="email">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  isInvalid={!!formErrors.email}
                  disabled={loading}
                  placeholder="admin@organization.com"
                  required
                />
                <Form.Control.Feedback type="invalid">
                  {formErrors.email}
                </Form.Control.Feedback>
              </Form.Group>

              <Form.Group className="mb-4" controlId="password">
                <Form.Label>Password</Form.Label>
                <InputGroup>
                  <Form.Control
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    isInvalid={!!formErrors.password}
                    disabled={loading}
                    placeholder="Minimum 8 characters"
                    required
                  />
                  <Button
                    variant="outline-secondary"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    type="button"
                  >
                    {showPassword ? <EyeSlash /> : <Eye />}
                  </Button>
                </InputGroup>
                <Form.Control.Feedback type="invalid" style={{ display: formErrors.password ? 'block' : 'none' }}>
                  {formErrors.password}
                </Form.Control.Feedback>
                <Form.Text className="text-muted">
                  Password must be at least 8 characters long.
                </Form.Text>
              </Form.Group>

              <Button variant="primary" type="submit" className="w-100" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Registering...
                  </>
                ) : (
                  'Register Organization'
                )}
              </Button>
            </Form>
          </Card.Body>
        </Card>
      </div>
    </Container>
  );
};

export default SuperAdminPage;
