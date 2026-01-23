import React, { useState, useEffect, useCallback } from 'react';
import { Tag } from '../App';

interface TagManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onTagsChanged: () => void;
}

// Predefined color palette for quick selection
const COLOR_PALETTE = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#6b7280', // gray
];

export const TagManager: React.FC<TagManagerProps> = ({
  isOpen,
  onClose,
  onTagsChanged
}) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New tag form state
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6b7280');
  const [isCreating, setIsCreating] = useState(false);

  // Editing state
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  // Search/filter
  const [searchQuery, setSearchQuery] = useState('');

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Track image counts for each tag
  const [tagImageCounts, setTagImageCounts] = useState<Map<number, number>>(new Map());

  // Load tags when modal opens
  useEffect(() => {
    if (isOpen) {
      loadTags();
    }
  }, [isOpen]);

  const loadTags = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await window.electronAPI.tags.getAll();
      if (response.success && response.data) {
        setTags(response.data);
        // Load image counts for each tag
        await loadTagImageCounts(response.data);
      } else {
        setError(response.error || 'Failed to load tags');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTagImageCounts = async (tagList: Tag[]) => {
    const counts = new Map<number, number>();
    for (const tag of tagList) {
      try {
        const response = await window.electronAPI.tags.getImages(tag.id);
        if (response.success && response.data) {
          counts.set(tag.id, response.data.length);
        }
      } catch (err) {
        // Ignore errors for individual counts
      }
    }
    setTagImageCounts(counts);
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    setIsCreating(true);
    setError(null);
    try {
      const response = await window.electronAPI.tags.create(newTagName.trim(), newTagColor);
      if (response.success) {
        setNewTagName('');
        setNewTagColor('#6b7280');
        await loadTags();
        onTagsChanged();
      } else {
        setError(response.error || 'Failed to create tag');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartEdit = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const handleCancelEdit = () => {
    setEditingTagId(null);
    setEditName('');
    setEditColor('');
  };

  const handleSaveEdit = async () => {
    if (!editingTagId || !editName.trim()) return;

    setError(null);
    try {
      const response = await window.electronAPI.tags.update(editingTagId, {
        name: editName.trim(),
        color: editColor
      });
      if (response.success) {
        setEditingTagId(null);
        await loadTags();
        onTagsChanged();
      } else {
        setError(response.error || 'Failed to update tag');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const handleDeleteTag = async (tagId: number) => {
    setError(null);
    try {
      const response = await window.electronAPI.tags.delete(tagId);
      if (response.success) {
        setDeleteConfirmId(null);
        await loadTags();
        onTagsChanged();
      } else {
        setError(response.error || 'Failed to delete tag');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Filter tags by search query
  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Manage Tags</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 text-red-600 px-6 py-2 text-sm flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="hover:opacity-80">x</button>
          </div>
        )}

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100">
          <input
            type="text"
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Tag List */}
        <div className="flex-1 overflow-y-auto px-6 py-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : filteredTags.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery ? 'No tags match your search' : 'No tags yet. Create one below!'}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTags.map(tag => (
                <div
                  key={tag.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 group"
                >
                  {editingTagId === tag.id ? (
                    // Edit mode
                    <>
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="color"
                          value={editColor}
                          onChange={(e) => setEditColor(e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer border-0"
                        />
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                        />
                      </div>
                      <button
                        onClick={handleSaveEdit}
                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                        title="Save"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                        title="Cancel"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </>
                  ) : deleteConfirmId === tag.id ? (
                    // Delete confirmation
                    <>
                      <span className="text-sm text-red-600 flex-1">Delete "{tag.name}"?</span>
                      <button
                        onClick={() => handleDeleteTag(tag.id)}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    // View mode
                    <>
                      <span
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="flex-1 text-sm text-gray-700">{tag.name}</span>
                      <span className="text-xs text-gray-400">
                        {tagImageCounts.get(tag.id) || 0} images
                      </span>
                      <button
                        onClick={() => handleStartEdit(tag)}
                        className="p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(tag.id)}
                        className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create New Tag Form */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm font-medium text-gray-700 mb-2">Create New Tag</div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0"
              title="Choose color"
            />
            <input
              type="text"
              placeholder="Tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateTag();
              }}
            />
            <button
              onClick={handleCreateTag}
              disabled={!newTagName.trim() || isCreating}
              className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </div>
          {/* Quick color palette */}
          <div className="flex gap-1 mt-2">
            {COLOR_PALETTE.map(color => (
              <button
                key={color}
                onClick={() => setNewTagColor(color)}
                className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${
                  newTagColor === color ? 'ring-2 ring-offset-1 ring-blue-500' : ''
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
