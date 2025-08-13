import { BaseRepository } from './base-repository';

export interface UserPreference {
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  updated_at?: string;
}

export interface TypedPreference<T> {
  key: string;
  value: T;
  type: 'string' | 'number' | 'boolean' | 'json';
  updated_at?: string;
}

export class PreferencesRepository extends BaseRepository {
  /**
   * Set a preference value
   */
  public set<T>(
    key: string,
    value: T,
    type?: 'string' | 'number' | 'boolean' | 'json',
  ): UserPreference {
    this.validateRequired({ key, value }, ['key', 'value']);

    // Auto-detect type if not provided
    const detectedType = type || this.detectType(value);
    const serializedValue = this.serializeValue(value, detectedType);

    this.logOperation('set preference', { key, type: detectedType });

    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO user_preferences (key, value, type, updated_at) 
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `);

      stmt.run(key, serializedValue, detectedType);

      return this.get(key)!;
    } catch (error) {
      this.handleError('set preference', error as Error);
    }
  }

  /**
   * Get a preference value
   */
  public get(key: string): UserPreference | null {
    this.logOperation('get preference', { key });

    try {
      const stmt = this.db.prepare(
        'SELECT * FROM user_preferences WHERE key = ?',
      );
      const result = stmt.get(key) as UserPreference | undefined;
      return result || null;
    } catch (error) {
      this.handleError('get preference', error as Error);
    }
  }

  /**
   * Get a typed preference value
   */
  public getTyped<T>(key: string, defaultValue?: T): T | null {
    const preference = this.get(key);

    if (!preference) {
      return defaultValue !== undefined ? defaultValue : null;
    }

    return this.deserializeValue<T>(preference.value, preference.type);
  }

  /**
   * Get a string preference
   */
  public getString(key: string, defaultValue?: string): string | null {
    return this.getTyped<string>(key, defaultValue);
  }

  /**
   * Get a number preference
   */
  public getNumber(key: string, defaultValue?: number): number | null {
    return this.getTyped<number>(key, defaultValue);
  }

  /**
   * Get a boolean preference
   */
  public getBoolean(key: string, defaultValue?: boolean): boolean | null {
    return this.getTyped<boolean>(key, defaultValue);
  }

  /**
   * Get a JSON preference
   */
  public getJson<T = unknown>(key: string, defaultValue?: T): T | null {
    return this.getTyped<T>(key, defaultValue);
  }

  /**
   * Set a string preference
   */
  public setString(key: string, value: string): UserPreference {
    return this.set(key, value, 'string');
  }

  /**
   * Set a number preference
   */
  public setNumber(key: string, value: number): UserPreference {
    return this.set(key, value, 'number');
  }

  /**
   * Set a boolean preference
   */
  public setBoolean(key: string, value: boolean): UserPreference {
    return this.set(key, value, 'boolean');
  }

  /**
   * Set a JSON preference
   */
  public setJson<T>(key: string, value: T): UserPreference {
    return this.set(key, value, 'json');
  }

  /**
   * Delete a preference
   */
  public delete(key: string): boolean {
    this.logOperation('delete preference', { key });

    try {
      const stmt = this.db.prepare(
        'DELETE FROM user_preferences WHERE key = ?',
      );
      const result = stmt.run(key);
      return result.changes > 0;
    } catch (error) {
      this.handleError('delete preference', error as Error);
    }
  }

  /**
   * Get all preferences
   */
  public getAll(): UserPreference[] {
    this.logOperation('get all preferences');

    try {
      const stmt = this.db.prepare(
        'SELECT * FROM user_preferences ORDER BY key',
      );
      return stmt.all() as UserPreference[];
    } catch (error) {
      this.handleError('get all preferences', error as Error);
    }
  }

  /**
   * Get preferences by key prefix
   */
  public getByPrefix(prefix: string): UserPreference[] {
    this.logOperation('get preferences by prefix', { prefix });

    try {
      const stmt = this.db.prepare(
        'SELECT * FROM user_preferences WHERE key LIKE ? ORDER BY key',
      );
      return stmt.all(`${prefix}%`) as UserPreference[];
    } catch (error) {
      this.handleError('get preferences by prefix', error as Error);
    }
  }

  /**
   * Check if preference exists
   */
  public exists(key: string): boolean {
    this.logOperation('check preference exists', { key });

    try {
      const stmt = this.db.prepare(
        'SELECT 1 FROM user_preferences WHERE key = ?',
      );
      return !!stmt.get(key);
    } catch (error) {
      this.handleError('check preference exists', error as Error);
    }
  }

  /**
   * Get preference count
   */
  public count(): number {
    this.logOperation('count preferences');

    try {
      const stmt = this.db.prepare(
        'SELECT COUNT(*) as count FROM user_preferences',
      );
      const result = stmt.get() as { count: number };
      return result.count;
    } catch (error) {
      this.handleError('count preferences', error as Error);
    }
  }

  /**
   * Batch set preferences
   */
  public batchSet(
    preferences: Array<{
      key: string;
      value: unknown;
      type?: 'string' | 'number' | 'boolean' | 'json';
    }>,
  ): number {
    this.logOperation('batch set preferences', { count: preferences.length });

    try {
      return this.transaction(() => {
        const stmt = this.db.prepare(`
          INSERT OR REPLACE INTO user_preferences (key, value, type, updated_at) 
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `);

        let updated = 0;
        for (const { key, value, type } of preferences) {
          try {
            this.validateRequired({ key, value }, ['key', 'value']);

            const detectedType = type || this.detectType(value);
            const serializedValue = this.serializeValue(value, detectedType);

            stmt.run(key, serializedValue, detectedType);
            updated++;
          } catch (error) {
            this.logOperation('batch set preference failed', {
              key,
              error: (error as Error).message,
            });
          }
        }

        return updated;
      });
    } catch (error) {
      this.handleError('batch set preferences', error as Error);
    }
  }

  /**
   * Delete preferences by key prefix
   */
  public deleteByPrefix(prefix: string): number {
    this.logOperation('delete preferences by prefix', { prefix });

    try {
      const stmt = this.db.prepare(
        'DELETE FROM user_preferences WHERE key LIKE ?',
      );
      const result = stmt.run(`${prefix}%`);
      return result.changes;
    } catch (error) {
      this.handleError('delete preferences by prefix', error as Error);
    }
  }

  /**
   * Clear all preferences
   */
  public clear(): number {
    this.logOperation('clear all preferences');

    try {
      const stmt = this.db.prepare('DELETE FROM user_preferences');
      const result = stmt.run();
      return result.changes;
    } catch (error) {
      this.handleError('clear all preferences', error as Error);
    }
  }

  /**
   * Export preferences to JSON
   */
  public export(): Record<string, unknown> {
    this.logOperation('export preferences');

    try {
      const preferences = this.getAll();
      const exported: Record<string, unknown> = {};

      for (const pref of preferences) {
        exported[pref.key] = this.deserializeValue(pref.value, pref.type);
      }

      return exported;
    } catch (error) {
      this.handleError('export preferences', error as Error);
    }
  }

  /**
   * Import preferences from JSON
   */
  public import(data: Record<string, unknown>, overwrite = false): number {
    this.logOperation('import preferences', {
      count: Object.keys(data).length,
      overwrite,
    });

    try {
      return this.transaction(() => {
        let imported = 0;

        for (const [key, value] of Object.entries(data)) {
          try {
            // Skip if exists and not overwriting
            if (!overwrite && this.exists(key)) {
              continue;
            }

            this.set(key, value);
            imported++;
          } catch (error) {
            this.logOperation('import preference failed', {
              key,
              error: (error as Error).message,
            });
          }
        }

        return imported;
      });
    } catch (error) {
      this.handleError('import preferences', error as Error);
    }
  }

  // Helper methods

  private detectType(value: unknown): 'string' | 'number' | 'boolean' | 'json' {
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    return 'json';
  }

  private serializeValue(
    value: unknown,
    type: 'string' | 'number' | 'boolean' | 'json',
  ): string {
    switch (type) {
      case 'string':
        return String(value);
      case 'number':
        return String(value);
      case 'boolean':
        return String(value);
      case 'json':
        return JSON.stringify(value);
      default:
        return String(value);
    }
  }

  private deserializeValue<T>(
    value: string,
    type: 'string' | 'number' | 'boolean' | 'json',
  ): T {
    switch (type) {
      case 'string':
        return value as T;
      case 'number':
        return Number(value) as T;
      case 'boolean':
        return (value === 'true') as T;
      case 'json':
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      default:
        return value as T;
    }
  }

  /**
   * Set default preferences if they don't exist
   */
  public setDefaults(defaults: Record<string, unknown>): number {
    this.logOperation('set default preferences', {
      count: Object.keys(defaults).length,
    });

    try {
      let set = 0;
      for (const [key, value] of Object.entries(defaults)) {
        if (!this.exists(key)) {
          this.set(key, value);
          set++;
        }
      }
      return set;
    } catch (error) {
      this.handleError('set default preferences', error as Error);
    }
  }
}
