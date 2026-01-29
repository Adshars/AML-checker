import React from 'react';
import { Table } from 'react-bootstrap';

// Pola techniczne do ukrycia
const IGNORED_KEYS = [
  'addressEntity', 'sourceUrl', 'programId', 'topics', 
  'entityId', 'schema', 'type', 'last_change', 'first_seen', 
  'datasets', 'id', 'caption', 'target' // 'name' zostawiamy, chyba że jest w nagłówku
];

// Definicja kolejności wyświetlania (Logiczny porządek)
const PRIORITY_KEYS = [
  // 1. Tożsamość Podstawowa
  'name',
  'firstName',
  'middleName',
  'lastName',
  'fatherName',
  'motherName',
  'gender',
  'title',
  
  // 2. Urodzenie i Śmierć
  'birthDate',
  'birthPlace',
  'deathDate',
  
  // 3. Status Prawny i Lokalizacja
  'nationality',
  'citizenship',
  'country',
  'jurisdiction',
  
  // 4. Zawód i Funkcja
  'position',
  'education',
  'religion',
  'political',
  'status',
  
  // 5. Dane Kontaktowe i Identyfikatory (Na końcu, bo mogą być długie)
  'address',
  'website',
  'email',
  'phone',
  'taxNumber',
  'passportNumber',
  
  // 6. Inne (Duże listy)
  'alias',
  'weakAlias',
  'notes'
];

const formatKey = (key) => {
  // CamelCase -> Title Case (np. birthPlace -> Birth Place)
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase());
};

const ExtendedDetails = ({ data }) => {
  if (!data || Object.keys(data).length === 0) return <p className="text-muted mt-2">No additional details available.</p>;

  // 1. Filtrowanie i konwersja do tablicy [key, value]
  let entries = Object.entries(data).filter(([key, value]) => {
    if (IGNORED_KEYS.includes(key)) return false;
    if (Array.isArray(value) && value.length === 0) return false;
    // Ukrywamy 'name' jeśli jest identyczne jak to w nagłówku, ale na razie zostawmy dla pewności
    return true;
  });

  // 2. Sortowanie według priorytetów
  entries.sort(([keyA], [keyB]) => {
    const indexA = PRIORITY_KEYS.indexOf(keyA);
    const indexB = PRIORITY_KEYS.indexOf(keyB);

    // Jeśli oba klucze są na liście priorytetów -> sortuj wg kolejności w liście
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    
    // Jeśli tylko A jest na liście -> A idzie wyżej
    if (indexA !== -1) return -1;
    
    // Jeśli tylko B jest na liście -> B idzie wyżej
    if (indexB !== -1) return 1;

    // Jeśli żadnego nie ma na liście -> sortuj alfabetycznie na samym dole
    return keyA.localeCompare(keyB);
  });

  if (entries.length === 0) return null;

  return (
    <div className="mt-4">
      <h6 className="mb-3 border-bottom pb-2">Extended Details</h6>
      <Table striped bordered hover size="sm" responsive>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key}>
              <td className="text-muted" style={{ width: '30%', fontWeight: '500', verticalAlign: 'middle' }}>
                {formatKey(key)}
              </td>
              <td>
                {Array.isArray(value) ? (
                  <ul className="list-unstyled mb-0">
                    {value.map((item, idx) => (
                      <li key={idx} className="mb-1" style={{ wordBreak: 'break-word' }}>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  String(value)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default ExtendedDetails;
