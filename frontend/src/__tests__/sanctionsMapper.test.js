import { describe, it, expect } from 'vitest';
import { getLatinName, normalizeEntity, normalizeApiResponse } from '../utils/sanctionsMapper';
import { MATCH_STATUS } from '../constants/sanctions';

describe('sanctionsMapper', () => {

  describe('getLatinName', () => {
    it('returns Latin name from properties.name array', () => {
      const hit = { properties: { name: ['Владимир Путин', 'Vladimir Putin'] } };
      expect(getLatinName(hit)).toBe('Vladimir Putin');
    });

    it('returns first name if no Latin name found', () => {
      const hit = { properties: { name: ['Владимир Путин'] } };
      expect(getLatinName(hit)).toBe('Владимир Путин');
    });

    it('falls back to hit.name', () => {
      const hit = { name: 'Test Entity' };
      expect(getLatinName(hit)).toBe('Test Entity');
    });

    it('falls back to hit.caption', () => {
      const hit = { caption: 'Some Caption' };
      expect(getLatinName(hit)).toBe('Some Caption');
    });

    it('returns "Unknown Entity" for null/empty', () => {
      expect(getLatinName(null)).toBe('Unknown Entity');
      expect(getLatinName({})).toBe('Unknown Entity');
    });
  });

  describe('normalizeEntity', () => {
    it('maps a full API hit to domain object', () => {
      const hit = {
        id: 'abc-123',
        properties: {
          name: ['Vladimir Putin'],
          topics: ['sanction', 'role.pep'],
        },
        score: 0.95,
        country: ['RU'],
        schema: 'Person',
      };

      const result = normalizeEntity(hit);

      expect(result).toEqual({
        id: 'abc-123',
        name: 'Vladimir Putin',
        isSanctioned: true,
        isPep: true,
        score: 0.95,
        countries: ['RU'],
        raw: hit,
      });
    });

    it('handles entity with no topics', () => {
      const hit = { id: '1', properties: { name: ['Test'] }, score: 0.5, country: [] };
      const result = normalizeEntity(hit);

      expect(result.isSanctioned).toBe(false);
      expect(result.isPep).toBe(false);
    });

    it('handles missing country as empty array', () => {
      const hit = { id: '1', properties: { name: ['Test'] }, score: 0.5 };
      expect(normalizeEntity(hit).countries).toEqual([]);
    });

    it('handles non-numeric score as null', () => {
      const hit = { id: '1', properties: { name: ['Test'] }, score: 'N/A' };
      expect(normalizeEntity(hit).score).toBeNull();
    });
  });

  describe('normalizeApiResponse', () => {
    it('normalizes response with result=CLEAN', () => {
      const apiResult = { result: 'CLEAN', data: [] };
      const result = normalizeApiResponse(apiResult);

      expect(result.matchStatus).toBe(MATCH_STATUS.CLEAN);
      expect(result.entities).toEqual([]);
    });

    it('normalizes response with result=HIT and data array', () => {
      const apiResult = {
        result: 'HIT',
        data: [
          { id: '1', properties: { name: ['Test'], topics: ['sanction'] }, score: 1, country: ['US'] },
        ],
      };
      const result = normalizeApiResponse(apiResult);

      expect(result.matchStatus).toBe(MATCH_STATUS.HIT);
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].isSanctioned).toBe(true);
    });

    it('infers HIT when no result field but data is present', () => {
      const apiResult = { data: [{ id: '1', properties: { name: ['X'] }, score: 0.5 }] };
      const result = normalizeApiResponse(apiResult);

      expect(result.matchStatus).toBe(MATCH_STATUS.HIT);
    });

    it('infers CLEAN when no result field and no data', () => {
      const apiResult = {};
      const result = normalizeApiResponse(apiResult);

      expect(result.matchStatus).toBe(MATCH_STATUS.CLEAN);
      expect(result.entities).toEqual([]);
    });

    it('handles "results" key (alternative API shape)', () => {
      const apiResult = { results: [{ id: '1', properties: { name: ['Y'] }, score: 0.8, country: ['DE'] }] };
      const result = normalizeApiResponse(apiResult);

      expect(result.entities).toHaveLength(1);
    });
  });
});
