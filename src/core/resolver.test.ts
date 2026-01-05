import { describe, it, expect } from 'vitest';
import { PersonResolver } from './resolver.js';
import type { Entity, PersonSearchInput } from '../types/schemas.js';

describe('PersonResolver', () => {
  const resolver = new PersonResolver();

  it('should resolve and deduplicate entities', () => {
    const entities: Entity[] = [
      {
        name: 'John Doe',
        confidence: 0.8,
        locations: [{ city: 'New York', country: 'US' }],
        profiles: [],
        sources: [{ name: 'Source1', type: 'social_network', accessed_at: new Date().toISOString(), confidence: 0.8 }],
      },
      {
        name: 'John Doe',
        confidence: 0.7,
        locations: [{ city: 'New York', state: 'NY', country: 'US' }],
        profiles: [],
        sources: [{ name: 'Source2', type: 'search_engine', accessed_at: new Date().toISOString(), confidence: 0.7 }],
      },
    ];

    const query: PersonSearchInput = {
      full_name: 'John Doe',
      confidence_threshold: 0.3,
      max_results: 10,
    };

    const resolved = resolver.resolveEntities(entities, query);

    expect(resolved.length).toBe(1);
    expect(resolved[0].sources.length).toBe(2); // Merged sources
    expect(resolved[0].confidence).toBeGreaterThan(0.7);
  });

  it('should filter by confidence threshold', () => {
    const entities: Entity[] = [
      {
        name: 'John Doe',
        confidence: 0.9,
        locations: [],
        profiles: [],
        sources: [{ name: 'Source1', type: 'social_network', accessed_at: new Date().toISOString(), confidence: 0.9 }],
      },
      {
        name: 'Jane Doe',
        confidence: 0.2, // Below threshold
        locations: [],
        profiles: [],
        sources: [{ name: 'Source2', type: 'search_engine', accessed_at: new Date().toISOString(), confidence: 0.2 }],
      },
    ];

    const query: PersonSearchInput = {
      full_name: 'John Doe',
      confidence_threshold: 0.5,
      max_results: 10,
    };

    const resolved = resolver.resolveEntities(entities, query);

    expect(resolved.length).toBe(1);
    expect(resolved[0].name).toBe('John Doe');
  });

  it('should respect max_results limit', () => {
    const entities: Entity[] = Array.from({ length: 20 }, (_, i) => ({
      name: `Person ${i}`,
      confidence: 0.8,
      locations: [],
      profiles: [],
      sources: [{ name: 'Source1', type: 'search_engine', accessed_at: new Date().toISOString(), confidence: 0.8 }],
    }));

    const query: PersonSearchInput = {
      full_name: 'Person',
      confidence_threshold: 0.3,
      max_results: 5,
    };

    const resolved = resolver.resolveEntities(entities, query);

    expect(resolved.length).toBe(5);
  });
});

