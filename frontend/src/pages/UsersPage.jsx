import { useState } from 'react';
import {
  Container,
  Card,
  Table,
  Button,
  Modal,
  Form,
  Alert,
  Spinner,
  Badge,
  InputGroup,
} from 'react-bootstrap';
import { Eye, EyeSlash } from 'react-bootstrap-icons';
import useUsers from '../hooks/useUsers';

const UsersPage = () => {
  // Logic & Data managed by custom hook
  const {
    users,
    loading,
    error,
    success,
    addUser,
    removeUser,
    setError,
    setSuccess,
    clearMessages
  } = useUsers();

  // Local UI State (Modals & Form)
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [formErrors, setFormErrors] = useState({});

  /**
   * UI Actions
   */
  const handleAddUserClick = () => {
    setFormData({ firstName: '', lastName: '', email: '', password: '' });
    setFormErrors({});
    setShowAddModal(true);
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setShowPassword(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.firstName.trim()) errors.firstName = 'First name is required';
    if (!formData.lastName.trim()) errors.lastName = 'Last name is required';
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format';
    }
    if (!formData.password.trim()) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitUser = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    const success = await addUser({
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim().toLowerCase(),
      password: formData.password,
    });

    if (success) handleCloseAddModal();
    setSubmitting(false);
  };

  const handleDeleteClick = (user) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!selectedUser) return;
    setSubmitting(true);
    await removeUser(selectedUser);
    setShowDeleteModal(false);
    setSelectedUser(null);
    setSubmitting(false);
  };

  /**
   * Helper Renders (Pure UI)
   */
  const renderRoleBadge = (role) => {
    const roleUpper = role?.toUpperCase();
    if (roleUpper === 'SUPERADMIN') return <Badge bg="danger">Superadmin</Badge>;
    if (roleUpper === 'ADMIN') return <Badge bg="warning" text="dark">Admin</Badge>;
    return <Badge bg="secondary">User</Badge>;
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  };

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Team Management</h2>
        <Button variant="primary" onClick={handleAddUserClick} disabled={loading}>
          + Add User
        </Button>
      </div>

      {success && <Alert variant="success" dismissible onClose={clearMessages}>{success}</Alert>}
      {error && <Alert variant="danger" dismissible onClose={clearMessages}>{error}</Alert>}

      <Card>
        <Card.Header>Organization Members</Card.Header>
        <Card.Body>
          {loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" role="status" className="me-2" />
              <span>Loading users...</span>
            </div>
          ) : users.length === 0 ? (
            <Alert variant="info" className="mb-0">
              No users found in your organization. Click "Add User" to invite team members.
            </Alert>
          ) : (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.firstName} {user.lastName}</td>
                    <td>{user.email}</td>
                    <td>{renderRoleBadge(user.role)}</td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => handleDeleteClick(user)}
                        disabled={submitting}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* Add User Modal */}
      <Modal show={showAddModal} onHide={handleCloseAddModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Add New User</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmitUser}>
          <Modal.Body>
            <Form.Group className="mb-3" controlId="firstName">
              <Form.Label>First Name</Form.Label>
              <Form.Control
                type="text"
                name="firstName"
                placeholder="Enter first name"
                value={formData.firstName}
                onChange={handleInputChange}
                isInvalid={!!formErrors.firstName}
                disabled={submitting}
                required
              />
              <Form.Control.Feedback type="invalid">{formErrors.firstName}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3" controlId="lastName">
              <Form.Label>Last Name</Form.Label>
              <Form.Control
                type="text"
                name="lastName"
                placeholder="Enter last name"
                value={formData.lastName}
                onChange={handleInputChange}
                isInvalid={!!formErrors.lastName}
                disabled={submitting}
                required
              />
              <Form.Control.Feedback type="invalid">{formErrors.lastName}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3" controlId="email">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                name="email"
                placeholder="user@example.com"
                value={formData.email}
                onChange={handleInputChange}
                isInvalid={!!formErrors.email}
                disabled={submitting}
                required
              />
              <Form.Control.Feedback type="invalid">{formErrors.email}</Form.Control.Feedback>
            </Form.Group>

            <Form.Group className="mb-3" controlId="password">
              <Form.Label>Password</Form.Label>
              <InputGroup>
                <Form.Control
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="Minimum 8 characters"
                  value={formData.password}
                  onChange={handleInputChange}
                  isInvalid={!!formErrors.password}
                  disabled={submitting}
                  required
                />
                <Button variant="outline-secondary" onClick={() => setShowPassword(!showPassword)} type="button">
                  {showPassword ? <EyeSlash /> : <Eye />}
                </Button>
              </InputGroup>
              <Form.Control.Feedback type="invalid" style={{ display: formErrors.password ? 'block' : 'none' }}>
                {formErrors.password}
              </Form.Control.Feedback>
              <Form.Text className="text-muted">Password must be at least 8 characters long.</Form.Text>
            </Form.Group>

            <Alert variant="info" className="mb-0">
              <small><strong>Note:</strong> New users will be created with standard user permissions.</small>
            </Alert>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseAddModal} disabled={submitting}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? <><Spinner animation="border" size="sm" className="me-2" />Saving...</> : 'Save User'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Deletion</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedUser && (
            <>
              <p>Are you sure you want to delete the following user?</p>
              <Alert variant="warning" className="mb-0">
                <strong>{selectedUser.firstName} {selectedUser.lastName}</strong><br />
                {selectedUser.email}<br />
                <small className="text-muted">This action cannot be undone.</small>
              </Alert>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)} disabled={submitting}>Cancel</Button>
          <Button variant="danger" onClick={handleConfirmDelete} disabled={submitting}>
            {submitting ? <><Spinner animation="border" size="sm" className="me-2" />Deleting...</> : 'Delete User'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default UsersPage;