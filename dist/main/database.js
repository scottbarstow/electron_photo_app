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
        // Create tables
        this.createTables();
        this.createIndexes();
    }
    createTables() {
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
    createIndexes() {
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_images_path ON images(path);
      CREATE INDEX IF NOT EXISTS idx_images_hash ON images(hash);
      CREATE INDEX IF NOT EXISTS idx_images_perceptual_hash ON images(perceptual_hash);
      CREATE INDEX IF NOT EXISTS idx_images_modified ON images(modified);
      CREATE INDEX IF NOT EXISTS idx_duplicate_groups_hash ON duplicate_groups(hash);
    `);
    }
    // Image operations
    insertImage(image) {
        const stmt = this.db.prepare(`
      INSERT INTO images (path, filename, size, modified, hash, perceptual_hash, width, height)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const result = stmt.run(image.path, image.filename, image.size, image.modified, image.hash, image.perceptualHash, image.width, image.height);
        return result.lastInsertRowid;
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
        return stmt.get(id);
    }
    getImageByPath(path) {
        const stmt = this.db.prepare('SELECT * FROM images WHERE path = ?');
        return stmt.get(path);
    }
    getImagesByHash(hash) {
        const stmt = this.db.prepare('SELECT * FROM images WHERE hash = ?');
        return stmt.all(hash);
    }
    getAllImages() {
        const stmt = this.db.prepare('SELECT * FROM images ORDER BY path');
        return stmt.all();
    }
    deleteImage(id) {
        const stmt = this.db.prepare('DELETE FROM images WHERE id = ?');
        stmt.run(id);
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