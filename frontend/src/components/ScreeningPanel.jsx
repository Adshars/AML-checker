import { useState } from 'react';
import { Card, Form, Button, Spinner, Alert, ListGroup } from 'react-bootstrap';
import coreService from '../services/coreService';

function ScreeningPanel() {
  const [name, setName] = useState('');
  const [fuzzy, setFuzzy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Pole "name" jest wymagane.');
      return;
    }

    setLoading(true);
    try {
      const result = await coreService.checkEntity({ name: trimmedName, fuzzy, limit: 10 });
      console.log('API RESPONSE STRUCTURE:', result);
      console.log('Pełna odpowiedź JSON:', JSON.stringify(result, null, 2));

      // NORMALIZACJA DANYCH - wyciągnij tablicę trafień z różnych możliwych struktur
      const hits = result?.data || result?.results || result?.hits || [];
      const matchStatus = result?.result || (Array.isArray(hits) && hits.length > 0 ? 'HIT' : 'CLEAN');

      console.log('Znormalizowane dane:', { matchStatus, hits });

      // Przechowaj znormalizowaną strukturę
      setResults({
        result: matchStatus,
        data: Array.isArray(hits) ? hits : [],
      });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || 'Wystąpił błąd podczas sprawdzania.';
      console.error('Błąd API:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const isClean = results?.result === 'CLEAN';
  const isHit = results?.result === 'HIT';
  const hasData = Array.isArray(results?.data) && results.data.length > 0;

  return (
    <Card>
      <Card.Header>Sprawdź podmiot</Card.Header>
      <Card.Body>
        <Form onSubmit={handleSubmit}>
          <Form.Group className="mb-3" controlId="screeningName">
            <Form.Label>Nazwa podmiotu</Form.Label>
            <Form.Control
              type="text"
              placeholder="Wpisz nazwę"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Form.Group>

          <Form.Group className="mb-3" controlId="screeningFuzzy">
            <Form.Check
              type="switch"
              label="Fuzzy (rozmyte dopasowanie)"
              checked={fuzzy}
              onChange={(e) => setFuzzy(e.target.checked)}
            />
          </Form.Group>

          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Sprawdzanie…' : 'Sprawdź'}
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
            <span>Ładowanie…</span>
          </div>
        )}

        {!loading && results && (
          <div className="mt-3">
            {isClean && (
              <Alert variant="success">✓ Brak powiązań sankcyjnych (CLEAN)</Alert>
            )}

            {isHit && (
              <>
                <Alert variant="danger">⚠ Wykryto powiązania sankcyjne (HIT)!</Alert>

                {hasData ? (
                  <ListGroup>
                    {results.data.map((hit, idx) => (
                      <ListGroup.Item key={hit.id || idx}>
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <div className="fw-semibold">{hit.name || 'Nieznana nazwa'}</div>
                            <div className="text-muted">Schemat: {hit.schema || 'N/D'}</div>
                            <div className="text-muted">
                              Kraje: {Array.isArray(hit.countries) ? hit.countries.join(', ') : (hit.countries || 'N/D')}
                            </div>
                          </div>
                          <div className="text-nowrap">Wynik: {typeof hit.score === 'number' ? hit.score.toFixed(2) : (hit.score ?? 'N/D')}</div>
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                ) : (
                  <Alert variant="info">Brak szczegółów dla tego wyniku.</Alert>
                )}
              </>
            )}

            {!isClean && !isHit && (
              <Alert variant="secondary">Brak wyniku lub nieznany status odpowiedzi. Debug: {results?.result}</Alert>
            )}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

export default ScreeningPanel;
