import type { PersonSearchInput, Entity } from '../types/schemas.js';

/**
 * Ethical guardrails and compliance controls
 */
export class EthicalGuardrails {
  private readonly blockedTerms: Set<string>;
  private readonly rateLimits: Map<string, number[]>;
  private readonly maxQueriesPerHour: number = 100;
  
  constructor() {
    // Terms that should not be searched (privacy-sensitive)
    this.blockedTerms = new Set([
      'ssn', 'social security', 'tax file number', 'tfn',
      'credit card', 'bank account', 'passport number',
    ]);
    
    this.rateLimits = new Map();
  }

  /**
   * Validate a search query for ethical compliance
   */
  validateQuery(query: PersonSearchInput): {
    valid: boolean;
    warnings: string[];
    errors: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];
    
    // Check for blocked terms
    const searchText = [
      query.full_name,
      ...(query.aliases || []),
    ].filter(Boolean).join(' ').toLowerCase();
    
    for (const term of this.blockedTerms) {
      if (searchText.includes(term)) {
        errors.push(`Query contains blocked term: ${term}`);
      }
    }
    
    // Validate name requirements
    if (!query.full_name && (!query.aliases || query.aliases.length === 0)) {
      errors.push('At least one name (full_name or aliases) must be provided');
    }
    
    // Check rate limiting
    const clientId = 'default'; // In production, extract from request context
    if (!this.checkRateLimit(clientId)) {
      errors.push('Rate limit exceeded. Please wait before making another query.');
    }
    
    // Warnings for potentially sensitive queries
    if (query.location?.city && query.location?.state) {
      warnings.push('Specific location queries may return sensitive information. Use responsibly.');
    }
    
    if ((query.confidence_threshold ?? 0.3) < 0.5) {
      warnings.push('Low confidence threshold may return false positives. Verify results carefully.');
    }
    
    return {
      valid: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Filter entities to remove sensitive data
   */
  sanitizeResults(entities: Entity[]): Entity[] {
    return entities.map(entity => {
      // Remove any notes that might contain sensitive data
      const sanitizedNotes = this.sanitizeText(entity.notes || '');
      
      // Filter out profiles that might expose private information
      const sanitizedProfiles = entity.profiles.filter(profile => {
        // Only include public profiles
        return profile.url && !profile.url.includes('private');
      });
      
      return {
        ...entity,
        notes: sanitizedNotes,
        profiles: sanitizedProfiles,
      };
    });
  }

  /**
   * Check if query is within rate limits
   */
  private checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 1 hour
    
    if (!this.rateLimits.has(clientId)) {
      this.rateLimits.set(clientId, []);
    }
    
    const timestamps = this.rateLimits.get(clientId)!;
    
    // Remove timestamps outside the window
    const recentTimestamps = timestamps.filter(ts => now - ts < windowMs);
    
    if (recentTimestamps.length >= this.maxQueriesPerHour) {
      return false;
    }
    
    recentTimestamps.push(now);
    this.rateLimits.set(clientId, recentTimestamps);
    
    return true;
  }

  /**
   * Sanitize text to remove potentially sensitive patterns
   */
  private sanitizeText(text: string): string {
    // Remove patterns that look like SSN, credit cards, etc.
    let sanitized = text;
    
    // SSN pattern (XXX-XX-XXXX)
    sanitized = sanitized.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED]');
    
    // Credit card pattern
    sanitized = sanitized.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[REDACTED]');
    
    return sanitized;
  }

  /**
   * Generate compliance disclaimer
   */
  getDisclaimer(): string {
    return `
OSINT DISCLAIMER:
This tool provides publicly available information only. Results are:
- Sourced from publicly accessible data
- Not guaranteed to be accurate or current
- Subject to source availability and rate limits
- Intended for legitimate research and security purposes only

Users must comply with:
- Local privacy and data protection laws
- Terms of service of source platforms
- Ethical guidelines for OSINT research
- No use for harassment, stalking, or illegal activities

Cyber Sense is not responsible for misuse of this tool.
    `.trim();
  }

  /**
   * Check jurisdiction-specific restrictions
   */
  checkJurisdiction(location?: { country?: string }): {
    allowed: boolean;
    restrictions: string[];
  } {
    const restrictions: string[] = [];
    
    // EU GDPR considerations
    if (location?.country && ['DE', 'FR', 'IT', 'ES', 'NL', 'BE'].includes(location.country)) {
      restrictions.push('EU jurisdiction: Ensure GDPR compliance for personal data processing');
    }
    
    // Australia Privacy Act
    if (location?.country === 'AU') {
      restrictions.push('Australia: Comply with Privacy Act 1988');
    }
    
    return {
      allowed: true, // Allow but warn
      restrictions,
    };
  }
}

