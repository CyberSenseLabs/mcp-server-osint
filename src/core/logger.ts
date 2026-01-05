import winston from 'winston';

/**
 * Structured logging for audit and debugging
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'mcp-server-osint',
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

/**
 * Audit log for compliance tracking
 */
export class AuditLogger {
  /**
   * Log a search query for audit purposes
   */
  static logQuery(
    query: {
      full_name?: string;
      aliases?: string[];
      location?: { city?: string; state?: string; country?: string };
    },
    metadata: {
      sources_queried: string[];
      result_count: number;
      processing_time_ms: number;
    }
  ): void {
    logger.info('OSINT query executed', {
      type: 'query',
      query: {
        // Hash name for privacy in logs
        name_hash: this.hashString(query.full_name || ''),
        aliases_count: query.aliases?.length || 0,
        location: query.location?.country || 'unknown',
      },
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log source access
   */
  static logSourceAccess(
    sourceId: string,
    success: boolean,
    error?: string
  ): void {
    logger.info('Source accessed', {
      type: 'source_access',
      source_id: sourceId,
      success,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Log compliance violation attempt
   */
  static logViolation(
    type: string,
    details: Record<string, unknown>
  ): void {
    logger.warn('Compliance violation detected', {
      type: 'violation',
      violation_type: type,
      details,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Simple hash function for privacy-preserving logs
   */
  private static hashString(str: string): string {
    if (!str) return '';
    // Simple hash for logging (not cryptographic)
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

