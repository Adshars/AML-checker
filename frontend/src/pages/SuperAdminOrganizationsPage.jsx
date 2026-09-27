import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Card, Table, Form, Button, Pagination, Spinner, InputGroup } from 'react-bootstrap';
import { IconSearch, IconBuildingPlus } from '@tabler/icons-react';
import { toast } from 'react-toastify';
import { listOrganizations } from '../services/organizationService';
import { getPageNumbers } from '../utils/pagination';
import ServiceBadges from '../components/ServiceBadges';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const formatLocation = (org) => [org.city, org.country].filter(Boolean).join(', ') || '—';

const SuperAdminOrganizationsPage = () => {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [organizations, setOrganizations] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  // Debounce search input; a new search always starts from the first page
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    // Ignore responses of superseded requests (fast typing / paging)
    let ignore = false;

    const fetchOrganizations = async () => {
      setLoading(true);
      try {
        const data = await listOrganizations({ search, page, limit: PAGE_SIZE });
        if (ignore) return;
        setOrganizations(data?.data || []);
        setMeta({
          page: data?.meta?.page || page,
          totalPages: data?.meta?.totalPages || 1,
          total: data?.meta?.total ?? 0,
        });
      } catch (err) {
        if (ignore) return;
        setOrganizations([]);
        toast.error(err?.response?.data?.error || err.message || 'Failed to load organizations');
      } finally {
        if (!ignore) setLoading(false);
      }
    };

    fetchOrganizations();
    return () => {
      ignore = true;
    };
  }, [search, page]);

  const openDetails = (id) => navigate(`/superadmin/organizations/${id}`);

  const totalPages = Math.max(meta.totalPages || 1, 1);

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between align-items-center mb-3 gap-2 flex-wrap">
        <h2 className="mb-0">Organizations</h2>
        <Button
          variant="primary"
          onClick={() => navigate('/superadmin/organizations/new')}
          data-testid="new-organization-btn"
        >
          <IconBuildingPlus size={18} stroke={1.75} className="me-2" />
          New organization
        </Button>
      </div>

      <Card>
        <Card.Body>
          <InputGroup className="mb-3" style={{ maxWidth: '400px' }}>
            <InputGroup.Text>
              <IconSearch size={16} stroke={1.75} />
            </InputGroup.Text>
            <Form.Control
              type="search"
              placeholder="Search by name"
              aria-label="Search organizations"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              data-testid="organizations-search"
            />
          </InputGroup>

          {loading ? (
            <div className="d-flex align-items-center justify-content-center py-4">
              <Spinner animation="border" role="status" className="me-2" />
              <span>Loading organizations…</span>
            </div>
          ) : (
            <>
              <Table hover responsive className="mb-3" data-testid="organizations-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Location</th>
                    <th>Services</th>
                    <th>Users</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted" data-testid="organizations-empty">
                        {search ? 'No organizations match your search.' : 'No organizations yet.'}
                      </td>
                    </tr>
                  )}

                  {organizations.map((org) => (
                    <tr
                      key={org.id}
                      role="button"
                      tabIndex={0}
                      style={{ cursor: 'pointer' }}
                      onClick={() => openDetails(org.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') openDetails(org.id);
                      }}
                      data-testid="organization-row"
                    >
                      <td className="fw-semibold">{org.name}</td>
                      <td>{formatLocation(org)}</td>
                      <td><ServiceBadges services={org.services} /></td>
                      <td>{org.userCount ?? 0}</td>
                      <td>{org.createdAt ? new Date(org.createdAt).toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div className="text-muted" data-testid="pagination-info">
                  Page {meta.page} of {totalPages} · {meta.total} organizations
                </div>
                <Pagination className="mb-0">
                  <Pagination.Prev disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} data-testid="pagination-prev" />
                  {getPageNumbers(page, totalPages).map((item, idx) =>
                    item === 'ellipsis' ? (
                      <Pagination.Ellipsis key={`ellipsis-${idx}`} disabled />
                    ) : (
                      <Pagination.Item
                        key={item}
                        active={item === page}
                        aria-current={item === page ? 'page' : undefined}
                        onClick={() => setPage(item)}
                        data-testid={`pagination-page-${item}`}
                      >
                        {item}
                      </Pagination.Item>
                    )
                  )}
                  <Pagination.Next disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} data-testid="pagination-next" />
                </Pagination>
              </div>
            </>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default SuperAdminOrganizationsPage;
