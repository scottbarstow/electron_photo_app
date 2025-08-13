// Repository exports
export { BaseRepository } from './base-repository';
export {
  ImageRepository,
  type ImageRecord,
  type ImageSearchOptions,
} from './image-repository';
export {
  DuplicateRepository,
  type DuplicateGroup,
  type DuplicateItem,
  type DuplicateGroupWithImages,
} from './duplicate-repository';
export {
  PreferencesRepository,
  type UserPreference,
  type TypedPreference,
} from './preferences-repository';
export {
  DirectoryRepository,
  type DirectoryRecord,
  type DirectoryTreeNode,
  type DirectorySearchOptions,
} from './directory-repository';

import { getDatabaseService } from '../database';
import { ImageRepository } from './image-repository';
import { DuplicateRepository } from './duplicate-repository';
import { PreferencesRepository } from './preferences-repository';
import { DirectoryRepository } from './directory-repository';

// Repository singletons
let imageRepository: ImageRepository | null = null;
let duplicateRepository: DuplicateRepository | null = null;
let preferencesRepository: PreferencesRepository | null = null;
let directoryRepository: DirectoryRepository | null = null;

/**
 * Get the image repository singleton
 */
export function getImageRepository(): ImageRepository {
  if (!imageRepository) {
    imageRepository = new ImageRepository();
  }
  return imageRepository;
}

/**
 * Get the duplicate repository singleton
 */
export function getDuplicateRepository(): DuplicateRepository {
  if (!duplicateRepository) {
    duplicateRepository = new DuplicateRepository();
  }
  return duplicateRepository;
}

/**
 * Get the preferences repository singleton
 */
export function getPreferencesRepository(): PreferencesRepository {
  if (!preferencesRepository) {
    preferencesRepository = new PreferencesRepository();
  }
  return preferencesRepository;
}

/**
 * Get the directory repository singleton
 */
export function getDirectoryRepository(): DirectoryRepository {
  if (!directoryRepository) {
    directoryRepository = new DirectoryRepository();
  }
  return directoryRepository;
}

/**
 * Initialize all repositories (should be called after database is ready)
 */
export function initializeRepositories(): void {
  const dbService = getDatabaseService();

  if (!dbService.isReady()) {
    throw new Error('Database service must be initialized before repositories');
  }

  // Initialize repository singletons
  getImageRepository();
  getDuplicateRepository();
  getPreferencesRepository();
  getDirectoryRepository();
}

/**
 * Clear repository singletons (for testing or cleanup)
 */
export function clearRepositories(): void {
  imageRepository = null;
  duplicateRepository = null;
  preferencesRepository = null;
  directoryRepository = null;
}
