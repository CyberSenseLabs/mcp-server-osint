import { describe, it, expect } from 'vitest';
import { EthicalGuardrails } from './guardrails.js';
import type { PersonSearchInput } from '../types/schemas.js';

describe('EthicalGuardrails', () => {
  const guardrails = new EthicalGuardrails();

  it('should reject queries with blocked terms', () => {
    const query: PersonSearchInput = {
      full_name: 'John Doe SSN 123-45-6789',
      confidence_threshold: 0.5,
    };

    const result = guardrails.validateQuery(query);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should require at least one name', () => {
    const query: PersonSearchInput = {
      confidence_threshold: 0.5,
    };

    const result = guardrails.validateQuery(query);

    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('name'))).toBe(true);
  });

  it('should accept valid queries', () => {
    const query: PersonSearchInput = {
      full_name: 'John Doe',
      confidence_threshold: 0.5,
    };

    const result = guardrails.validateQuery(query);

    expect(result.valid).toBe(true);
  });

  it('should sanitize sensitive data from results', () => {
    const entities = [
      {
        name: 'John Doe',
        confidence: 0.8,
        locations: [],
        profiles: [],
        sources: [],
        notes: 'SSN: 123-45-6789',
      },
    ];

    const sanitized = guardrails.sanitizeResults(entities);

    expect(sanitized[0].notes).not.toContain('123-45-6789');
    expect(sanitized[0].notes).toContain('[REDACTED]');
  });

  it('should check jurisdiction restrictions', () => {
    const result = guardrails.checkJurisdiction({ country: 'DE' });

    expect(result.allowed).toBe(true);
    expect(result.restrictions.length).toBeGreaterThan(0);
  });
});

