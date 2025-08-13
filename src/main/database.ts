import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { getLogger } from './logger';

const logger = getLogger();

// Database configuration interface
interface DatabaseConfig {
  filename: string;
  readOnly?: boolean;
  fileMustExist?: boolean;
  timeout?: number;
  verbose?: (message?: unknown, ...additionalArgs: unknown[]) => void;
}

// Database migration interface
interface Migration {
  version: number;
  description: string;
  up: (db: Database.Database) => void;
  down?: (db: Database.Database) => void;
}

class DatabaseService {
  private db: Database.Database | null = null;
  private dbPath: string;
  private isInitialized = false;

  constructor() {
    // Get the user data directory for the database
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'photo_app.db');

    logger.info('Database path initialized', { path: this.dbPath });
  }

  /**
   * Initialize the database connection and create tables
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.debug('Database already initialized');
      return;
    }

    try {
      logger.info('Initializing database...');

      // Ensure the directory exists
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        logger.info('Created database directory', { directory: dbDir });
      }

      // Configure database options
      const config: DatabaseConfig = {
        filename: this.dbPath,
        timeout: 5000,
      };

      // Add verbose logging in development
      if (process.env.NODE_ENV === 'development') {
        config.verbose = (message?: unknown, ...additionalArgs: unknown[]) =>
          logger.debug(String(message), ...additionalArgs);
      }

      // Create database connection
      this.db = new Database(config.filename, config);

      // Configure database settings for performance and reliability
      this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency
      this.db.pragma('synchronous = NORMAL'); // Balance between safety and speed
      this.db.pragma('cache_size = 10000'); // 10MB cache
      this.db.pragma('temp_store = MEMORY'); // Store temporary tables in memory
      this.db.pragma('mmap_size = 268435456'); // 256MB memory mapping

      logger.info('Database connection established successfully');

      // Run migrations to create/update schema
      await this.runMigrations();

      this.isInitialized = true;
      logger.info('Database initialization complete');
    } catch (error) {
      logger.error('Failed to initialize database', undefined, error as Error);
      throw error;
    }
  }

  /**
   * Get the database instance
   */
  public getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Check if database is initialized
   */
  public isReady(): boolean {
    return this.isInitialized && this.db !== null;
  }

  /**
   * Execute a transaction with automatic rollback on error
   */
  public transaction<T>(fn: (db: Database.Database) => T): T {
    const db = this.getDatabase();
    const transaction = db.transaction(fn);
    return transaction(db);
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    logger.info('Running database migrations...');

    const db = this.getDatabase();

    // Create migrations table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER UNIQUE NOT NULL,
        description TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get current database version
    const currentVersionRow = db
      .prepare('SELECT MAX(version) as version FROM migrations')
      .get() as { version: number | null };
    const currentVersion = currentVersionRow?.version || 0;

    logger.info('Current database version', { version: currentVersion });

    // Get all migrations
    const migrations = this.getMigrations();
    const pendingMigrations = migrations.filter(
      m => m.version > currentVersion,
    );

    if (pendingMigrations.length === 0) {
      logger.info('No pending migrations');
      return;
    }

    logger.info('Applying migrations', { count: pendingMigrations.length });

    // Apply each migration in a transaction
    for (const migration of pendingMigrations) {
      try {
        db.transaction(() => {
          logger.info('Applying migration', {
            version: migration.version,
            description: migration.description,
          });

          migration.up(db);

          // Record migration
          db.prepare(
            `
            INSERT INTO migrations (version, description) 
            VALUES (?, ?)
          `,
          ).run(migration.version, migration.description);

          logger.info('Migration applied successfully', {
            version: migration.version,
          });
        })();
      } catch (error) {
        logger.error(
          'Migration failed',
          {
            version: migration.version,
            description: migration.description,
          },
          error as Error,
        );
        throw error;
      }
    }

    logger.info('All migrations applied successfully');
  }

  /**
   * Get all database migrations
   */
  private getMigrations(): Migration[] {
    return [
      {
        version: 1,
        description: 'Create initial schema',
        up: (db: Database.Database) => {
          // Images table for storing image metadata
          db.exec(`
            CREATE TABLE images (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              path TEXT UNIQUE NOT NULL,
              hash TEXT NOT NULL,
              perceptual_hash TEXT,
              size INTEGER NOT NULL,
              width INTEGER,
              height INTEGER,
              format TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              modified_at DATETIME,
              file_modified_at DATETIME,
              last_scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);

          // Duplicate groups table
          db.exec(`
            CREATE TABLE duplicate_groups (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              hash TEXT UNIQUE NOT NULL,
              count INTEGER NOT NULL DEFAULT 0,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);

          // Duplicate items table (junction table)
          db.exec(`
            CREATE TABLE duplicate_items (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              group_id INTEGER NOT NULL,
              image_id INTEGER NOT NULL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (group_id) REFERENCES duplicate_groups(id) ON DELETE CASCADE,
              FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
              UNIQUE(group_id, image_id)
            )
          `);

          // User preferences table
          db.exec(`
            CREATE TABLE user_preferences (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL,
              type TEXT NOT NULL DEFAULT 'string',
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
          `);

          // Directory index table for tracking scanned directories
          db.exec(`
            CREATE TABLE directory_index (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              path TEXT UNIQUE NOT NULL,
              parent_id INTEGER,
              is_scanned BOOLEAN DEFAULT FALSE,
              last_scan_at DATETIME,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (parent_id) REFERENCES directory_index(id) ON DELETE CASCADE
            )
          `);

          // Create indexes for performance
          db.exec(`
            CREATE INDEX idx_images_hash ON images(hash);
            CREATE INDEX idx_images_path ON images(path);
            CREATE INDEX idx_images_perceptual_hash ON images(perceptual_hash);
            CREATE INDEX idx_images_size ON images(size);
            CREATE INDEX idx_images_created_at ON images(created_at);
            CREATE INDEX idx_duplicate_groups_hash ON duplicate_groups(hash);
            CREATE INDEX idx_duplicate_items_group_id ON duplicate_items(group_id);
            CREATE INDEX idx_duplicate_items_image_id ON duplicate_items(image_id);
            CREATE INDEX idx_directory_index_path ON directory_index(path);
            CREATE INDEX idx_directory_index_parent_id ON directory_index(parent_id);
          `);
        },
      },
    ];
  }

  /**
   * Backup the database
   */
  public async backup(backupPath?: string): Promise<string> {
    const db = this.getDatabase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultBackupPath = path.join(
      path.dirname(this.dbPath),
      `photo_app_backup_${timestamp}.db`,
    );

    const finalBackupPath = backupPath || defaultBackupPath;

    try {
      logger.info('Creating database backup', { path: finalBackupPath });
      db.backup(finalBackupPath);
      logger.info('Database backup created successfully');
      return finalBackupPath;
    } catch (error) {
      logger.error(
        'Failed to create database backup',
        undefined,
        error as Error,
      );
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  public getStats(): Record<string, unknown> {
    const db = this.getDatabase();

    try {
      const stats = {
        images: db.prepare('SELECT COUNT(*) as count FROM images').get(),
        duplicateGroups: db
          .prepare('SELECT COUNT(*) as count FROM duplicate_groups')
          .get(),
        duplicateItems: db
          .prepare('SELECT COUNT(*) as count FROM duplicate_items')
          .get(),
        directories: db
          .prepare('SELECT COUNT(*) as count FROM directory_index')
          .get(),
        preferences: db
          .prepare('SELECT COUNT(*) as count FROM user_preferences')
          .get(),
        dbSize: fs.statSync(this.dbPath).size,
        dbPath: this.dbPath,
      };

      return stats;
    } catch (error) {
      logger.error('Failed to get database stats', undefined, error as Error);
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  public close(): void {
    if (this.db) {
      logger.info('Closing database connection...');

      try {
        this.db.close();
        this.db = null;
        this.isInitialized = false;
        logger.info('Database connection closed successfully');
      } catch (error) {
        logger.error(
          'Error closing database connection',
          undefined,
          error as Error,
        );
      }
    }
  }

  /**
   * Health check for the database
   */
  public healthCheck(): { healthy: boolean; message: string } {
    try {
      if (!this.isReady()) {
        return { healthy: false, message: 'Database not initialized' };
      }

      const db = this.getDatabase();
      // Simple query to test database connectivity
      db.prepare('SELECT 1').get();

      return { healthy: true, message: 'Database is healthy' };
    } catch (error) {
      return {
        healthy: false,
        message: `Database health check failed: ${(error as Error).message}`,
      };
    }
  }
}

// Singleton instance
let databaseService: DatabaseService | null = null;

/**
 * Get the database service singleton
 */
export function getDatabaseService(): DatabaseService {
  if (!databaseService) {
    databaseService = new DatabaseService();
  }
  return databaseService;
}

/**
 * Initialize database service (should be called during app startup)
 */
export async function initializeDatabase(): Promise<void> {
  const service = getDatabaseService();
  await service.initialize();
}

/**
 * Close database service (should be called during app shutdown)
 */
export function closeDatabase(): void {
  if (databaseService) {
    databaseService.close();
    databaseService = null;
  }
}

export { DatabaseService };
