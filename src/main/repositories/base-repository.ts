import Database from 'better-sqlite3';
import { getDatabaseService } from '../database';
import { getLogger } from '../logger';

const logger = getLogger();

/**
 * Base repository class with common database operations
 */
export abstract class BaseRepository {
  protected db: Database.Database;

  constructor() {
    const dbService = getDatabaseService();
    if (!dbService.isReady()) {
      throw new Error('Database service not initialized');
    }
    this.db = dbService.getDatabase();
  }

  /**
   * Execute a transaction with automatic rollback on error
   */
  protected transaction<T>(fn: () => T): T {
    const transaction = this.db.transaction(fn);
    return transaction();
  }

  /**
   * Log repository operations for debugging
   */
  protected logOperation(operation: string, data?: unknown): void {
    logger.debug(`Repository operation: ${operation}`, data);
  }

  /**
   * Handle database errors consistently
   */
  protected handleError(operation: string, error: Error): never {
    logger.error(`Repository operation failed: ${operation}`, undefined, error);
    throw error;
  }

  /**
   * Validate required fields
   */
  protected validateRequired(
    data: Record<string, unknown>,
    requiredFields: string[],
  ): void {
    const missing = requiredFields.filter(
      field =>
        data[field] === undefined || data[field] === null || data[field] === '',
    );

    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }
  }

  /**
   * Sanitize input to prevent SQL injection (additional safety)
   */
  protected sanitizeString(value: string): string {
    if (typeof value !== 'string') return value;
    return value.replace(/'/g, "''"); // Escape single quotes
  }
}
