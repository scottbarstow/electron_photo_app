import React, { useState, useEffect } from 'react';
import { Album } from '../App';

interface AlbumWithCount extends Album {
  imageCount: number;
  coverThumbnail: string | null;
}

interface AlbumManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onAlbumsChanged: () => void;
  onLoadThumbnail: (imagePath: string) => Promise<string>;
}

export const AlbumManager: React.FC<AlbumManagerProps> = ({
  isOpen,
  onClose,
  onAlbumsChanged,
  onLoadThumbnail
}) => {
  const [albums, setAlbums] = useState<AlbumWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDescription, setNewAlbumDescription] = useState('');
  const [editingAlbumId, setEditingAlbumId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAlbums();
    }
  }, [isOpen]);

  const loadAlbums = async () => {
    setIsLoading(true);
    try {
      const response = await window.electronAPI.albums.getAll();
      if (response.success && response.data) {
        // Load image counts and covers for each album
        const albumsWithData: AlbumWithCount[] = await Promise.all(
          response.data.map(async (album) => {
            const imagesResponse = await window.electronAPI.albums.getImages(album.id);
            const imageCount = imagesResponse.success && imagesResponse.data
              ? imagesResponse.data.length
              : 0;

            let coverThumbnail: string | null = null;
            if (album.coverImageId) {
              // Find cover image and load thumbnail
              if (imagesResponse.success && imagesResponse.data) {
                const coverImage = imagesResponse.data.find(img => img.id === album.coverImageId);
                if (coverImage) {
                  coverThumbnail = await onLoadThumbnail(coverImage.path);
                }
              }
            } else if (imagesResponse.success && imagesResponse.data && imagesResponse.data.length > 0) {
              // Use first image as cover if no cover set
              coverThumbnail = await onLoadThumbnail(imagesResponse.data[0].path);
            }

            return {
              ...album,
              imageCount,
              coverThumbnail
            };
          })
        );
        setAlbums(albumsWithData);
      }
    } catch (err) {
      console.error('Failed to load albums:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim()) return;

    setIsCreating(true);
    try {
      const response = await window.electronAPI.albums.create(
        newAlbumName.trim(),
        newAlbumDescription.trim() || undefined
      );
      if (response.success) {
        setNewAlbumName('');
        setNewAlbumDescription('');
        await loadAlbums();
        onAlbumsChanged();
      }
    } catch (err) {
      console.error('Failed to create album:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartEdit = (album: AlbumWithCount) => {
    setEditingAlbumId(album.id);
    setEditName(album.name);
    setEditDescription(album.description || '');
  };

  const handleSaveEdit = async () => {
    if (!editingAlbumId || !editName.trim()) return;

    try {
      await window.electronAPI.albums.update(editingAlbumId, {
        name: editName.trim(),
        description: editDescription.trim() || undefined
      });
      setEditingAlbumId(null);
      await loadAlbums();
      onAlbumsChanged();
    } catch (err) {
      console.error('Failed to update album:', err);
    }
  };

  const handleCancelEdit = () => {
    setEditingAlbumId(null);
    setEditName('');
    setEditDescription('');
  };

  const handleDeleteAlbum = async (albumId: number) => {
    try {
      await window.electronAPI.albums.delete(albumId);
      setDeleteConfirmId(null);
      await loadAlbums();
      onAlbumsChanged();
    } catch (err) {
      console.error('Failed to delete album:', err);
    }
  };

  // Filter albums by search
  const filteredAlbums = albums.filter(album =>
    album.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (album.description && album.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">Manage Albums</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100">
          <input
            type="text"
            placeholder="Search albums..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Album List */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : filteredAlbums.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <p>{searchQuery ? 'No albums match your search' : 'No albums yet'}</p>
              <p className="text-sm mt-1">Create your first album below</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filteredAlbums.map(album => (
                <div
                  key={album.id}
                  className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden group"
                >
                  {/* Cover Image */}
                  <div className="aspect-video bg-gray-200 relative">
                    {album.coverThumbnail ? (
                      <img
                        src={album.coverThumbnail}
                        alt={album.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}

                    {/* Hover actions */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleStartEdit(album)}
                        className="p-2 bg-white rounded-full text-gray-700 hover:bg-gray-100"
                        title="Edit album"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(album.id)}
                        className="p-2 bg-white rounded-full text-red-600 hover:bg-red-50"
                        title="Delete album"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Album Info */}
                  {editingAlbumId === album.id ? (
                    <div className="p-3 space-y-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Album name"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Description (optional)"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          className="flex-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="flex-1 px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3">
                      <h3 className="font-medium text-gray-800 truncate">{album.name}</h3>
                      {album.description && (
                        <p className="text-sm text-gray-500 truncate">{album.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">
                        {album.imageCount} image{album.imageCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create New Album Form */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Create New Album</h3>
          <div className="flex gap-3">
            <div className="flex-1 space-y-2">
              <input
                type="text"
                placeholder="Album name"
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newAlbumName.trim()) {
                    handleCreateAlbum();
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={newAlbumDescription}
                onChange={(e) => setNewAlbumDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handleCreateAlbum}
              disabled={isCreating || !newAlbumName.trim()}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed self-end"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {deleteConfirmId !== null && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10">
            <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Delete Album?</h3>
              <p className="text-gray-600 mb-4">
                This will delete the album but won't delete the photos inside it.
                This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteAlbum(deleteConfirmId)}
                  className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
