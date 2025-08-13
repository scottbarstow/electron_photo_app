import { BaseRepository } from './base-repository';

export interface DirectoryRecord {
  id?: number;
  path: string;
  parent_id?: number;
  is_scanned: boolean;
  last_scan_at?: string;
  created_at?: string;
}

export interface DirectoryTreeNode extends DirectoryRecord {
  children: DirectoryTreeNode[];
  image_count?: number;
}

export interface DirectorySearchOptions {
  parent_id?: number;
  is_scanned?: boolean;
  path_contains?: string;
  limit?: number;
  offset?: number;
}

export class DirectoryRepository extends BaseRepository {
  /**
   * Create a new directory record
   */
  public create(
    directory: Omit<DirectoryRecord, 'id' | 'created_at'>,
  ): DirectoryRecord {
    this.validateRequired(directory, ['path']);
    this.logOperation('create directory', { path: directory.path });

    try {
      const stmt = this.db.prepare(`
        INSERT INTO directory_index (path, parent_id, is_scanned, last_scan_at) 
        VALUES (?, ?, ?, ?)
      `);

      const result = stmt.run(
        directory.path,
        directory.parent_id || null,
        directory.is_scanned ? 1 : 0,
        directory.last_scan_at || null,
      );

      return this.findById(result.lastInsertRowid as number)!;
    } catch (error) {
      this.handleError('create directory', error as Error);
    }
  }

  /**
   * Find directory by ID
   */
  public findById(id: number): DirectoryRecord | null {
    this.logOperation('find directory by id', { id });

    try {
      const stmt = this.db.prepare(
        'SELECT * FROM directory_index WHERE id = ?',
      );
      const result = stmt.get(id) as any;
      return result ? this.normalizeDirectoryRecord(result) : null;
    } catch (error) {
      this.handleError('find directory by id', error as Error);
    }
  }

  /**
   * Find directory by path
   */
  public findByPath(path: string): DirectoryRecord | null {
    this.logOperation('find directory by path', { path });

    try {
      const stmt = this.db.prepare(
        'SELECT * FROM directory_index WHERE path = ?',
      );
      const result = stmt.get(path) as any;
      return result ? this.normalizeDirectoryRecord(result) : null;
    } catch (error) {
      this.handleError('find directory by path', error as Error);
    }
  }

  /**
   * Find child directories of a parent
   */
  public findChildren(parentId: number): DirectoryRecord[] {
    this.logOperation('find child directories', { parentId });

    try {
      const stmt = this.db.prepare(
        'SELECT * FROM directory_index WHERE parent_id = ? ORDER BY path',
      );
      const results = stmt.all(parentId) as any[];
      return results.map(r => this.normalizeDirectoryRecord(r));
    } catch (error) {
      this.handleError('find child directories', error as Error);
    }
  }

  /**
   * Find root directories (no parent)
   */
  public findRoots(): DirectoryRecord[] {
    this.logOperation('find root directories');

    try {
      const stmt = this.db.prepare(
        'SELECT * FROM directory_index WHERE parent_id IS NULL ORDER BY path',
      );
      const results = stmt.all() as any[];
      return results.map(r => this.normalizeDirectoryRecord(r));
    } catch (error) {
      this.handleError('find root directories', error as Error);
    }
  }

  /**
   * Search directories with options
   */
  public search(options: DirectorySearchOptions): DirectoryRecord[] {
    this.logOperation('search directories', options);

    try {
      let query = 'SELECT * FROM directory_index WHERE 1=1';
      const params: unknown[] = [];

      if (options.parent_id !== undefined) {
        query += ' AND parent_id = ?';
        params.push(options.parent_id);
      }

      if (options.is_scanned !== undefined) {
        query += ' AND is_scanned = ?';
        params.push(options.is_scanned ? 1 : 0);
      }

      if (options.path_contains) {
        query += ' AND path LIKE ?';
        params.push(`%${options.path_contains}%`);
      }

      query += ' ORDER BY path';

      if (options.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);

        if (options.offset) {
          query += ' OFFSET ?';
          params.push(options.offset);
        }
      }

      const stmt = this.db.prepare(query);
      const results = stmt.all(...params) as any[];
      return results.map(r => this.normalizeDirectoryRecord(r));
    } catch (error) {
      this.handleError('search directories', error as Error);
    }
  }

  /**
   * Update directory record
   */
  public update(
    id: number,
    updates: Partial<Omit<DirectoryRecord, 'id' | 'created_at'>>,
  ): DirectoryRecord | null {
    this.logOperation('update directory', { id, updates });

    try {
      const fields: string[] = [];
      const params: unknown[] = [];

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === 'is_scanned') {
            fields.push(`${key} = ?`);
            params.push(value ? 1 : 0);
          } else {
            fields.push(`${key} = ?`);
            params.push(value);
          }
        }
      });

      if (fields.length === 0) {
        return this.findById(id);
      }

      params.push(id);
      const query = `UPDATE directory_index SET ${fields.join(', ')} WHERE id = ?`;
      const stmt = this.db.prepare(query);

      const result = stmt.run(...params);

      if (result.changes === 0) {
        return null;
      }

      return this.findById(id);
    } catch (error) {
      this.handleError('update directory', error as Error);
    }
  }

  /**
   * Mark directory as scanned
   */
  public markAsScanned(id: number): boolean {
    this.logOperation('mark directory as scanned', { id });

    try {
      const stmt = this.db.prepare(`
        UPDATE directory_index 
        SET is_scanned = 1, last_scan_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      this.handleError('mark directory as scanned', error as Error);
    }
  }

  /**
   * Mark directory as unscanned
   */
  public markAsUnscanned(id: number): boolean {
    this.logOperation('mark directory as unscanned', { id });

    try {
      const stmt = this.db.prepare(
        'UPDATE directory_index SET is_scanned = 0 WHERE id = ?',
      );
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      this.handleError('mark directory as unscanned', error as Error);
    }
  }

  /**
   * Delete directory record
   */
  public delete(id: number): boolean {
    this.logOperation('delete directory', { id });

    try {
      return this.transaction(() => {
        // First, update children to remove parent reference
        const updateChildrenStmt = this.db.prepare(`
          UPDATE directory_index 
          SET parent_id = (
            SELECT parent_id FROM directory_index WHERE id = ?
          ) 
          WHERE parent_id = ?
        `);
        updateChildrenStmt.run(id, id);

        // Then delete the directory
        const deleteStmt = this.db.prepare(
          'DELETE FROM directory_index WHERE id = ?',
        );
        const result = deleteStmt.run(id);

        return result.changes > 0;
      });
    } catch (error) {
      this.handleError('delete directory', error as Error);
    }
  }

  /**
   * Delete directory by path
   */
  public deleteByPath(path: string): boolean {
    this.logOperation('delete directory by path', { path });

    try {
      const directory = this.findByPath(path);
      if (directory?.id) {
        return this.delete(directory.id);
      }
      return false;
    } catch (error) {
      this.handleError('delete directory by path', error as Error);
    }
  }

  /**
   * Get directory tree starting from a root
   */
  public getTree(rootId?: number): DirectoryTreeNode[] {
    this.logOperation('get directory tree', { rootId });

    try {
      // Get all directories
      const allDirectories = this.db
        .prepare('SELECT * FROM directory_index ORDER BY path')
        .all() as any[];
      const directories = allDirectories.map(r =>
        this.normalizeDirectoryRecord(r),
      );

      // Build tree structure
      const directoryMap = new Map<number, DirectoryTreeNode>();
      const roots: DirectoryTreeNode[] = [];

      // First pass: create nodes
      for (const dir of directories) {
        const node: DirectoryTreeNode = {
          ...dir,
          children: [],
        };
        directoryMap.set(dir.id!, node);
      }

      // Second pass: build parent-child relationships
      for (const dir of directories) {
        const node = directoryMap.get(dir.id!)!;

        if (dir.parent_id && directoryMap.has(dir.parent_id)) {
          // Add to parent's children
          const parent = directoryMap.get(dir.parent_id)!;
          parent.children.push(node);
        } else if (!rootId || dir.id === rootId) {
          // Add to roots if no parent or matches requested root
          roots.push(node);
        }
      }

      // If specific root requested, return its children or the root itself
      if (rootId && directoryMap.has(rootId)) {
        return [directoryMap.get(rootId)!];
      }

      return roots;
    } catch (error) {
      this.handleError('get directory tree', error as Error);
    }
  }

  /**
   * Get directory path hierarchy (breadcrumbs)
   */
  public getPathHierarchy(id: number): DirectoryRecord[] {
    this.logOperation('get path hierarchy', { id });

    try {
      const hierarchy: DirectoryRecord[] = [];
      let currentId: number | null = id;

      while (currentId) {
        const directory = this.findById(currentId);
        if (!directory) break;

        hierarchy.unshift(directory);
        currentId = directory.parent_id || null;
      }

      return hierarchy;
    } catch (error) {
      this.handleError('get path hierarchy', error as Error);
    }
  }

  /**
   * Count directories
   */
  public count(options?: { scanned?: boolean }): number {
    this.logOperation('count directories', options);

    try {
      let query = 'SELECT COUNT(*) as count FROM directory_index';
      const params: unknown[] = [];

      if (options?.scanned !== undefined) {
        query += ' WHERE is_scanned = ?';
        params.push(options.scanned ? 1 : 0);
      }

      const stmt = this.db.prepare(query);
      const result = stmt.get(...params) as { count: number };
      return result.count;
    } catch (error) {
      this.handleError('count directories', error as Error);
    }
  }

  /**
   * Get directories that need scanning (unscanned or old scans)
   */
  public findNeedingUpdate(olderThanDays = 7): DirectoryRecord[] {
    this.logOperation('find directories needing update', { olderThanDays });

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM directory_index 
        WHERE is_scanned = 0 
           OR last_scan_at IS NULL 
           OR last_scan_at < datetime('now', '-' || ? || ' days')
        ORDER BY path
      `);

      const results = stmt.all(olderThanDays) as any[];
      return results.map(r => this.normalizeDirectoryRecord(r));
    } catch (error) {
      this.handleError('find directories needing update', error as Error);
    }
  }

  /**
   * Batch create directories
   */
  public batchCreate(
    directories: Omit<DirectoryRecord, 'id' | 'created_at'>[],
  ): number {
    this.logOperation('batch create directories', {
      count: directories.length,
    });

    try {
      return this.transaction(() => {
        const stmt = this.db.prepare(`
          INSERT OR IGNORE INTO directory_index (path, parent_id, is_scanned, last_scan_at) 
          VALUES (?, ?, ?, ?)
        `);

        let created = 0;
        for (const directory of directories) {
          try {
            this.validateRequired(directory, ['path']);

            const result = stmt.run(
              directory.path,
              directory.parent_id || null,
              directory.is_scanned ? 1 : 0,
              directory.last_scan_at || null,
            );

            if (result.changes > 0) {
              created++;
            }
          } catch (error) {
            this.logOperation('batch create directory failed', {
              path: directory.path,
              error: (error as Error).message,
            });
          }
        }

        return created;
      });
    } catch (error) {
      this.handleError('batch create directories', error as Error);
    }
  }

  /**
   * Upsert directory (insert or update if exists)
   */
  public upsert(
    directory: Omit<DirectoryRecord, 'id' | 'created_at'>,
  ): DirectoryRecord {
    this.logOperation('upsert directory', { path: directory.path });

    try {
      const existing = this.findByPath(directory.path);

      if (existing?.id) {
        return this.update(existing.id, directory) || existing;
      } else {
        return this.create(directory);
      }
    } catch (error) {
      this.handleError('upsert directory', error as Error);
    }
  }

  /**
   * Get statistics about directories
   */
  public getStats(): {
    total: number;
    scanned: number;
    unscanned: number;
    roots: number;
  } {
    this.logOperation('get directory stats');

    try {
      const total = this.count();
      const scanned = this.count({ scanned: true });
      const unscanned = this.count({ scanned: false });
      const roots = this.findRoots().length;

      return { total, scanned, unscanned, roots };
    } catch (error) {
      this.handleError('get directory stats', error as Error);
    }
  }

  // Helper method to normalize boolean fields from SQLite
  private normalizeDirectoryRecord(record: any): DirectoryRecord {
    return {
      ...record,
      is_scanned: Boolean(record.is_scanned),
    };
  }
}
