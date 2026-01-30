import { useEffect, useState } from 'react';
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
import { getUsers, createUser, deleteUser } from '../services/api';

const UsersPage = () => {
  // State management
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form state - role removed, backend enforces 'user'
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Fetch users on component mount
  useEffect(() => {
    fetchUsers();
  }, []);

  // Auto-dismiss success messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  /**
   * Fetch all users from API
   */
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getUsers();
      setUsers(response.data || []);
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to load users';
      
      // Handle 403 Forbidden (not an admin)
      if (err.response?.status === 403) {
        setError('Access denied: This page is for administrators only.');
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Open Add User modal
   */
  const handleAddUserClick = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    });
    setFormErrors({});
    setShowAddModal(true);
  };

  /**
   * Close Add User modal
   */
  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    });
    setFormErrors({});
    setShowPassword(false);
  };

  /**
   * Handle form input changes
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    
    // Clear error for this field when user starts typing
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  /**
   * Validate form data
   */
  const validateForm = () => {
    const errors = {};

    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
    }

    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }

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

  /**
   * Submit new user form
   * Note: Backend will automatically set role to 'user' - no need to send it
   */
  const handleSubmitUser = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Backend will force role='user' - don't send role field
      await createUser({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        // role field removed - backend enforces 'user' role
      });

      setSuccess('User created successfully!');
      handleCloseAddModal();
      
      // Refresh user list
      await fetchUsers();
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to create user';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Open Delete confirmation modal
   */
  const handleDeleteClick = (user) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  /**
   * Close Delete modal
   */
  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedUser(null);
  };

  /**
   * Confirm and execute user deletion
   */
  const handleConfirmDelete = async () => {
    if (!selectedUser) return;

    setSubmitting(true);
    setError(null);

    try {
      await deleteUser(selectedUser.id);
      setSuccess(`User ${selectedUser.email} deleted successfully!`);
      handleCloseDeleteModal();
      
      // Refresh user list
      await fetchUsers();
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message || 'Failed to delete user';
      
      // Display specific error messages
      if (err.response?.status === 400 && errorMessage.includes('own account')) {
        setError('You cannot delete your own account.');
      } else if (err.response?.status === 403) {
        setError('Access denied: You do not have permission to delete this user.');
      } else if (err.response?.status === 404) {
        setError('User not found.');
      } else {
        setError(errorMessage);
      }
      
      handleCloseDeleteModal();
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Render role badge with appropriate styling
   */
  const renderRoleBadge = (role) => {
    const roleUpper = role?.toUpperCase();
    
    if (roleUpper === 'SUPERADMIN') {
      return <Badge bg="danger">Superadmin</Badge>;
    }
    if (roleUpper === 'ADMIN') {
      return <Badge bg="warning" text="dark">Admin</Badge>;
    }
    return <Badge bg="secondary">User</Badge>;
  };

  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
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

      {/* Success message */}
      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {/* Error message */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Users table */}
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
                    <td>
                      {user.firstName} {user.lastName}
                    </td>
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
              <Form.Control.Feedback type="invalid">
                {formErrors.firstName}
              </Form.Control.Feedback>
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
              <Form.Control.Feedback type="invalid">
                {formErrors.lastName}
              </Form.Control.Feedback>
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
              <Form.Control.Feedback type="invalid">
                {formErrors.email}
              </Form.Control.Feedback>
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
                <Button
                  variant="outline-secondary"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={submitting}
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

            {/* ROLE FIELD REMOVED - Backend automatically sets role to 'user' */}
            <Alert variant="info" className="mb-0">
              <small>
                <strong>Note:</strong> New users will be created with standard user permissions.
              </small>
            </Alert>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseAddModal} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Saving...
                </>
              ) : (
                'Save User'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={handleCloseDeleteModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Deletion</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {selectedUser && (
            <>
              <p>Are you sure you want to delete the following user?</p>
              <Alert variant="warning" className="mb-0">
                <strong>
                  {selectedUser.firstName} {selectedUser.lastName}
                </strong>
                <br />
                {selectedUser.email}
                <br />
                <small className="text-muted">This action cannot be undone.</small>
              </Alert>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseDeleteModal} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmDelete} disabled={submitting}>
            {submitting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Deleting...
              </>
            ) : (
              'Delete User'
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default UsersPage;
