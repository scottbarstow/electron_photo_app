import React, { useState, useEffect, useRef } from 'react';
import { Tag, Album } from '../App';

interface BatchActionsProps {
  selectedIds: Set<number>;
  onClearSelection: () => void;
  onTagsChanged: () => void;
}

export const BatchActions: React.FC<BatchActionsProps> = ({
  selectedIds,
  onClearSelection,
  onTagsChanged
}) => {
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [showAlbumDropdown, setShowAlbumDropdown] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allAlbums, setAllAlbums] = useState<Album[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);

  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const albumDropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load tags and albums when dropdowns open
  useEffect(() => {
    if (showTagDropdown) {
      loadTags();
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
    if (showAlbumDropdown) {
      loadAlbums();
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [showTagDropdown, showAlbumDropdown]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setShowTagDropdown(false);
        setSearchQuery('');
      }
      if (albumDropdownRef.current && !albumDropdownRef.current.contains(e.target as Node)) {
        setShowAlbumDropdown(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadTags = async () => {
    try {
      const response = await window.electronAPI.tags.getAll();
      if (response.success && response.data) {
        setAllTags(response.data);
      }
    } catch (err) {
      console.error('Failed to load tags:', err);
    }
  };

  const loadAlbums = async () => {
    try {
      const response = await window.electronAPI.albums.getAll();
      if (response.success && response.data) {
        setAllAlbums(response.data);
      }
    } catch (err) {
      console.error('Failed to load albums:', err);
    }
  };

  const handleAddTag = async (tag: Tag) => {
    try {
      // Add tag to all selected images
      for (const imageId of selectedIds) {
        await window.electronAPI.tags.addToImage(imageId, tag.id);
      }
      onTagsChanged();
      setShowTagDropdown(false);
      setSearchQuery('');
    } catch (err) {
      console.error('Failed to add tag:', err);
    }
  };

  const handleAddToAlbum = async (album: Album) => {
    try {
      // Add all selected images to album
      for (const imageId of selectedIds) {
        await window.electronAPI.albums.addImage(album.id, imageId);
      }
      onTagsChanged();
      setShowAlbumDropdown(false);
      setSearchQuery('');
    } catch (err) {
      console.error('Failed to add to album:', err);
    }
  };

  const handleCreateTag = async () => {
    if (!searchQuery.trim()) return;

    setIsCreatingTag(true);
    try {
      const createResponse = await window.electronAPI.tags.create(searchQuery.trim());
      if (createResponse.success && createResponse.data) {
        const newTagId = createResponse.data;
        // Add to all selected images
        for (const imageId of selectedIds) {
          await window.electronAPI.tags.addToImage(imageId, newTagId);
        }
        onTagsChanged();
        setShowTagDropdown(false);
        setSearchQuery('');
      }
    } catch (err) {
      console.error('Failed to create tag:', err);
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleCreateAlbum = async () => {
    if (!searchQuery.trim()) return;

    setIsCreatingAlbum(true);
    try {
      const createResponse = await window.electronAPI.albums.create(searchQuery.trim());
      if (createResponse.success && createResponse.data) {
        const newAlbumId = createResponse.data;
        // Add all selected images to the new album
        for (const imageId of selectedIds) {
          await window.electronAPI.albums.addImage(newAlbumId, imageId);
        }
        onTagsChanged();
        setShowAlbumDropdown(false);
        setSearchQuery('');
      }
    } catch (err) {
      console.error('Failed to create album:', err);
    } finally {
      setIsCreatingAlbum(false);
    }
  };

  // Filter tags/albums by search
  const filteredTags = allTags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredAlbums = allAlbums.filter(album =>
    album.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if search matches existing item
  const exactTagMatch = allTags.find(t => t.name.toLowerCase() === searchQuery.toLowerCase());
  const exactAlbumMatch = allAlbums.find(a => a.name.toLowerCase() === searchQuery.toLowerCase());
  const showCreateTagOption = searchQuery.trim() && !exactTagMatch;
  const showCreateAlbumOption = searchQuery.trim() && !exactAlbumMatch;


  if (selectedIds.size < 2) return null;

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <span className="text-sm text-blue-700 font-medium">
          {selectedIds.size} images selected
        </span>

        {/* Add Tags Button */}
        <div className="relative" ref={tagDropdownRef}>
          <button
            onClick={() => {
              setShowTagDropdown(!showTagDropdown);
              setShowAlbumDropdown(false);
            }}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            Add Tags
          </button>

          {showTagDropdown && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20 overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search or create tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && showCreateTagOption) {
                      handleCreateTag();
                    }
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="max-h-48 overflow-y-auto">
                {filteredTags.length === 0 && !showCreateTagOption ? (
                  <div className="px-3 py-3 text-sm text-gray-500 text-center">
                    {searchQuery ? 'No matching tags' : 'No tags yet'}
                  </div>
                ) : (
                  <>
                    {filteredTags.map(tag => (
                      <button
                        key={tag.id}
                        onClick={() => handleAddTag(tag)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="truncate">{tag.name}</span>
                      </button>
                    ))}

                    {showCreateTagOption && (
                      <button
                        onClick={handleCreateTag}
                        disabled={isCreatingTag}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 text-blue-600 flex items-center gap-2 border-t border-gray-100"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create "{searchQuery}"
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Add to Album Button */}
        <div className="relative" ref={albumDropdownRef}>
          <button
            onClick={() => {
              setShowAlbumDropdown(!showAlbumDropdown);
              setShowTagDropdown(false);
            }}
            className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            Add to Album
          </button>

          {showAlbumDropdown && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-20 overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search or create album..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && showCreateAlbumOption) {
                      handleCreateAlbum();
                    }
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="max-h-48 overflow-y-auto">
                {filteredAlbums.length === 0 && !showCreateAlbumOption ? (
                  <div className="px-3 py-3 text-sm text-gray-500 text-center">
                    {searchQuery ? 'No matching albums' : 'No albums yet'}
                  </div>
                ) : (
                  <>
                    {filteredAlbums.map(album => (
                      <button
                        key={album.id}
                        onClick={() => handleAddToAlbum(album)}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                          />
                        </svg>
                        <span className="truncate">{album.name}</span>
                      </button>
                    ))}

                    {showCreateAlbumOption && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreateAlbum();
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        disabled={isCreatingAlbum}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 text-blue-600 flex items-center gap-2 border-t border-gray-100"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Create "{searchQuery}"
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Clear Selection Button */}
      <button
        onClick={onClearSelection}
        className="text-sm text-gray-600 hover:text-gray-800"
      >
        Clear Selection
      </button>
    </div>
  );
};
