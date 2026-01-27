import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FolderTree, FolderNode } from './FolderTree';
import { Tag, Album } from '../App';
import { TagManager } from './TagManager';
import { AlbumManager } from './AlbumManager';

interface SidebarProps {
  rootPath: string | null;
  selectedFolderPath: string | null;
  onSelectFolder: (path: string) => void;
  onLoadFolderChildren: (path: string) => Promise<FolderNode[]>;
  onSelectTag: (tag: Tag | null) => void;
  onSelectAlbum: (album: Album | null) => void;
  selectedTagId: number | null;
  selectedAlbumId: number | null;
  refreshTrigger?: number; // Increment to force refresh
  onLoadThumbnail: (imagePath: string) => Promise<string>;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  rootPath,
  selectedFolderPath,
  onSelectFolder,
  onLoadFolderChildren,
  onSelectTag,
  onSelectAlbum,
  selectedTagId,
  selectedAlbumId,
  refreshTrigger = 0,
  onLoadThumbnail,
  className = ''
}) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [tagsExpanded, setTagsExpanded] = useState(true);
  const [albumsExpanded, setAlbumsExpanded] = useState(true);
  const [showTagManager, setShowTagManager] = useState(false);
  const [showAlbumManager, setShowAlbumManager] = useState(false);
  const [tagImageCounts, setTagImageCounts] = useState<Map<number, number>>(new Map());
  const [albumImageCounts, setAlbumImageCounts] = useState<Map<number, number>>(new Map());

  const loadingRef = useRef(false);

  // Load tags and albums on mount and when refreshTrigger changes
  useEffect(() => {
    // Force reload when refreshTrigger changes (not on initial mount)
    loadTagsAndAlbums(refreshTrigger > 0);
  }, [refreshTrigger]);

  const loadTagsAndAlbums = async (force = false) => {
    if (loadingRef.current && !force) return;
    loadingRef.current = true;

    try {
      // Load tags
      const tagsResponse = await window.electronAPI.tags.getAll();
      if (tagsResponse.success && tagsResponse.data) {
        setTags(tagsResponse.data);
        // Load image counts for tags
        const counts = new Map<number, number>();
        for (const tag of tagsResponse.data) {
          const imagesResponse = await window.electronAPI.tags.getImages(tag.id);
          if (imagesResponse.success && imagesResponse.data) {
            counts.set(tag.id, imagesResponse.data.length);
          }
        }
        setTagImageCounts(counts);
      }

      // Load albums
      const albumsResponse = await window.electronAPI.albums.getAll();
      if (albumsResponse.success && albumsResponse.data) {
        setAlbums(albumsResponse.data);
        // Load image counts for albums
        const counts = new Map<number, number>();
        for (const album of albumsResponse.data) {
          const imagesResponse = await window.electronAPI.albums.getImages(album.id);
          if (imagesResponse.success && imagesResponse.data) {
            counts.set(album.id, imagesResponse.data.length);
          }
        }
        setAlbumImageCounts(counts);
      }
    } catch (err) {
      console.error('Failed to load tags/albums:', err);
    } finally {
      loadingRef.current = false;
    }
  };

  const handleTagsChanged = useCallback(() => {
    loadTagsAndAlbums();
  }, []);

  const handleTagClick = (tag: Tag) => {
    // If already selected, deselect
    if (selectedTagId === tag.id) {
      onSelectTag(null);
    } else {
      // App.tsx handleSelectTag already clears album selection
      onSelectTag(tag);
    }
  };

  const handleAlbumClick = (album: Album) => {
    // If already selected, deselect
    if (selectedAlbumId === album.id) {
      onSelectAlbum(null);
    } else {
      // App.tsx handleSelectAlbum already clears tag selection
      onSelectAlbum(album);
    }
  };

  return (
    <div className={`h-full flex flex-col bg-gray-50 border-r border-gray-200 ${className}`}>
      {/* Folder Tree Section */}
      <div className="flex-shrink-0 overflow-hidden" style={{ maxHeight: '50%' }}>
        <FolderTree
          rootPath={rootPath}
          selectedPath={selectedFolderPath}
          onSelectFolder={onSelectFolder}
          onLoadChildren={onLoadFolderChildren}
          className="h-full"
        />
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200" />

      {/* Tags Section */}
      <div className="flex-shrink-0">
        <div
          className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-100"
          onClick={() => setTagsExpanded(!tagsExpanded)}
        >
          <div className="flex items-center gap-2">
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${tagsExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Tags</h2>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowTagManager(true);
            }}
            className="p-1 text-gray-400 hover:text-gray-600"
            title="Manage Tags"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {tagsExpanded && (
          <div className="px-2 pb-2 max-h-40 overflow-y-auto">
            {tags.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">No tags yet</p>
            ) : (
              <div className="space-y-0.5">
                {tags.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => handleTagClick(tag)}
                    className={`w-full px-2 py-1.5 text-left text-sm rounded flex items-center gap-2 transition-colors ${
                      selectedTagId === tag.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="truncate flex-1">{tag.name}</span>
                    <span className="text-xs text-gray-400">
                      {tagImageCounts.get(tag.id) || 0}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200" />

      {/* Albums Section */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <div
          className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-gray-100 flex-shrink-0"
          onClick={() => setAlbumsExpanded(!albumsExpanded)}
        >
          <div className="flex items-center gap-2">
            <svg
              className={`w-4 h-4 text-gray-500 transition-transform ${albumsExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Albums</h2>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAlbumManager(true);
            }}
            className="p-1 text-gray-400 hover:text-gray-600"
            title="Manage Albums"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {albumsExpanded && (
          <div className="px-2 pb-2 overflow-y-auto flex-1">
            {albums.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-2">No albums yet</p>
            ) : (
              <div className="space-y-0.5">
                {albums.map(album => (
                  <button
                    key={album.id}
                    onClick={() => handleAlbumClick(album)}
                    className={`w-full px-2 py-1.5 text-left text-sm rounded flex items-center gap-2 transition-colors ${
                      selectedAlbumId === album.id
                        ? 'bg-purple-100 text-purple-700'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                    <span className="truncate flex-1">{album.name}</span>
                    <span className="text-xs text-gray-400">
                      {albumImageCounts.get(album.id) || 0}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tag Manager Modal */}
      <TagManager
        isOpen={showTagManager}
        onClose={() => setShowTagManager(false)}
        onTagsChanged={handleTagsChanged}
      />

      {/* Album Manager Modal */}
      <AlbumManager
        isOpen={showAlbumManager}
        onClose={() => setShowAlbumManager(false)}
        onAlbumsChanged={handleTagsChanged}
        onLoadThumbnail={onLoadThumbnail}
      />
    </div>
  );
};
