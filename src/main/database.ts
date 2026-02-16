import Database from 'better-sqlite3';
import * as path from 'path';
import { app } from 'electron';
import * as migrationTagsAlbums from './migrations/002-tags-albums';

export interface ImageRecord {
  id?: number;
  path: string;
  filename: string;
  directory: string;
  size: number;
  modified: number;
  hash?: string;
  perceptualHash?: string;
  width?: number;
  height?: number;
  created?: number;

  // EXIF metadata
  cameraMake?: string;
  cameraModel?: string;
  exposureTime?: number;
  fNumber?: number;
  iso?: number;
  focalLength?: number;
  dateTimeOriginal?: number;
  latitude?: number;
  longitude?: number;
  lensModel?: string;
  orientation?: number;

  // Thumbnail
  thumbnailPath?: string;
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

export interface Tag {
  id?: number;
  name: string;
  color: string;
  created?: number;
}

export interface Album {
  id?: number;
  name: string;
  description?: string;
  coverImageId?: number;
  created?: number;
  updated?: number;
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
    // Enable foreign key enforcement (critical for referential integrity)
    this.db.pragma('foreign_keys = ON');

    // Create tables
    this.createTables();

    // Run migrations for existing databases (before creating indexes on new columns)
    this.runMigrations();

    // Create indexes after migrations have added any new columns
    this.createIndexes();
  }

  private runMigrations(): void {
    // Migration 1: Add EXIF columns and folder support
    if (!this.isMigrationApplied('v1_exif_folders')) {
      try {
        // Check if directory column exists (indicates new schema)
        const tableInfo = this.db.prepare("PRAGMA table_info(images)").all() as any[];
        const hasDirectory = tableInfo.some(col => col.name === 'directory');

        if (!hasDirectory) {
          // Add new columns to existing images table
          this.db.exec(`
            ALTER TABLE images ADD COLUMN directory TEXT DEFAULT '';
            ALTER TABLE images ADD COLUMN camera_make TEXT;
            ALTER TABLE images ADD COLUMN camera_model TEXT;
            ALTER TABLE images ADD COLUMN exposure_time REAL;
            ALTER TABLE images ADD COLUMN f_number REAL;
            ALTER TABLE images ADD COLUMN iso INTEGER;
            ALTER TABLE images ADD COLUMN focal_length REAL;
            ALTER TABLE images ADD COLUMN date_time_original INTEGER;
            ALTER TABLE images ADD COLUMN latitude REAL;
            ALTER TABLE images ADD COLUMN longitude REAL;
            ALTER TABLE images ADD COLUMN lens_model TEXT;
            ALTER TABLE images ADD COLUMN orientation INTEGER;
            ALTER TABLE images ADD COLUMN thumbnail_path TEXT;
          `);

          // Update directory column from path
          this.db.exec(`
            UPDATE images SET directory = substr(path, 1, length(path) - length(filename) - 1)
            WHERE directory = '';
          `);

          // Create folders table if it doesn't exist
          this.db.exec(`
            CREATE TABLE IF NOT EXISTS folders (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              path TEXT UNIQUE NOT NULL,
              name TEXT NOT NULL,
              parent_path TEXT,
              image_count INTEGER DEFAULT 0,
              last_scanned INTEGER,
              created INTEGER DEFAULT (strftime('%s', 'now'))
            )
          `);

          // Create new indexes
          this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_images_directory ON images(directory);
            CREATE INDEX IF NOT EXISTS idx_images_date_original ON images(date_time_original);
            CREATE INDEX IF NOT EXISTS idx_folders_path ON folders(path);
            CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_path);
          `);
        }

        this.applyMigration('v1_exif_folders');
        console.log('Applied migration: v1_exif_folders');
      } catch (error) {
        console.error('Migration v1_exif_folders failed:', error);
      }
    }

    // Migration 2: Add tags and albums tables
    if (!this.isMigrationApplied(migrationTagsAlbums.version)) {
      try {
        migrationTagsAlbums.up(this.db);
        this.applyMigration(migrationTagsAlbums.version);
        console.log('Applied migration:', migrationTagsAlbums.version);
      } catch (error) {
        console.error('Migration', migrationTagsAlbums.version, 'failed:', error);
      }
    }
  }

  private createTables(): void {
    // Images table with extended EXIF metadata
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE NOT NULL,
        filename TEXT NOT NULL,
        directory TEXT NOT NULL,
        size INTEGER NOT NULL,
        modified INTEGER NOT NULL,
        hash TEXT,
        perceptual_hash TEXT,
        width INTEGER,
        height INTEGER,
        created INTEGER DEFAULT (strftime('%s', 'now')),

        -- EXIF metadata
        camera_make TEXT,
        camera_model TEXT,
        exposure_time REAL,
        f_number REAL,
        iso INTEGER,
        focal_length REAL,
        date_time_original INTEGER,
        latitude REAL,
        longitude REAL,
        lens_model TEXT,
        orientation INTEGER,

        -- Thumbnail
        thumbnail_path TEXT
      )
    `);

    // Folders table for folder tree navigation
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        parent_path TEXT,
        image_count INTEGER DEFAULT 0,
        last_scanned INTEGER,
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
      CREATE INDEX IF NOT EXISTS idx_images_directory ON images(directory);
      CREATE INDEX IF NOT EXISTS idx_images_hash ON images(hash);
      CREATE INDEX IF NOT EXISTS idx_images_perceptual_hash ON images(perceptual_hash);
      CREATE INDEX IF NOT EXISTS idx_images_modified ON images(modified);
      CREATE INDEX IF NOT EXISTS idx_images_date_original ON images(date_time_original);
      CREATE INDEX IF NOT EXISTS idx_duplicate_groups_hash ON duplicate_groups(hash);
      CREATE INDEX IF NOT EXISTS idx_folders_path ON folders(path);
      CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_path);
    `);
  }

  // Image operations
  insertImage(image: Omit<ImageRecord, 'id'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO images (
        path, filename, directory, size, modified, hash, perceptual_hash, width, height,
        camera_make, camera_model, exposure_time, f_number, iso, focal_length,
        date_time_original, latitude, longitude, lens_model, orientation, thumbnail_path
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      image.path,
      image.filename,
      image.directory,
      image.size,
      image.modified,
      image.hash,
      image.perceptualHash,
      image.width,
      image.height,
      image.cameraMake,
      image.cameraModel,
      image.exposureTime,
      image.fNumber,
      image.iso,
      image.focalLength,
      image.dateTimeOriginal,
      image.latitude,
      image.longitude,
      image.lensModel,
      image.orientation,
      image.thumbnailPath
    );

    return result.lastInsertRowid as number;
  }

  upsertImage(image: Omit<ImageRecord, 'id'>): number {
    const existing = this.getImageByPath(image.path);
    if (existing) {
      this.updateImage(existing.id!, image);
      return existing.id!;
    }
    return this.insertImage(image);
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
    const row = stmt.get(id);
    if (!row) return undefined;
    return this.mapImageRecords([row])[0];
  }

  getImageByPath(imagePath: string): ImageRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM images WHERE path = ?');
    const row = stmt.get(imagePath);
    if (!row) return undefined;
    return this.mapImageRecords([row])[0];
  }

  getImagesByHash(hash: string): ImageRecord[] {
    const stmt = this.db.prepare('SELECT * FROM images WHERE hash = ?');
    return this.mapImageRecords(stmt.all(hash));
  }

  getAllImages(): ImageRecord[] {
    const stmt = this.db.prepare('SELECT * FROM images ORDER BY path');
    return this.mapImageRecords(stmt.all());
  }

  getImagesByDirectory(directory: string): ImageRecord[] {
    const stmt = this.db.prepare('SELECT * FROM images WHERE directory = ? ORDER BY filename');
    return this.mapImageRecords(stmt.all(directory));
  }

  getImageCountByDirectory(directory: string): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM images WHERE directory = ?');
    const result = stmt.get(directory) as { count: number };
    return result.count;
  }

  searchImages(query: string): ImageRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM images
      WHERE filename LIKE ? OR path LIKE ?
      ORDER BY path
    `);
    const pattern = `%${query}%`;
    return this.mapImageRecords(stmt.all(pattern, pattern));
  }

  getImagesByDateRange(startDate: number, endDate: number): ImageRecord[] {
    const stmt = this.db.prepare(`
      SELECT * FROM images
      WHERE date_time_original BETWEEN ? AND ?
      ORDER BY date_time_original
    `);
    return this.mapImageRecords(stmt.all(startDate, endDate));
  }

  deleteImage(id: number): void {
    const stmt = this.db.prepare('DELETE FROM images WHERE id = ?');
    stmt.run(id);
  }

  deleteImageByPath(path: string): void {
    const stmt = this.db.prepare('DELETE FROM images WHERE path = ?');
    stmt.run(path);
  }

  // Helper to map database rows to ImageRecord (handles snake_case to camelCase)
  private mapImageRecords(rows: any[]): ImageRecord[] {
    return rows.map(row => ({
      id: row.id,
      path: row.path,
      filename: row.filename,
      directory: row.directory,
      size: row.size,
      modified: row.modified,
      hash: row.hash,
      perceptualHash: row.perceptual_hash,
      width: row.width,
      height: row.height,
      created: row.created,
      cameraMake: row.camera_make,
      cameraModel: row.camera_model,
      exposureTime: row.exposure_time,
      fNumber: row.f_number,
      iso: row.iso,
      focalLength: row.focal_length,
      dateTimeOriginal: row.date_time_original,
      latitude: row.latitude,
      longitude: row.longitude,
      lensModel: row.lens_model,
      orientation: row.orientation,
      thumbnailPath: row.thumbnail_path
    }));
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

  // Folder operations
  insertFolder(folder: { path: string; name: string; parentPath?: string }): number {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO folders (path, name, parent_path, last_scanned)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(folder.path, folder.name, folder.parentPath, Date.now());
    return result.lastInsertRowid as number;
  }

  updateFolderImageCount(path: string, count: number): void {
    const stmt = this.db.prepare('UPDATE folders SET image_count = ?, last_scanned = ? WHERE path = ?');
    stmt.run(count, Date.now(), path);
  }

  getFolder(path: string): { id: number; path: string; name: string; parentPath?: string; imageCount: number; lastScanned?: number } | undefined {
    const stmt = this.db.prepare('SELECT * FROM folders WHERE path = ?');
    const row = stmt.get(path) as any;
    if (!row) return undefined;

    return {
      id: row.id,
      path: row.path,
      name: row.name,
      parentPath: row.parent_path,
      imageCount: row.image_count,
      lastScanned: row.last_scanned
    };
  }

  getSubfolders(parentPath: string): Array<{ id: number; path: string; name: string; imageCount: number }> {
    const stmt = this.db.prepare('SELECT * FROM folders WHERE parent_path = ? ORDER BY name');
    const rows = stmt.all(parentPath) as any[];

    return rows.map(row => ({
      id: row.id,
      path: row.path,
      name: row.name,
      imageCount: row.image_count
    }));
  }

  getAllFolders(): Array<{ id: number; path: string; name: string; parentPath?: string; imageCount: number }> {
    const stmt = this.db.prepare('SELECT * FROM folders ORDER BY path');
    const rows = stmt.all() as any[];

    return rows.map(row => ({
      id: row.id,
      path: row.path,
      name: row.name,
      parentPath: row.parent_path,
      imageCount: row.image_count
    }));
  }

  deleteFolder(path: string): void {
    const stmt = this.db.prepare('DELETE FROM folders WHERE path = ?');
    stmt.run(path);
  }

  clearFolders(): void {
    this.db.exec('DELETE FROM folders');
  }

  // Tag operations
  createTag(name: string, color: string = '#6b7280'): number {
    const stmt = this.db.prepare(`
      INSERT INTO tags (name, color) VALUES (?, ?)
    `);
    const result = stmt.run(name, color);
    return result.lastInsertRowid as number;
  }

  getTag(id: number): Tag | undefined {
    const stmt = this.db.prepare('SELECT * FROM tags WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return undefined;
    return { id: row.id, name: row.name, color: row.color, created: row.created };
  }

  getTagByName(name: string): Tag | undefined {
    const stmt = this.db.prepare('SELECT * FROM tags WHERE name = ?');
    const row = stmt.get(name) as any;
    if (!row) return undefined;
    return { id: row.id, name: row.name, color: row.color, created: row.created };
  }

  getAllTags(): Tag[] {
    const stmt = this.db.prepare('SELECT * FROM tags ORDER BY name');
    const rows = stmt.all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      color: row.color,
      created: row.created
    }));
  }

  getAllTagsWithCounts(): Array<Tag & { imageCount: number }> {
    const stmt = this.db.prepare(`
      SELECT t.*, COUNT(it.image_id) as image_count
      FROM tags t
      LEFT JOIN image_tags it ON t.id = it.tag_id
      GROUP BY t.id
      ORDER BY t.name
    `);
    const rows = stmt.all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      color: row.color,
      created: row.created,
      imageCount: row.image_count
    }));
  }

  updateTag(id: number, updates: Partial<Tag>): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.color !== undefined) {
      fields.push('color = ?');
      values.push(updates.color);
    }

    if (fields.length === 0) return;
    values.push(id);

    const stmt = this.db.prepare(`UPDATE tags SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  }

  deleteTag(id: number): void {
    const stmt = this.db.prepare('DELETE FROM tags WHERE id = ?');
    stmt.run(id);
  }

  // Image-Tag operations
  addTagToImage(imageId: number, tagId: number): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO image_tags (image_id, tag_id) VALUES (?, ?)
    `);
    stmt.run(imageId, tagId);
  }

  removeTagFromImage(imageId: number, tagId: number): void {
    const stmt = this.db.prepare('DELETE FROM image_tags WHERE image_id = ? AND tag_id = ?');
    stmt.run(imageId, tagId);
  }

  getTagsForImage(imageId: number): Tag[] {
    const stmt = this.db.prepare(`
      SELECT t.* FROM tags t
      JOIN image_tags it ON t.id = it.tag_id
      WHERE it.image_id = ?
      ORDER BY t.name
    `);
    const rows = stmt.all(imageId) as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      color: row.color,
      created: row.created
    }));
  }

  getImagesByTag(tagId: number): ImageRecord[] {
    const stmt = this.db.prepare(`
      SELECT i.* FROM images i
      JOIN image_tags it ON i.id = it.image_id
      WHERE it.tag_id = ?
      ORDER BY i.path
    `);
    return this.mapImageRecords(stmt.all(tagId));
  }

  // Album operations
  createAlbum(name: string, description?: string): number {
    const stmt = this.db.prepare(`
      INSERT INTO albums (name, description) VALUES (?, ?)
    `);
    const result = stmt.run(name, description || null);
    return result.lastInsertRowid as number;
  }

  getAlbum(id: number): Album | undefined {
    const stmt = this.db.prepare('SELECT * FROM albums WHERE id = ?');
    const row = stmt.get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      coverImageId: row.cover_image_id,
      created: row.created,
      updated: row.updated
    };
  }

  getAllAlbums(): Album[] {
    const stmt = this.db.prepare('SELECT * FROM albums ORDER BY name');
    const rows = stmt.all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      coverImageId: row.cover_image_id,
      created: row.created,
      updated: row.updated
    }));
  }

  getAllAlbumsWithCounts(): Array<Album & { imageCount: number }> {
    const stmt = this.db.prepare(`
      SELECT a.*, COUNT(ai.image_id) as image_count
      FROM albums a
      LEFT JOIN album_images ai ON a.id = ai.album_id
      GROUP BY a.id
      ORDER BY a.name
    `);
    const rows = stmt.all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      coverImageId: row.cover_image_id,
      created: row.created,
      updated: row.updated,
      imageCount: row.image_count
    }));
  }

  updateAlbum(id: number, updates: Partial<Album>): void {
    const fields: string[] = ['updated = strftime(\'%s\', \'now\')'];
    const values: any[] = [];

    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.coverImageId !== undefined) {
      fields.push('cover_image_id = ?');
      values.push(updates.coverImageId);
    }

    values.push(id);

    const stmt = this.db.prepare(`UPDATE albums SET ${fields.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  }

  deleteAlbum(id: number): void {
    const stmt = this.db.prepare('DELETE FROM albums WHERE id = ?');
    stmt.run(id);
  }

  // Album-Image operations
  addImageToAlbum(albumId: number, imageId: number, position?: number): void {
    const pos = position ?? this.getAlbumImageCount(albumId);
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO album_images (album_id, image_id, position) VALUES (?, ?, ?)
    `);
    stmt.run(albumId, imageId, pos);
  }

  removeImageFromAlbum(albumId: number, imageId: number): void {
    const stmt = this.db.prepare('DELETE FROM album_images WHERE album_id = ? AND image_id = ?');
    stmt.run(albumId, imageId);
  }

  getImagesInAlbum(albumId: number): ImageRecord[] {
    const stmt = this.db.prepare(`
      SELECT i.* FROM images i
      JOIN album_images ai ON i.id = ai.image_id
      WHERE ai.album_id = ?
      ORDER BY ai.position
    `);
    return this.mapImageRecords(stmt.all(albumId));
  }

  getAlbumsForImage(imageId: number): Album[] {
    const stmt = this.db.prepare(`
      SELECT a.* FROM albums a
      JOIN album_images ai ON a.id = ai.album_id
      WHERE ai.image_id = ?
      ORDER BY a.name
    `);
    const rows = stmt.all(imageId) as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      coverImageId: row.cover_image_id,
      created: row.created,
      updated: row.updated
    }));
  }

  getAlbumImageCount(albumId: number): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM album_images WHERE album_id = ?');
    const result = stmt.get(albumId) as { count: number };
    return result.count;
  }

  reorderAlbumImages(albumId: number, imageIds: number[]): void {
    const stmt = this.db.prepare('UPDATE album_images SET position = ? WHERE album_id = ? AND image_id = ?');
    const transaction = this.db.transaction(() => {
      imageIds.forEach((imageId, index) => {
        stmt.run(index, albumId, imageId);
      });
    });
    transaction();
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