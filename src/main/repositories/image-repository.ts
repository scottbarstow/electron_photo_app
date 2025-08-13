import { BaseRepository } from './base-repository';

export interface ImageRecord {
  id?: number;
  path: string;
  hash: string;
  perceptual_hash?: string;
  size: number;
  width?: number;
  height?: number;
  format?: string;
  created_at?: string;
  modified_at?: string;
  file_modified_at?: string;
  last_scanned_at?: string;
}

export interface ImageSearchOptions {
  hash?: string;
  perceptual_hash?: string;
  path?: string;
  minSize?: number;
  maxSize?: number;
  format?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'created_at' | 'modified_at' | 'size' | 'path';
  orderDirection?: 'ASC' | 'DESC';
}

export class ImageRepository extends BaseRepository {
  /**
   * Create a new image record
   */
  public create(image: Omit<ImageRecord, 'id' | 'created_at'>): ImageRecord {
    this.validateRequired(image, ['path', 'hash', 'size']);
    this.logOperation('create image', { path: image.path });

    try {
      const stmt = this.db.prepare(`
        INSERT INTO images (
          path, hash, perceptual_hash, size, width, height, format,
          modified_at, file_modified_at, last_scanned_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);

      const result = stmt.run(
        image.path,
        image.hash,
        image.perceptual_hash || null,
        image.size,
        image.width || null,
        image.height || null,
        image.format || null,
        image.modified_at || null,
        image.file_modified_at || null,
      );

      return this.findById(result.lastInsertRowid as number)!;
    } catch (error) {
      this.handleError('create image', error as Error);
    }
  }

  /**
   * Find image by ID
   */
  public findById(id: number): ImageRecord | null {
    this.logOperation('find image by id', { id });

    try {
      const stmt = this.db.prepare('SELECT * FROM images WHERE id = ?');
      const result = stmt.get(id) as ImageRecord | undefined;
      return result || null;
    } catch (error) {
      this.handleError('find image by id', error as Error);
    }
  }

  /**
   * Find image by path
   */
  public findByPath(path: string): ImageRecord | null {
    this.logOperation('find image by path', { path });

    try {
      const stmt = this.db.prepare('SELECT * FROM images WHERE path = ?');
      const result = stmt.get(path) as ImageRecord | undefined;
      return result || null;
    } catch (error) {
      this.handleError('find image by path', error as Error);
    }
  }

  /**
   * Find images by hash
   */
  public findByHash(hash: string): ImageRecord[] {
    this.logOperation('find images by hash', { hash });

    try {
      const stmt = this.db.prepare('SELECT * FROM images WHERE hash = ?');
      return stmt.all(hash) as ImageRecord[];
    } catch (error) {
      this.handleError('find images by hash', error as Error);
    }
  }

  /**
   * Find images by perceptual hash
   */
  public findByPerceptualHash(perceptualHash: string): ImageRecord[] {
    this.logOperation('find images by perceptual hash', { perceptualHash });

    try {
      const stmt = this.db.prepare(
        'SELECT * FROM images WHERE perceptual_hash = ?',
      );
      return stmt.all(perceptualHash) as ImageRecord[];
    } catch (error) {
      this.handleError('find images by perceptual hash', error as Error);
    }
  }

  /**
   * Search images with complex criteria
   */
  public search(options: ImageSearchOptions): ImageRecord[] {
    this.logOperation('search images', options);

    try {
      let query = 'SELECT * FROM images WHERE 1=1';
      const params: unknown[] = [];

      if (options.hash) {
        query += ' AND hash = ?';
        params.push(options.hash);
      }

      if (options.perceptual_hash) {
        query += ' AND perceptual_hash = ?';
        params.push(options.perceptual_hash);
      }

      if (options.path) {
        query += ' AND path LIKE ?';
        params.push(`%${options.path}%`);
      }

      if (options.minSize !== undefined) {
        query += ' AND size >= ?';
        params.push(options.minSize);
      }

      if (options.maxSize !== undefined) {
        query += ' AND size <= ?';
        params.push(options.maxSize);
      }

      if (options.format) {
        query += ' AND format = ?';
        params.push(options.format);
      }

      // Add ordering
      if (options.orderBy) {
        const direction = options.orderDirection || 'ASC';
        query += ` ORDER BY ${options.orderBy} ${direction}`;
      }

      // Add pagination
      if (options.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);

        if (options.offset) {
          query += ' OFFSET ?';
          params.push(options.offset);
        }
      }

      const stmt = this.db.prepare(query);
      return stmt.all(...params) as ImageRecord[];
    } catch (error) {
      this.handleError('search images', error as Error);
    }
  }

  /**
   * Update an image record
   */
  public update(
    id: number,
    updates: Partial<Omit<ImageRecord, 'id' | 'created_at'>>,
  ): ImageRecord | null {
    this.logOperation('update image', { id, updates });

    try {
      const fields: string[] = [];
      const params: unknown[] = [];

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          fields.push(`${key} = ?`);
          params.push(value);
        }
      });

      if (fields.length === 0) {
        return this.findById(id);
      }

      // Add updated timestamp
      fields.push('modified_at = CURRENT_TIMESTAMP');
      params.push(id);

      const query = `UPDATE images SET ${fields.join(', ')} WHERE id = ?`;
      const stmt = this.db.prepare(query);

      const result = stmt.run(...params);

      if (result.changes === 0) {
        return null;
      }

      return this.findById(id);
    } catch (error) {
      this.handleError('update image', error as Error);
    }
  }

  /**
   * Update last scanned timestamp
   */
  public updateLastScanned(id: number): boolean {
    this.logOperation('update last scanned', { id });

    try {
      const stmt = this.db.prepare(
        'UPDATE images SET last_scanned_at = CURRENT_TIMESTAMP WHERE id = ?',
      );
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      this.handleError('update last scanned', error as Error);
    }
  }

  /**
   * Delete an image record
   */
  public delete(id: number): boolean {
    this.logOperation('delete image', { id });

    try {
      const stmt = this.db.prepare('DELETE FROM images WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      this.handleError('delete image', error as Error);
    }
  }

  /**
   * Delete image by path
   */
  public deleteByPath(path: string): boolean {
    this.logOperation('delete image by path', { path });

    try {
      const stmt = this.db.prepare('DELETE FROM images WHERE path = ?');
      const result = stmt.run(path);
      return result.changes > 0;
    } catch (error) {
      this.handleError('delete image by path', error as Error);
    }
  }

  /**
   * Get all images (with pagination)
   */
  public findAll(limit = 100, offset = 0): ImageRecord[] {
    this.logOperation('find all images', { limit, offset });

    try {
      const stmt = this.db.prepare(
        'SELECT * FROM images ORDER BY created_at DESC LIMIT ? OFFSET ?',
      );
      return stmt.all(limit, offset) as ImageRecord[];
    } catch (error) {
      this.handleError('find all images', error as Error);
    }
  }

  /**
   * Count total images
   */
  public count(): number {
    this.logOperation('count images');

    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM images');
      const result = stmt.get() as { count: number };
      return result.count;
    } catch (error) {
      this.handleError('count images', error as Error);
    }
  }

  /**
   * Get images that are potential duplicates (have same hash)
   */
  public findDuplicates(): ImageRecord[] {
    this.logOperation('find duplicates');

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM images 
        WHERE hash IN (
          SELECT hash FROM images 
          GROUP BY hash 
          HAVING COUNT(*) > 1
        )
        ORDER BY hash, created_at
      `);
      return stmt.all() as ImageRecord[];
    } catch (error) {
      this.handleError('find duplicates', error as Error);
    }
  }

  /**
   * Batch create images
   */
  public batchCreate(images: Omit<ImageRecord, 'id' | 'created_at'>[]): number {
    this.logOperation('batch create images', { count: images.length });

    try {
      return this.transaction(() => {
        const stmt = this.db.prepare(`
          INSERT INTO images (
            path, hash, perceptual_hash, size, width, height, format,
            modified_at, file_modified_at, last_scanned_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);

        let created = 0;
        for (const image of images) {
          try {
            this.validateRequired(image, ['path', 'hash', 'size']);

            stmt.run(
              image.path,
              image.hash,
              image.perceptual_hash || null,
              image.size,
              image.width || null,
              image.height || null,
              image.format || null,
              image.modified_at || null,
              image.file_modified_at || null,
            );
            created++;
          } catch (error) {
            // Log individual failures but continue batch
            this.logOperation('batch create image failed', {
              path: image.path,
              error: (error as Error).message,
            });
          }
        }

        return created;
      });
    } catch (error) {
      this.handleError('batch create images', error as Error);
    }
  }

  /**
   * Upsert an image (insert or update if exists)
   */
  public upsert(image: Omit<ImageRecord, 'id' | 'created_at'>): ImageRecord {
    this.logOperation('upsert image', { path: image.path });

    try {
      const existing = this.findByPath(image.path);

      if (existing) {
        return this.update(existing.id!, image) || existing;
      } else {
        return this.create(image);
      }
    } catch (error) {
      this.handleError('upsert image', error as Error);
    }
  }
}
