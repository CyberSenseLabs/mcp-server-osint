import type { Entity, Location, PersonSearchInput } from '../types/schemas.js';

/**
 * Person resolution and entity correlation logic
 */
export class PersonResolver {
  /**
   * Resolve and deduplicate entities from multiple sources
   */
  resolveEntities(
    rawEntities: Entity[],
    query: PersonSearchInput
  ): Entity[] {
    // Group entities by potential matches
    const clusters = this.clusterEntities(rawEntities, query);
    
    // Merge clusters into resolved entities
    const resolved = clusters.map(cluster => this.mergeCluster(cluster, query));
    
    // Sort by confidence and apply threshold
    return resolved
      .filter(e => e.confidence >= (query.confidence_threshold ?? 0.3))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, query.max_results ?? 50);
  }

  /**
   * Cluster entities that likely refer to the same person
   */
  private clusterEntities(
    entities: Entity[],
    query: PersonSearchInput
  ): Entity[][] {
    if (entities.length === 0) return [];
    
    const clusters: Entity[][] = [];
    const processed = new Set<number>();
    
    for (let i = 0; i < entities.length; i++) {
      if (processed.has(i)) continue;
      
      const cluster = [entities[i]];
      processed.add(i);
      
      // Find similar entities
      for (let j = i + 1; j < entities.length; j++) {
        if (processed.has(j)) continue;
        
        const similarity = this.calculateSimilarity(
          entities[i],
          entities[j],
          query
        );
        
        if (similarity > 0.6) {
          cluster.push(entities[j]);
          processed.add(j);
        }
      }
      
      clusters.push(cluster);
    }
    
    return clusters;
  }

  /**
   * Calculate similarity between two entities
   */
  private calculateSimilarity(
    e1: Entity,
    e2: Entity,
    _query: PersonSearchInput
  ): number {
    let score = 0;
    let weight = 0;

    // Name similarity (weight: 0.4)
    const nameSim = this.nameSimilarity(e1.name, e2.name);
    score += nameSim * 0.4;
    weight += 0.4;

    // Location similarity (weight: 0.3)
    // Always compare entity locations regardless of query location
    const locSim = this.locationSimilarity(e1.locations, e2.locations);
    score += locSim * 0.3;
    weight += 0.3;

    // Profile overlap (weight: 0.2)
    const profileSim = this.profileSimilarity(e1.profiles, e2.profiles);
    score += profileSim * 0.2;
    weight += 0.2;

    // Source credibility (weight: 0.1)
    const sourceSim = this.sourceSimilarity(e1.sources, e2.sources);
    score += sourceSim * 0.1;
    weight += 0.1;

    return weight > 0 ? score / weight : 0;
  }

  /**
   * Fuzzy name matching using Levenshtein-like similarity
   */
  private nameSimilarity(name1: string, name2: string): number {
    const n1 = name1.toLowerCase().trim();
    const n2 = name2.toLowerCase().trim();
    
    if (n1 === n2) return 1.0;
    
    // Exact substring match
    if (n1.includes(n2) || n2.includes(n1)) return 0.8;
    
    // Token-based matching
    const tokens1 = n1.split(/\s+/);
    const tokens2 = n2.split(/\s+/);
    
    const commonTokens = tokens1.filter(t => tokens2.includes(t));
    const totalTokens = Math.max(tokens1.length, tokens2.length);
    
    if (totalTokens === 0) return 0;
    
    return commonTokens.length / totalTokens;
  }

  /**
   * Location similarity based on geographic proximity
   */
  private locationSimilarity(
    locs1: Location[],
    locs2: Location[]
  ): number {
    if (locs1.length === 0 || locs2.length === 0) return 0.5; // Unknown location
    
    let maxSim = 0;
    
    for (const loc1 of locs1) {
      for (const loc2 of locs2) {
        let sim = 0;

        if (loc1.country && loc2.country) {
          if (loc1.country.toLowerCase() === loc2.country.toLowerCase()) {
            sim += 0.5;
          }
        }

        if (loc1.state && loc2.state) {
          if (loc1.state.toLowerCase() === loc2.state.toLowerCase()) {
            sim += 0.3;
          }
        }

        if (loc1.city && loc2.city) {
          const citySim = this.nameSimilarity(loc1.city, loc2.city);
          sim += citySim * 0.2;
        }

        maxSim = Math.max(maxSim, sim);
      }
    }
    
    return maxSim;
  }

  /**
   * Profile similarity based on platform and username overlap
   */
  private profileSimilarity(
    profiles1: Entity['profiles'],
    profiles2: Entity['profiles']
  ): number {
    if (profiles1.length === 0 || profiles2.length === 0) return 0;
    
    const platforms1 = new Set(profiles1.map(p => p.platform));
    const platforms2 = new Set(profiles2.map(p => p.platform));
    
    const commonPlatforms = [...platforms1].filter(p => platforms2.has(p));
    const totalPlatforms = new Set([...platforms1, ...platforms2]).size;
    
    if (totalPlatforms === 0) return 0;
    
    return commonPlatforms.length / totalPlatforms;
  }

  /**
   * Source credibility similarity
   */
  private sourceSimilarity(
    sources1: Entity['sources'],
    sources2: Entity['sources']
  ): number {
    const sourceTypes1 = new Set(sources1.map(s => s.type));
    const sourceTypes2 = new Set(sources2.map(s => s.type));
    
    const common = [...sourceTypes1].filter(t => sourceTypes2.has(t)).length;
    const total = new Set([...sourceTypes1, ...sourceTypes2]).size;
    
    return total > 0 ? common / total : 0;
  }

  /**
   * Merge a cluster of entities into a single resolved entity
   */
  private mergeCluster(
    cluster: Entity[],
    query: PersonSearchInput
  ): Entity {
    if (cluster.length === 1) return cluster[0];
    
    // Use most confident name
    const primaryEntity = cluster.reduce((a, b) =>
      a.confidence > b.confidence ? a : b
    );
    
    // Aggregate all locations
    const allLocations = cluster.flatMap(e => e.locations);
    const uniqueLocations = this.deduplicateLocations(allLocations);
    
    // Aggregate all profiles
    const allProfiles = cluster.flatMap(e => e.profiles);
    const uniqueProfiles = this.deduplicateProfiles(allProfiles);
    
    // Aggregate all sources
    const allSources = cluster.flatMap(e => e.sources);
    const uniqueSources = this.deduplicateSources(allSources);
    
    // Calculate merged confidence
    const avgConfidence = cluster.reduce((sum, e) => sum + e.confidence, 0) / cluster.length;
    const mergedConfidence = Math.min(1.0, avgConfidence * (1 + 0.1 * (cluster.length - 1)));
    
    // Build correlation explanation
    const correlationExplanation = this.buildCorrelationExplanation(
      cluster,
      query
    );
    
    // Separate facts from inferences
    const { facts, inferences } = this.extractFactsAndInferences(cluster);
    
    return {
      name: primaryEntity.name,
      confidence: mergedConfidence,
      locations: uniqueLocations,
      profiles: uniqueProfiles,
      sources: uniqueSources,
      notes: `Merged from ${cluster.length} potential matches`,
      correlation_explanation: correlationExplanation,
      facts,
      inferences,
    };
  }

  private deduplicateLocations(locations: Location[]): Location[] {
    const seen = new Set<string>();
    return locations.filter(loc => {
      const key = `${loc.country || ''}|${loc.state || ''}|${loc.city || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private deduplicateProfiles(profiles: Entity['profiles']): Entity['profiles'] {
    const seen = new Set<string>();
    return profiles.filter(profile => {
      const key = `${profile.platform}|${profile.url}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private deduplicateSources(sources: Entity['sources']): Entity['sources'] {
    const seen = new Set<string>();
    return sources.filter(source => {
      const key = `${source.name}|${source.url || ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private buildCorrelationExplanation(
    cluster: Entity[],
    _query: PersonSearchInput
  ): string {
    const factors: string[] = [];
    
    if (cluster.length > 1) {
      factors.push(`Found ${cluster.length} potential matches`);
    }
    
    const nameMatches = new Set(cluster.map(e => e.name));
    if (nameMatches.size < cluster.length) {
      factors.push('Name variations detected');
    }
    
    const locationCount = cluster.reduce((sum, e) => sum + e.locations.length, 0);
    if (locationCount > 0) {
      factors.push(`Location data from ${locationCount} sources`);
    }
    
    const profileCount = cluster.reduce((sum, e) => sum + e.profiles.length, 0);
    if (profileCount > 0) {
      factors.push(`${profileCount} social/professional profiles`);
    }
    
    return factors.join('; ');
  }

  private extractFactsAndInferences(cluster: Entity[]): {
    facts: string[];
    inferences: string[];
  } {
    const facts: string[] = [];
    const inferences: string[] = [];
    
    for (const entity of cluster) {
      // Profiles are facts (publicly accessible)
      for (const profile of entity.profiles) {
        facts.push(`Profile exists on ${profile.platform}: ${profile.url}`);
      }
      
      // Locations from multiple sources are facts
      if (entity.locations.length > 0) {
        const locStr = entity.locations
          .map(l => [l.city, l.state, l.country].filter(Boolean).join(', '))
          .join('; ');
        if (locStr) facts.push(`Associated with location: ${locStr}`);
      }
      
      // High confidence correlations are facts
      if (entity.confidence > 0.8) {
        facts.push(`High confidence match (${(entity.confidence * 100).toFixed(0)}%)`);
      } else {
        inferences.push(`Moderate confidence match (${(entity.confidence * 100).toFixed(0)}%) - requires verification`);
      }
    }
    
    return { facts, inferences };
  }
}

