import { useEffect, useState } from 'react';
import { Card, Row, Col, Table, Alert, Container } from 'react-bootstrap';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getDashboardStats } from '../services/api';

const DashboardPage = () => {
  const [stats, setStats] = useState({ totalChecks: 0, sanctionHits: 0, pepHits: 0, recentLogs: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getDashboardStats();
        setStats(data);
      } catch (err) {
        console.error('Failed to load stats', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <Container>
        <div className="text-center mt-5">Loading dashboard...</div>
      </Container>
    );
  }

  // Grupowanie po dacie dla wykresu
  const chartData = stats.recentLogs.reduce((acc, log) => {
    const date = new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const existing = acc.find((d) => d.date === date);
    if (existing) {
      existing.checks += 1;
    } else {
      acc.push({ date, checks: 1 });
    }
    return acc;
  }, []).reverse();

  const recentActivity = stats.recentLogs.slice(0, 5);

  return (
    <Container>
      <h2 className="mb-4">Dashboard</h2>

      {/* Statystyki - karty */}
      <Row className="mb-4">
        <Col md={4} className="mb-3">
          <Card bg="primary" text="white">
            <Card.Body>
              <Card.Title>Total Checks</Card.Title>
              <h1 className="display-4">{stats.totalChecks}</h1>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4} className="mb-3">
          <Card bg="danger" text="white">
            <Card.Body>
              <Card.Title>Sanction Hits</Card.Title>
              <h1 className="display-4">{stats.sanctionHits}</h1>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4} className="mb-3">
          <Card bg="warning" text="dark">
            <Card.Body>
              <Card.Title>PEP Hits</Card.Title>
              <h1 className="display-4">{stats.pepHits}</h1>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Wykres aktywności */}
      {chartData.length > 0 ? (
        <Card className="mb-4">
          <Card.Body>
            <Card.Title>Activity Chart</Card.Title>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="checks" stroke="#0d6efd" fill="#0d6efd" />
              </AreaChart>
            </ResponsiveContainer>
          </Card.Body>
        </Card>
      ) : (
        <Alert variant="info" className="mb-4">
          No activity data available yet.
        </Alert>
      )}

      {/* Ostatnia aktywność */}
      <Card>
        <Card.Body>
          <Card.Title>Recent Activity</Card.Title>
          {recentActivity.length > 0 ? (
            <Table striped bordered hover responsive>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Date</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((log) => (
                  <tr key={log.id}>
                    <td>{log.searchQuery}</td>
                    <td>{new Date(log.createdAt).toLocaleString()}</td>
                    <td>
                      {log.isSanctioned && <span className="badge bg-danger me-1">Sanction</span>}
                      {log.isPep && <span className="badge bg-warning text-dark">PEP</span>}
                      {!log.isSanctioned && !log.isPep && <span className="badge bg-success">Clear</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Alert variant="secondary">No recent activity.</Alert>
          )}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default DashboardPage;
