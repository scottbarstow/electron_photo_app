import { BaseRepository } from './base-repository';

export interface DuplicateGroup {
  id?: number;
  hash: string;
  count: number;
  created_at?: string;
  updated_at?: string;
}

export interface DuplicateItem {
  id?: number;
  group_id: number;
  image_id: number;
  created_at?: string;
}

export interface DuplicateGroupWithImages extends DuplicateGroup {
  images: Array<{
    id: number;
    path: string;
    size: number;
    width?: number;
    height?: number;
    format?: string;
    created_at?: string;
  }>;
}

export class DuplicateRepository extends BaseRepository {
  // Duplicate Groups Operations

  /**
   * Create a new duplicate group
   */
  public createGroup(hash: string, count = 0): DuplicateGroup {
    this.validateRequired({ hash }, ['hash']);
    this.logOperation('create duplicate group', { hash, count });

    try {
      const stmt = this.db.prepare(`
        INSERT INTO duplicate_groups (hash, count) 
        VALUES (?, ?)
      `);

      const result = stmt.run(hash, count);
      return this.findGroupById(result.lastInsertRowid as number)!;
    } catch (error) {
      this.handleError('create duplicate group', error as Error);
    }
  }

  /**
   * Find duplicate group by ID
   */
  public findGroupById(id: number): DuplicateGroup | null {
    this.logOperation('find duplicate group by id', { id });

    try {
      const stmt = this.db.prepare(
        'SELECT * FROM duplicate_groups WHERE id = ?',
      );
      const result = stmt.get(id) as DuplicateGroup | undefined;
      return result || null;
    } catch (error) {
      this.handleError('find duplicate group by id', error as Error);
    }
  }

  /**
   * Find duplicate group by hash
   */
  public findGroupByHash(hash: string): DuplicateGroup | null {
    this.logOperation('find duplicate group by hash', { hash });

    try {
      const stmt = this.db.prepare(
        'SELECT * FROM duplicate_groups WHERE hash = ?',
      );
      const result = stmt.get(hash) as DuplicateGroup | undefined;
      return result || null;
    } catch (error) {
      this.handleError('find duplicate group by hash', error as Error);
    }
  }

  /**
   * Get all duplicate groups
   */
  public findAllGroups(limit = 100, offset = 0): DuplicateGroup[] {
    this.logOperation('find all duplicate groups', { limit, offset });

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM duplicate_groups 
        WHERE count > 1 
        ORDER BY count DESC, updated_at DESC 
        LIMIT ? OFFSET ?
      `);
      return stmt.all(limit, offset) as DuplicateGroup[];
    } catch (error) {
      this.handleError('find all duplicate groups', error as Error);
    }
  }

  /**
   * Update duplicate group count
   */
  public updateGroupCount(id: number, count: number): DuplicateGroup | null {
    this.logOperation('update group count', { id, count });

    try {
      const stmt = this.db.prepare(`
        UPDATE duplicate_groups 
        SET count = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `);

      const result = stmt.run(count, id);

      if (result.changes === 0) {
        return null;
      }

      return this.findGroupById(id);
    } catch (error) {
      this.handleError('update group count', error as Error);
    }
  }

  /**
   * Delete duplicate group
   */
  public deleteGroup(id: number): boolean {
    this.logOperation('delete duplicate group', { id });

    try {
      return this.transaction(() => {
        // First delete all items in the group
        const deleteItemsStmt = this.db.prepare(
          'DELETE FROM duplicate_items WHERE group_id = ?',
        );
        deleteItemsStmt.run(id);

        // Then delete the group
        const deleteGroupStmt = this.db.prepare(
          'DELETE FROM duplicate_groups WHERE id = ?',
        );
        const result = deleteGroupStmt.run(id);

        return result.changes > 0;
      });
    } catch (error) {
      this.handleError('delete duplicate group', error as Error);
    }
  }

  // Duplicate Items Operations

  /**
   * Add image to duplicate group
   */
  public addImageToGroup(groupId: number, imageId: number): DuplicateItem {
    this.validateRequired({ groupId, imageId }, ['groupId', 'imageId']);
    this.logOperation('add image to group', { groupId, imageId });

    try {
      return this.transaction(() => {
        // Insert the duplicate item
        const insertStmt = this.db.prepare(`
          INSERT INTO duplicate_items (group_id, image_id) 
          VALUES (?, ?)
        `);

        const result = insertStmt.run(groupId, imageId);

        // Update the group count
        const countStmt = this.db.prepare(`
          UPDATE duplicate_groups 
          SET count = (
            SELECT COUNT(*) FROM duplicate_items WHERE group_id = ?
          ), updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        countStmt.run(groupId, groupId);

        return this.findItemById(result.lastInsertRowid as number)!;
      });
    } catch (error) {
      this.handleError('add image to group', error as Error);
    }
  }

  /**
   * Remove image from duplicate group
   */
  public removeImageFromGroup(groupId: number, imageId: number): boolean {
    this.logOperation('remove image from group', { groupId, imageId });

    try {
      return this.transaction(() => {
        // Delete the duplicate item
        const deleteStmt = this.db.prepare(`
          DELETE FROM duplicate_items 
          WHERE group_id = ? AND image_id = ?
        `);

        const result = deleteStmt.run(groupId, imageId);

        if (result.changes > 0) {
          // Update the group count
          const countStmt = this.db.prepare(`
            UPDATE duplicate_groups 
            SET count = (
              SELECT COUNT(*) FROM duplicate_items WHERE group_id = ?
            ), updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `);
          countStmt.run(groupId, groupId);

          // If count becomes 0 or 1, delete the group
          const group = this.findGroupById(groupId);
          if (group && group.count <= 1) {
            this.deleteGroup(groupId);
          }
        }

        return result.changes > 0;
      });
    } catch (error) {
      this.handleError('remove image from group', error as Error);
    }
  }

  /**
   * Find duplicate item by ID
   */
  public findItemById(id: number): DuplicateItem | null {
    this.logOperation('find duplicate item by id', { id });

    try {
      const stmt = this.db.prepare(
        'SELECT * FROM duplicate_items WHERE id = ?',
      );
      const result = stmt.get(id) as DuplicateItem | undefined;
      return result || null;
    } catch (error) {
      this.handleError('find duplicate item by id', error as Error);
    }
  }

  /**
   * Get all images in a duplicate group
   */
  public getImagesInGroup(groupId: number): DuplicateItem[] {
    this.logOperation('get images in group', { groupId });

    try {
      const stmt = this.db.prepare(
        'SELECT * FROM duplicate_items WHERE group_id = ?',
      );
      return stmt.all(groupId) as DuplicateItem[];
    } catch (error) {
      this.handleError('get images in group', error as Error);
    }
  }

  /**
   * Find which group an image belongs to
   */
  public findGroupByImageId(imageId: number): DuplicateItem | null {
    this.logOperation('find group by image id', { imageId });

    try {
      const stmt = this.db.prepare(
        'SELECT * FROM duplicate_items WHERE image_id = ?',
      );
      const result = stmt.get(imageId) as DuplicateItem | undefined;
      return result || null;
    } catch (error) {
      this.handleError('find group by image id', error as Error);
    }
  }

  // Complex Operations

  /**
   * Get duplicate groups with their images
   */
  public findGroupsWithImages(
    limit = 50,
    offset = 0,
  ): DuplicateGroupWithImages[] {
    this.logOperation('find groups with images', { limit, offset });

    try {
      const stmt = this.db.prepare(`
        SELECT 
          dg.*,
          i.id as image_id,
          i.path as image_path,
          i.size as image_size,
          i.width as image_width,
          i.height as image_height,
          i.format as image_format,
          i.created_at as image_created_at
        FROM duplicate_groups dg
        LEFT JOIN duplicate_items di ON dg.id = di.group_id
        LEFT JOIN images i ON di.image_id = i.id
        WHERE dg.count > 1
        ORDER BY dg.count DESC, dg.updated_at DESC
        LIMIT ? OFFSET ?
      `);

      const rows = stmt.all(limit * 10, offset * 10) as any[]; // Get more rows to account for joins

      // Group the results
      const groupsMap = new Map<number, DuplicateGroupWithImages>();

      for (const row of rows) {
        if (!groupsMap.has(row.id)) {
          groupsMap.set(row.id, {
            id: row.id,
            hash: row.hash,
            count: row.count,
            created_at: row.created_at,
            updated_at: row.updated_at,
            images: [],
          });
        }

        const group = groupsMap.get(row.id)!;
        if (row.image_id && group.images.length < 10) {
          // Limit images per group
          group.images.push({
            id: row.image_id,
            path: row.image_path,
            size: row.image_size,
            width: row.image_width,
            height: row.image_height,
            format: row.image_format,
            created_at: row.image_created_at,
          });
        }
      }

      return Array.from(groupsMap.values()).slice(0, limit);
    } catch (error) {
      this.handleError('find groups with images', error as Error);
    }
  }

  /**
   * Create or update duplicate group for a hash
   */
  public upsertGroup(hash: string, imageId: number): DuplicateGroup {
    this.logOperation('upsert group', { hash, imageId });

    try {
      return this.transaction(() => {
        let group = this.findGroupByHash(hash);

        if (!group) {
          group = this.createGroup(hash, 0);
        }

        // Check if image is already in group
        const existingItem = this.db
          .prepare(
            `
          SELECT 1 FROM duplicate_items 
          WHERE group_id = ? AND image_id = ?
        `,
          )
          .get(group.id!, imageId);

        if (!existingItem) {
          this.addImageToGroup(group.id!, imageId);
        }

        return this.findGroupById(group.id!)!;
      });
    } catch (error) {
      this.handleError('upsert group', error as Error);
    }
  }

  /**
   * Rebuild duplicate groups from images table
   */
  public rebuildDuplicateGroups(): {
    groupsCreated: number;
    itemsCreated: number;
  } {
    this.logOperation('rebuild duplicate groups');

    try {
      return this.transaction(() => {
        // Clear existing duplicate data
        this.db.prepare('DELETE FROM duplicate_items').run();
        this.db.prepare('DELETE FROM duplicate_groups').run();

        // Find all hashes that appear more than once
        const duplicateHashes = this.db
          .prepare(
            `
          SELECT hash, COUNT(*) as count
          FROM images 
          GROUP BY hash 
          HAVING count > 1
        `,
          )
          .all() as Array<{ hash: string; count: number }>;

        let groupsCreated = 0;
        let itemsCreated = 0;

        for (const { hash, count } of duplicateHashes) {
          // Create duplicate group
          const group = this.createGroup(hash, count);
          groupsCreated++;

          // Get all images with this hash
          const images = this.db
            .prepare(
              `
            SELECT id FROM images WHERE hash = ?
          `,
            )
            .all(hash) as Array<{ id: number }>;

          // Add each image to the group
          for (const image of images) {
            this.db
              .prepare(
                `
              INSERT INTO duplicate_items (group_id, image_id) 
              VALUES (?, ?)
            `,
              )
              .run(group.id!, image.id);
            itemsCreated++;
          }
        }

        return { groupsCreated, itemsCreated };
      });
    } catch (error) {
      this.handleError('rebuild duplicate groups', error as Error);
    }
  }

  /**
   * Get duplicate statistics
   */
  public getStats(): {
    totalGroups: number;
    totalDuplicateImages: number;
    largestGroupSize: number;
    potentialSpaceSaved: number;
  } {
    this.logOperation('get duplicate stats');

    try {
      const totalGroups = this.db
        .prepare(
          `
        SELECT COUNT(*) as count FROM duplicate_groups WHERE count > 1
      `,
        )
        .get() as { count: number };

      const totalDuplicateImages = this.db
        .prepare(
          `
        SELECT COUNT(*) as count FROM duplicate_items
      `,
        )
        .get() as { count: number };

      const largestGroup = this.db
        .prepare(
          `
        SELECT MAX(count) as max_count FROM duplicate_groups
      `,
        )
        .get() as { max_count: number | null };

      const spaceSaved = this.db
        .prepare(
          `
        SELECT SUM(i.size * (dg.count - 1)) as space_saved
        FROM duplicate_groups dg
        JOIN duplicate_items di ON dg.id = di.group_id
        JOIN images i ON di.image_id = i.id
        WHERE dg.count > 1
      `,
        )
        .get() as { space_saved: number | null };

      return {
        totalGroups: totalGroups.count,
        totalDuplicateImages: totalDuplicateImages.count,
        largestGroupSize: largestGroup.max_count || 0,
        potentialSpaceSaved: spaceSaved.space_saved || 0,
      };
    } catch (error) {
      this.handleError('get duplicate stats', error as Error);
    }
  }
}
