import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';

export interface ImageRecord {
  id?: number;
  path: string;
  filename: string;
  size: number;
  modified: number;
  hash?: string;
  perceptualHash?: string;
  width?: number;
  height?: number;
  created?: number;
}

export interface DuplicateGroup {
  id?: number;
  hash: string;
  count: number;
  totalSize: number;
  created: number;
}

export interface UserPreference {
  key: string;
  value: string;
}

export class PhotoDatabase {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const defaultPath = path.join(app.getPath('userData'), 'photos.db');
    this.db = new Database(dbPath || defaultPath);
    this.initialize();
  }

  private initialize(): void {
    // Enable WAL mode for better performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000000');
    this.db.pragma('temp_store = memory');

    // Create tables
    this.createTables();
    this.createIndexes();
  }

  private createTables(): void {
    // Images table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE NOT NULL,
        filename TEXT NOT NULL,
        size INTEGER NOT NULL,
        modified INTEGER NOT NULL,
        hash TEXT,
        perceptual_hash TEXT,
        width INTEGER,
        height INTEGER,
        created INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Duplicate groups table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS duplicate_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT UNIQUE NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        total_size INTEGER NOT NULL DEFAULT 0,
        created INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // User preferences table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Migration tracking table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT UNIQUE NOT NULL,
        applied INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);
  }

  private createIndexes(): void {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_images_path ON images(path);
      CREATE INDEX IF NOT EXISTS idx_images_hash ON images(hash);
      CREATE INDEX IF NOT EXISTS idx_images_perceptual_hash ON images(perceptual_hash);
      CREATE INDEX IF NOT EXISTS idx_images_modified ON images(modified);
      CREATE INDEX IF NOT EXISTS idx_duplicate_groups_hash ON duplicate_groups(hash);
    `);
  }

  // Image operations
  insertImage(image: Omit<ImageRecord, 'id'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO images (path, filename, size, modified, hash, perceptual_hash, width, height)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      image.path,
      image.filename,
      image.size,
      image.modified,
      image.hash,
      image.perceptualHash,
      image.width,
      image.height
    );
    
    return result.lastInsertRowid as number;
  }

  updateImage(id: number, updates: Partial<ImageRecord>): void {
    const fields = Object.keys(updates).filter(key => key !== 'id');
    if (fields.length === 0) return;

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field as keyof ImageRecord]);

    const stmt = this.db.prepare(`UPDATE images SET ${setClause} WHERE id = ?`);
    stmt.run(...values, id);
  }

  getImage(id: number): ImageRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM images WHERE id = ?');
    return stmt.get(id) as ImageRecord | undefined;
  }

  getImageByPath(path: string): ImageRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM images WHERE path = ?');
    return stmt.get(path) as ImageRecord | undefined;
  }

  getImagesByHash(hash: string): ImageRecord[] {
    const stmt = this.db.prepare('SELECT * FROM images WHERE hash = ?');
    return stmt.all(hash) as ImageRecord[];
  }

  getAllImages(): ImageRecord[] {
    const stmt = this.db.prepare('SELECT * FROM images ORDER BY path');
    return stmt.all() as ImageRecord[];
  }

  deleteImage(id: number): void {
    const stmt = this.db.prepare('DELETE FROM images WHERE id = ?');
    stmt.run(id);
  }

  // Duplicate group operations
  insertDuplicateGroup(group: Omit<DuplicateGroup, 'id'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO duplicate_groups (hash, count, total_size)
      VALUES (?, ?, ?)
    `);
    
    const result = stmt.run(group.hash, group.count, group.totalSize);
    return result.lastInsertRowid as number;
  }

  updateDuplicateGroup(id: number, updates: Partial<DuplicateGroup>): void {
    const fields = Object.keys(updates).filter(key => key !== 'id');
    if (fields.length === 0) return;

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field as keyof DuplicateGroup]);

    const stmt = this.db.prepare(`UPDATE duplicate_groups SET ${setClause} WHERE id = ?`);
    stmt.run(...values, id);
  }

  getDuplicateGroup(id: number): DuplicateGroup | undefined {
    const stmt = this.db.prepare('SELECT * FROM duplicate_groups WHERE id = ?');
    return stmt.get(id) as DuplicateGroup | undefined;
  }

  getDuplicateGroupByHash(hash: string): DuplicateGroup | undefined {
    const stmt = this.db.prepare('SELECT * FROM duplicate_groups WHERE hash = ?');
    return stmt.get(hash) as DuplicateGroup | undefined;
  }

  getAllDuplicateGroups(): DuplicateGroup[] {
    const stmt = this.db.prepare('SELECT * FROM duplicate_groups ORDER BY count DESC');
    return stmt.all() as DuplicateGroup[];
  }

  deleteDuplicateGroup(id: number): void {
    const stmt = this.db.prepare('DELETE FROM duplicate_groups WHERE id = ?');
    stmt.run(id);
  }

  // User preferences operations
  setPreference(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_preferences (key, value)
      VALUES (?, ?)
    `);
    stmt.run(key, value);
  }

  getPreference(key: string): string | undefined {
    const stmt = this.db.prepare('SELECT value FROM user_preferences WHERE key = ?');
    const result = stmt.get(key) as { value: string } | undefined;
    return result?.value;
  }

  getAllPreferences(): Record<string, string> {
    const stmt = this.db.prepare('SELECT key, value FROM user_preferences');
    const rows = stmt.all() as UserPreference[];
    
    return rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {} as Record<string, string>);
  }

  deletePreference(key: string): void {
    const stmt = this.db.prepare('DELETE FROM user_preferences WHERE key = ?');
    stmt.run(key);
  }

  // Transaction support
  transaction<T>(fn: (db: PhotoDatabase) => T): T {
    const txn = this.db.transaction(fn);
    return txn(this);
  }

  // Utility methods
  getImageCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM images');
    const result = stmt.get() as { count: number };
    return result.count;
  }

  getDuplicateCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM duplicate_groups');
    const result = stmt.get() as { count: number };
    return result.count;
  }

  // Migration support
  applyMigration(version: string): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO migrations (version)
      VALUES (?)
    `);
    stmt.run(version);
  }

  isMigrationApplied(version: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM migrations WHERE version = ?');
    return stmt.get(version) !== undefined;
  }

  close(): void {
    this.db.close();
  }
}

// Export singleton instance
let dbInstance: PhotoDatabase | null = null;

export function getDatabase(): PhotoDatabase {
  if (!dbInstance) {
    dbInstance = new PhotoDatabase();
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}