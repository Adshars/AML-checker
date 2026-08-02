import React from 'react';
import { Table } from 'react-bootstrap';
import { formatKey, getExtendedDetailsEntries } from '../utils/extendedDetailsMapper';

const ExtendedDetails = ({ data }) => {
  if (!data || Object.keys(data).length === 0) return <p className="text-muted mt-2">No additional details available.</p>;

  const entries = getExtendedDetailsEntries(data);

  if (entries.length === 0) return null;

  return (
    <div className="mt-4">
      <h6 className="mb-3 border-bottom pb-2">Extended Details</h6>
      <Table hover size="sm" responsive>
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
