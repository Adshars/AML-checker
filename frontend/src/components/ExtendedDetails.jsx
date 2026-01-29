import React from 'react';
import { Table } from 'react-bootstrap';

// Technical keys to hide
const IGNORED_KEYS = [
  'addressEntity', 'sourceUrl', 'programId', 'topics', 
  'entityId', 'schema', 'type', 'last_change', 'first_seen', 
  'datasets', 'id', 'caption', 'name' // Name and caption displayed in header, not needed here
];

const formatKey = (key) => {
  // CamelCase -> Title Case (e.g. birthPlace -> Birth Place)
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase());
};

const ExtendedDetails = ({ data }) => {
  if (!data || Object.keys(data).length === 0) return <p className="text-muted mt-2">No additional details available.</p>;

  // Filter out ignored keys and empty arrays
  const entries = Object.entries(data).filter(([key, value]) => {
    if (IGNORED_KEYS.includes(key)) return false;
    if (Array.isArray(value) && value.length === 0) return false; // Empty arrays
    return true;
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
                      <li key={idx} className="mb-1">{item}</li>
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
