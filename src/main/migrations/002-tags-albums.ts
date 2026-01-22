import type Database from 'better-sqlite3';

export const version = 'v2_tags_albums';

export function up(db: Database.Database): void {
  // Tags table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#6b7280',
      created INTEGER DEFAULT (strftime('%s', 'now'))
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name)`);

  // Image-Tag junction table
  db.exec(`
    CREATE TABLE IF NOT EXISTS image_tags (
      image_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      created INTEGER DEFAULT (strftime('%s', 'now')),
      PRIMARY KEY (image_id, tag_id),
      FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_image_tags_image ON image_tags(image_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_image_tags_tag ON image_tags(tag_id)`);

  // Albums table
  db.exec(`
    CREATE TABLE IF NOT EXISTS albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      cover_image_id INTEGER,
      created INTEGER DEFAULT (strftime('%s', 'now')),
      updated INTEGER DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (cover_image_id) REFERENCES images(id) ON DELETE SET NULL
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_albums_name ON albums(name)`);

  // Album-Image junction table
  db.exec(`
    CREATE TABLE IF NOT EXISTS album_images (
      album_id INTEGER NOT NULL,
      image_id INTEGER NOT NULL,
      position INTEGER DEFAULT 0,
      added INTEGER DEFAULT (strftime('%s', 'now')),
      PRIMARY KEY (album_id, image_id),
      FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE,
      FOREIGN KEY (image_id) REFERENCES images(id) ON DELETE CASCADE
    )
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_album_images_album ON album_images(album_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_album_images_image ON album_images(image_id)`);
}

export function down(db: Database.Database): void {
  db.exec(`DROP TABLE IF EXISTS album_images`);
  db.exec(`DROP TABLE IF EXISTS albums`);
  db.exec(`DROP TABLE IF EXISTS image_tags`);
  db.exec(`DROP TABLE IF EXISTS tags`);
}
