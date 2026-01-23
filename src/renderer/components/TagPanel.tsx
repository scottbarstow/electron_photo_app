import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tag } from '../App';

interface TagPanelProps {
  imageId: number;
  onTagsChanged?: () => void;
}

export const TagPanel: React.FC<TagPanelProps> = ({
  imageId,
  onTagsChanged
}) => {
  const [imageTags, setImageTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load tags for this image and all available tags
  useEffect(() => {
    loadTags();
  }, [imageId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setSearchQuery('');
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDropdown]);

  const loadTags = async () => {
    setIsLoading(true);
    try {
      const [imageTagsResponse, allTagsResponse] = await Promise.all([
        window.electronAPI.tags.getForImage(imageId),
        window.electronAPI.tags.getAll()
      ]);

      if (imageTagsResponse.success && imageTagsResponse.data) {
        setImageTags(imageTagsResponse.data);
      }
      if (allTagsResponse.success && allTagsResponse.data) {
        setAllTags(allTagsResponse.data);
      }
    } catch (err) {
      console.error('Failed to load tags:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTag = async (tag: Tag) => {
    try {
      const response = await window.electronAPI.tags.addToImage(imageId, tag.id);
      if (response.success) {
        setImageTags(prev => [...prev, tag]);
        onTagsChanged?.();
      }
    } catch (err) {
      console.error('Failed to add tag:', err);
    }
    setShowDropdown(false);
    setSearchQuery('');
  };

  const handleRemoveTag = async (tagId: number) => {
    try {
      const response = await window.electronAPI.tags.removeFromImage(imageId, tagId);
      if (response.success) {
        setImageTags(prev => prev.filter(t => t.id !== tagId));
        onTagsChanged?.();
      }
    } catch (err) {
      console.error('Failed to remove tag:', err);
    }
  };

  const handleCreateAndAddTag = async () => {
    if (!newTagName.trim()) return;

    setIsCreating(true);
    try {
      // Create the tag
      const createResponse = await window.electronAPI.tags.create(newTagName.trim());
      if (createResponse.success && createResponse.data) {
        const newTagId = createResponse.data;
        // Get the created tag
        const getResponse = await window.electronAPI.tags.get(newTagId);
        if (getResponse.success && getResponse.data) {
          // Add it to the image
          await window.electronAPI.tags.addToImage(imageId, newTagId);
          setImageTags(prev => [...prev, getResponse.data!]);
          setAllTags(prev => [...prev, getResponse.data!]);
          onTagsChanged?.();
        }
      }
    } catch (err) {
      console.error('Failed to create tag:', err);
    } finally {
      setIsCreating(false);
      setNewTagName('');
      setShowDropdown(false);
      setSearchQuery('');
    }
  };

  // Filter available tags (not already on image, matching search)
  const availableTags = allTags.filter(tag =>
    !imageTags.some(it => it.id === tag.id) &&
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if search query matches an existing tag
  const exactMatch = allTags.find(t => t.name.toLowerCase() === searchQuery.toLowerCase());
  const showCreateOption = searchQuery.trim() && !exactMatch;

  return (
    <div className="space-y-2">
      {/* Current tags */}
      <div className="flex flex-wrap gap-1.5">
        {isLoading ? (
          <span className="text-gray-500 text-sm">Loading...</span>
        ) : imageTags.length === 0 ? (
          <span className="text-gray-500 text-sm italic">No tags</span>
        ) : (
          imageTags.map(tag => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 group"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
              <button
                onClick={() => handleRemoveTag(tag.id)}
                className="ml-0.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove tag"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))
        )}
      </div>

      {/* Add tag dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => {
            setShowDropdown(!showDropdown);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Tag
        </button>

        {showDropdown && (
          <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10 overflow-hidden">
            {/* Search input */}
            <div className="p-2 border-b border-gray-100">
              <input
                ref={inputRef}
                type="text"
                placeholder="Search or create..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && showCreateOption) {
                    setNewTagName(searchQuery);
                    handleCreateAndAddTag();
                  }
                }}
                className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Tag list */}
            <div className="max-h-40 overflow-y-auto">
              {availableTags.length === 0 && !showCreateOption ? (
                <div className="px-3 py-2 text-sm text-gray-500">
                  {searchQuery ? 'No matching tags' : 'No more tags available'}
                </div>
              ) : (
                <>
                  {availableTags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => handleAddTag(tag)}
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="truncate">{tag.name}</span>
                    </button>
                  ))}
                  {showCreateOption && (
                    <button
                      onClick={() => {
                        setNewTagName(searchQuery);
                        handleCreateAndAddTag();
                      }}
                      disabled={isCreating}
                      className="w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50 text-blue-600 flex items-center gap-2 border-t border-gray-100"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  );
};
