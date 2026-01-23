import React, { useState, useEffect, useRef } from 'react';
import { Tag } from '../App';

interface QuickTagMenuProps {
  x: number;
  y: number;
  imageIds: number[];
  onClose: () => void;
  onTagsChanged: () => void;
}

export const QuickTagMenu: React.FC<QuickTagMenuProps> = ({
  x,
  y,
  imageIds,
  onClose,
  onTagsChanged
}) => {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [imageTagIds, setImageTagIds] = useState<Map<number, Set<number>>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load all tags and current tags for selected images
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        // Load all tags
        const tagsResponse = await window.electronAPI.tags.getAll();
        if (tagsResponse.success && tagsResponse.data) {
          setAllTags(tagsResponse.data);
        }

        // Load tags for each selected image
        const tagMap = new Map<number, Set<number>>();
        for (const imageId of imageIds) {
          const response = await window.electronAPI.tags.getForImage(imageId);
          if (response.success && response.data) {
            tagMap.set(imageId, new Set(response.data.map(t => t.id)));
          }
        }
        setImageTagIds(tagMap);
      } catch (err) {
        console.error('Failed to load tags:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [imageIds]);

  // Focus input when menu opens
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  // Close when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Calculate tag state for a tag across all selected images
  const getTagState = (tagId: number): 'none' | 'some' | 'all' => {
    let hasCount = 0;
    for (const imageId of imageIds) {
      const tagSet = imageTagIds.get(imageId);
      if (tagSet?.has(tagId)) {
        hasCount++;
      }
    }
    if (hasCount === 0) return 'none';
    if (hasCount === imageIds.length) return 'all';
    return 'some';
  };

  // Toggle tag for all selected images
  const handleToggleTag = async (tag: Tag) => {
    const currentState = getTagState(tag.id);

    try {
      if (currentState === 'all') {
        // Remove from all
        for (const imageId of imageIds) {
          await window.electronAPI.tags.removeFromImage(imageId, tag.id);
        }
      } else {
        // Add to all (either none or some)
        for (const imageId of imageIds) {
          const tagSet = imageTagIds.get(imageId);
          if (!tagSet?.has(tag.id)) {
            await window.electronAPI.tags.addToImage(imageId, tag.id);
          }
        }
      }

      onTagsChanged();
      onClose();
    } catch (err) {
      console.error('Failed to toggle tag:', err);
    }
  };

  // Create new tag and add to all selected images
  const handleCreateTag = async () => {
    if (!searchQuery.trim()) return;

    setIsCreating(true);
    try {
      const createResponse = await window.electronAPI.tags.create(searchQuery.trim());
      if (createResponse.success && createResponse.data) {
        const newTagId = createResponse.data;
        // Add to all selected images
        for (const imageId of imageIds) {
          await window.electronAPI.tags.addToImage(imageId, newTagId);
        }
        onTagsChanged();
        onClose();
      }
    } catch (err) {
      console.error('Failed to create tag:', err);
    } finally {
      setIsCreating(false);
    }
  };

  // Filter tags by search
  const filteredTags = allTags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Check if we should show create option
  const exactMatch = allTags.find(t => t.name.toLowerCase() === searchQuery.toLowerCase());
  const showCreateOption = searchQuery.trim() && !exactMatch;

  // Adjust position to stay within viewport
  const adjustedStyle: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 100,
  };

  // Prevent menu from going off-screen
  if (menuRef.current) {
    const rect = menuRef.current.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) {
      adjustedStyle.left = window.innerWidth - rect.width - 8;
    }
    if (y + rect.height > window.innerHeight) {
      adjustedStyle.top = window.innerHeight - rect.height - 8;
    }
  }

  return (
    <div
      ref={menuRef}
      className="bg-white rounded-lg shadow-xl border border-gray-200 w-52 overflow-hidden"
      style={adjustedStyle}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Tags</span>
          <span className="text-xs text-gray-400">{imageIds.length} image{imageIds.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

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
              handleCreateTag();
            }
          }}
          className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Tag list */}
      <div className="max-h-48 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : filteredTags.length === 0 && !showCreateOption ? (
          <div className="px-3 py-3 text-sm text-gray-500 text-center">
            {searchQuery ? 'No matching tags' : 'No tags yet'}
          </div>
        ) : (
          <>
            {filteredTags.map(tag => {
              const state = getTagState(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => handleToggleTag(tag)}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  {/* Checkbox indicator */}
                  <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    state === 'all' ? 'bg-blue-500 border-blue-500' :
                    state === 'some' ? 'bg-blue-200 border-blue-400' :
                    'border-gray-300'
                  }`}>
                    {state === 'all' && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {state === 'some' && (
                      <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 12H4" />
                      </svg>
                    )}
                  </span>

                  {/* Tag color dot */}
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />

                  {/* Tag name */}
                  <span className="truncate">{tag.name}</span>
                </button>
              );
            })}

            {/* Create new tag option */}
            {showCreateOption && (
              <button
                onClick={handleCreateTag}
                disabled={isCreating}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-blue-50 text-blue-600 flex items-center gap-2 border-t border-gray-100"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Create "{searchQuery}"</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
