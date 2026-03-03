/**
 * Mock responses for the /sanctions/check endpoint (used with page.route).
 * Format matches the SanctionEntity.toJSON() -> SanctionsCheckResponseDto.toJSON()
 * pipeline from op-adapter -> core-service -> gateway -> browser.
 *
 * Key fields read by the frontend's sanctionsMapper:
 *   - hit.properties?.topics  -> isSanctioned / isPep detection
 *   - hit.properties?.name    -> display name
 *   - hit.country             -> countries list (top-level, not properties.country)
 *   - hit.score               -> match score
 */

export const MOCK_HIT_RESPONSE = {
  hits_count: 1,
  data: [
    {
      id: 'mock-entity-sanction-001',
      caption: 'Vladimir Putin',
      name: 'Vladimir Putin',
      schema: 'Person',
      score: 0.99,
      isSanctioned: true,
      isPep: false,
      birthDate: '1952-10-07',
      country: ['ru'],
      datasets: ['us_ofac_sdn'],
      properties: {
        name: ['Vladimir Vladimirovich Putin'],
        topics: ['sanction'],
        birthDate: ['1952-10-07'],
        nationality: ['ru'],
      },
    },
  ],
  meta: { source: 'OpenSanctions (Mock)' },
};

export const MOCK_CLEAN_RESPONSE = {
  hits_count: 0,
  data: [],
  meta: { source: 'OpenSanctions (Mock)' },
};

export const MOCK_PEP_RESPONSE = {
  hits_count: 1,
  data: [
    {
      id: 'mock-entity-pep-001',
      caption: 'Test PEP Person',
      name: 'Test PEP Person',
      schema: 'Person',
      score: 0.85,
      isSanctioned: false,
      isPep: true,
      birthDate: null,
      country: ['de'],
      datasets: ['eu_meps'],
      properties: {
        name: ['Test PEP Person'],
        topics: ['role.pep'],
        position: ['Member of Parliament'],
      },
    },
  ],
  meta: { source: 'OpenSanctions (Mock)' },
};
