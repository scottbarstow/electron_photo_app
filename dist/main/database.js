"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhotoDatabase = void 0;
exports.getDatabase = getDatabase;
exports.closeDatabase = closeDatabase;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path = __importStar(require("path"));
const electron_1 = require("electron");
const migrationTagsAlbums = __importStar(require("./migrations/002-tags-albums"));
class PhotoDatabase {
    constructor(dbPath) {
        const defaultPath = path.join(electron_1.app.getPath('userData'), 'photos.db');
        this.db = new better_sqlite3_1.default(dbPath || defaultPath);
        this.initialize();
    }
    initialize() {
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
    runMigrations() {
        // Migration 1: Add EXIF columns and folder support
        if (!this.isMigrationApplied('v1_exif_folders')) {
            try {
                // Check if directory column exists (indicates new schema)
                const tableInfo = this.db.prepare("PRAGMA table_info(images)").all();
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
            }
            catch (error) {
                console.error('Migration v1_exif_folders failed:', error);
            }
        }
        // Migration 2: Add tags and albums tables
        if (!this.isMigrationApplied(migrationTagsAlbums.version)) {
            try {
                migrationTagsAlbums.up(this.db);
                this.applyMigration(migrationTagsAlbums.version);
                console.log('Applied migration:', migrationTagsAlbums.version);
            }
            catch (error) {
                console.error('Migration', migrationTagsAlbums.version, 'failed:', error);
            }
        }
    }
    createTables() {
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
    createIndexes() {
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
    insertImage(image) {
        const stmt = this.db.prepare(`
      INSERT INTO images (
        path, filename, directory, size, modified, hash, perceptual_hash, width, height,
        camera_make, camera_model, exposure_time, f_number, iso, focal_length,
        date_time_original, latitude, longitude, lens_model, orientation, thumbnail_path
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(image.path, image.filename, image.directory, image.size, image.modified, image.hash, image.perceptualHash, image.width, image.height, image.cameraMake, image.cameraModel, image.exposureTime, image.fNumber, image.iso, image.focalLength, image.dateTimeOriginal, image.latitude, image.longitude, image.lensModel, image.orientation, image.thumbnailPath);
        return result.lastInsertRowid;
    }
    upsertImage(image) {
        const existing = this.getImageByPath(image.path);
        if (existing) {
            this.updateImage(existing.id, image);
            return existing.id;
        }
        return this.insertImage(image);
    }
    updateImage(id, updates) {
        const fields = Object.keys(updates).filter(key => key !== 'id');
        if (fields.length === 0)
            return;
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        const values = fields.map(field => updates[field]);
        const stmt = this.db.prepare(`UPDATE images SET ${setClause} WHERE id = ?`);
        stmt.run(...values, id);
    }
    getImage(id) {
        const stmt = this.db.prepare('SELECT * FROM images WHERE id = ?');
        const row = stmt.get(id);
        if (!row)
            return undefined;
        return this.mapImageRecords([row])[0];
    }
    getImageByPath(imagePath) {
        const stmt = this.db.prepare('SELECT * FROM images WHERE path = ?');
        const row = stmt.get(imagePath);
        if (!row)
            return undefined;
        return this.mapImageRecords([row])[0];
    }
    getImagesByHash(hash) {
        const stmt = this.db.prepare('SELECT * FROM images WHERE hash = ?');
        return this.mapImageRecords(stmt.all(hash));
    }
    getAllImages() {
        const stmt = this.db.prepare('SELECT * FROM images ORDER BY path');
        return this.mapImageRecords(stmt.all());
    }
    getImagesByDirectory(directory) {
        const stmt = this.db.prepare('SELECT * FROM images WHERE directory = ? ORDER BY filename');
        return this.mapImageRecords(stmt.all(directory));
    }
    getImageCountByDirectory(directory) {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM images WHERE directory = ?');
        const result = stmt.get(directory);
        return result.count;
    }
    searchImages(query) {
        const stmt = this.db.prepare(`
      SELECT * FROM images
      WHERE filename LIKE ? OR path LIKE ?
      ORDER BY path
    `);
        const pattern = `%${query}%`;
        return this.mapImageRecords(stmt.all(pattern, pattern));
    }
    getImagesByDateRange(startDate, endDate) {
        const stmt = this.db.prepare(`
      SELECT * FROM images
      WHERE date_time_original BETWEEN ? AND ?
      ORDER BY date_time_original
    `);
        return this.mapImageRecords(stmt.all(startDate, endDate));
    }
    deleteImage(id) {
        const stmt = this.db.prepare('DELETE FROM images WHERE id = ?');
        stmt.run(id);
    }
    deleteImageByPath(path) {
        const stmt = this.db.prepare('DELETE FROM images WHERE path = ?');
        stmt.run(path);
    }
    // Helper to map database rows to ImageRecord (handles snake_case to camelCase)
    mapImageRecords(rows) {
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
    insertDuplicateGroup(group) {
        const stmt = this.db.prepare(`
      INSERT INTO duplicate_groups (hash, count, total_size)
      VALUES (?, ?, ?)
    `);
        const result = stmt.run(group.hash, group.count, group.totalSize);
        return result.lastInsertRowid;
    }
    updateDuplicateGroup(id, updates) {
        const fields = Object.keys(updates).filter(key => key !== 'id');
        if (fields.length === 0)
            return;
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        const values = fields.map(field => updates[field]);
        const stmt = this.db.prepare(`UPDATE duplicate_groups SET ${setClause} WHERE id = ?`);
        stmt.run(...values, id);
    }
    getDuplicateGroup(id) {
        const stmt = this.db.prepare('SELECT * FROM duplicate_groups WHERE id = ?');
        return stmt.get(id);
    }
    getDuplicateGroupByHash(hash) {
        const stmt = this.db.prepare('SELECT * FROM duplicate_groups WHERE hash = ?');
        return stmt.get(hash);
    }
    getAllDuplicateGroups() {
        const stmt = this.db.prepare('SELECT * FROM duplicate_groups ORDER BY count DESC');
        return stmt.all();
    }
    deleteDuplicateGroup(id) {
        const stmt = this.db.prepare('DELETE FROM duplicate_groups WHERE id = ?');
        stmt.run(id);
    }
    // Folder operations
    insertFolder(folder) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO folders (path, name, parent_path, last_scanned)
      VALUES (?, ?, ?, ?)
    `);
        const result = stmt.run(folder.path, folder.name, folder.parentPath, Date.now());
        return result.lastInsertRowid;
    }
    updateFolderImageCount(path, count) {
        const stmt = this.db.prepare('UPDATE folders SET image_count = ?, last_scanned = ? WHERE path = ?');
        stmt.run(count, Date.now(), path);
    }
    getFolder(path) {
        const stmt = this.db.prepare('SELECT * FROM folders WHERE path = ?');
        const row = stmt.get(path);
        if (!row)
            return undefined;
        return {
            id: row.id,
            path: row.path,
            name: row.name,
            parentPath: row.parent_path,
            imageCount: row.image_count,
            lastScanned: row.last_scanned
        };
    }
    getSubfolders(parentPath) {
        const stmt = this.db.prepare('SELECT * FROM folders WHERE parent_path = ? ORDER BY name');
        const rows = stmt.all(parentPath);
        return rows.map(row => ({
            id: row.id,
            path: row.path,
            name: row.name,
            imageCount: row.image_count
        }));
    }
    getAllFolders() {
        const stmt = this.db.prepare('SELECT * FROM folders ORDER BY path');
        const rows = stmt.all();
        return rows.map(row => ({
            id: row.id,
            path: row.path,
            name: row.name,
            parentPath: row.parent_path,
            imageCount: row.image_count
        }));
    }
    deleteFolder(path) {
        const stmt = this.db.prepare('DELETE FROM folders WHERE path = ?');
        stmt.run(path);
    }
    clearFolders() {
        this.db.exec('DELETE FROM folders');
    }
    // Tag operations
    createTag(name, color = '#6b7280') {
        const stmt = this.db.prepare(`
      INSERT INTO tags (name, color) VALUES (?, ?)
    `);
        const result = stmt.run(name, color);
        return result.lastInsertRowid;
    }
    getTag(id) {
        const stmt = this.db.prepare('SELECT * FROM tags WHERE id = ?');
        const row = stmt.get(id);
        if (!row)
            return undefined;
        return { id: row.id, name: row.name, color: row.color, created: row.created };
    }
    getTagByName(name) {
        const stmt = this.db.prepare('SELECT * FROM tags WHERE name = ?');
        const row = stmt.get(name);
        if (!row)
            return undefined;
        return { id: row.id, name: row.name, color: row.color, created: row.created };
    }
    getAllTags() {
        const stmt = this.db.prepare('SELECT * FROM tags ORDER BY name');
        const rows = stmt.all();
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            color: row.color,
            created: row.created
        }));
    }
    updateTag(id, updates) {
        const fields = [];
        const values = [];
        if (updates.name !== undefined) {
            fields.push('name = ?');
            values.push(updates.name);
        }
        if (updates.color !== undefined) {
            fields.push('color = ?');
            values.push(updates.color);
        }
        if (fields.length === 0)
            return;
        values.push(id);
        const stmt = this.db.prepare(`UPDATE tags SET ${fields.join(', ')} WHERE id = ?`);
        stmt.run(...values);
    }
    deleteTag(id) {
        const stmt = this.db.prepare('DELETE FROM tags WHERE id = ?');
        stmt.run(id);
    }
    // Image-Tag operations
    addTagToImage(imageId, tagId) {
        const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO image_tags (image_id, tag_id) VALUES (?, ?)
    `);
        stmt.run(imageId, tagId);
    }
    removeTagFromImage(imageId, tagId) {
        const stmt = this.db.prepare('DELETE FROM image_tags WHERE image_id = ? AND tag_id = ?');
        stmt.run(imageId, tagId);
    }
    getTagsForImage(imageId) {
        const stmt = this.db.prepare(`
      SELECT t.* FROM tags t
      JOIN image_tags it ON t.id = it.tag_id
      WHERE it.image_id = ?
      ORDER BY t.name
    `);
        const rows = stmt.all(imageId);
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            color: row.color,
            created: row.created
        }));
    }
    getImagesByTag(tagId) {
        const stmt = this.db.prepare(`
      SELECT i.* FROM images i
      JOIN image_tags it ON i.id = it.image_id
      WHERE it.tag_id = ?
      ORDER BY i.path
    `);
        return this.mapImageRecords(stmt.all(tagId));
    }
    // Album operations
    createAlbum(name, description) {
        const stmt = this.db.prepare(`
      INSERT INTO albums (name, description) VALUES (?, ?)
    `);
        const result = stmt.run(name, description || null);
        return result.lastInsertRowid;
    }
    getAlbum(id) {
        const stmt = this.db.prepare('SELECT * FROM albums WHERE id = ?');
        const row = stmt.get(id);
        if (!row)
            return undefined;
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            coverImageId: row.cover_image_id,
            created: row.created,
            updated: row.updated
        };
    }
    getAllAlbums() {
        const stmt = this.db.prepare('SELECT * FROM albums ORDER BY name');
        const rows = stmt.all();
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            coverImageId: row.cover_image_id,
            created: row.created,
            updated: row.updated
        }));
    }
    updateAlbum(id, updates) {
        const fields = ['updated = strftime(\'%s\', \'now\')'];
        const values = [];
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
    deleteAlbum(id) {
        const stmt = this.db.prepare('DELETE FROM albums WHERE id = ?');
        stmt.run(id);
    }
    // Album-Image operations
    addImageToAlbum(albumId, imageId, position) {
        const pos = position ?? this.getAlbumImageCount(albumId);
        const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO album_images (album_id, image_id, position) VALUES (?, ?, ?)
    `);
        stmt.run(albumId, imageId, pos);
    }
    removeImageFromAlbum(albumId, imageId) {
        const stmt = this.db.prepare('DELETE FROM album_images WHERE album_id = ? AND image_id = ?');
        stmt.run(albumId, imageId);
    }
    getImagesInAlbum(albumId) {
        const stmt = this.db.prepare(`
      SELECT i.* FROM images i
      JOIN album_images ai ON i.id = ai.image_id
      WHERE ai.album_id = ?
      ORDER BY ai.position
    `);
        return this.mapImageRecords(stmt.all(albumId));
    }
    getAlbumsForImage(imageId) {
        const stmt = this.db.prepare(`
      SELECT a.* FROM albums a
      JOIN album_images ai ON a.id = ai.album_id
      WHERE ai.image_id = ?
      ORDER BY a.name
    `);
        const rows = stmt.all(imageId);
        return rows.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description,
            coverImageId: row.cover_image_id,
            created: row.created,
            updated: row.updated
        }));
    }
    getAlbumImageCount(albumId) {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM album_images WHERE album_id = ?');
        const result = stmt.get(albumId);
        return result.count;
    }
    reorderAlbumImages(albumId, imageIds) {
        const stmt = this.db.prepare('UPDATE album_images SET position = ? WHERE album_id = ? AND image_id = ?');
        const transaction = this.db.transaction(() => {
            imageIds.forEach((imageId, index) => {
                stmt.run(index, albumId, imageId);
            });
        });
        transaction();
    }
    // User preferences operations
    setPreference(key, value) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO user_preferences (key, value)
      VALUES (?, ?)
    `);
        stmt.run(key, value);
    }
    getPreference(key) {
        const stmt = this.db.prepare('SELECT value FROM user_preferences WHERE key = ?');
        const result = stmt.get(key);
        return result?.value;
    }
    getAllPreferences() {
        const stmt = this.db.prepare('SELECT key, value FROM user_preferences');
        const rows = stmt.all();
        return rows.reduce((acc, row) => {
            acc[row.key] = row.value;
            return acc;
        }, {});
    }
    deletePreference(key) {
        const stmt = this.db.prepare('DELETE FROM user_preferences WHERE key = ?');
        stmt.run(key);
    }
    // Transaction support
    transaction(fn) {
        const txn = this.db.transaction(fn);
        return txn(this);
    }
    // Utility methods
    getImageCount() {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM images');
        const result = stmt.get();
        return result.count;
    }
    getDuplicateCount() {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM duplicate_groups');
        const result = stmt.get();
        return result.count;
    }
    // Migration support
    applyMigration(version) {
        const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO migrations (version)
      VALUES (?)
    `);
        stmt.run(version);
    }
    isMigrationApplied(version) {
        const stmt = this.db.prepare('SELECT 1 FROM migrations WHERE version = ?');
        return stmt.get(version) !== undefined;
    }
    close() {
        this.db.close();
    }
}
exports.PhotoDatabase = PhotoDatabase;
// Export singleton instance
let dbInstance = null;
function getDatabase() {
    if (!dbInstance) {
        dbInstance = new PhotoDatabase();
    }
    return dbInstance;
}
function closeDatabase() {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
}
//# sourceMappingURL=database.js.map