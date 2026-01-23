import React, { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { FixedSizeGrid as Grid, GridChildComponentProps } from 'react-window';

export interface ImageItem {
  id: number;
  path: string;
  filename: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  isLoading?: boolean;
  error?: boolean;
}

interface ThumbnailGridProps {
  images: ImageItem[];
  selectedIds: Set<number>;
  onSelectImage: (id: number, multiSelect: boolean) => void;
  onDoubleClickImage: (id: number) => void;
  onLoadThumbnail: (path: string) => Promise<string>;
  thumbnailSize?: number;
  gap?: number;
  className?: string;
}

export const ThumbnailGrid: React.FC<ThumbnailGridProps> = ({
  images,
  selectedIds,
  onSelectImage,
  onDoubleClickImage,
  onLoadThumbnail,
  thumbnailSize = 150,
  gap = 8,
  className = ''
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [thumbnailUrls, setThumbnailUrls] = useState<Map<string, string>>(new Map());
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());

  // Calculate grid dimensions
  const cellSize = thumbnailSize + gap;
  const columnCount = Math.max(1, Math.floor((containerWidth - gap) / cellSize));
  const rowCount = Math.ceil(images.length / columnCount);

  // Track container width for responsive columns
  useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const width = rect.width || containerRef.current.clientWidth || containerRef.current.offsetWidth;
        if (width > 0) {
          setContainerWidth(width);
        }
      }
    };

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });

    observer.observe(containerRef.current);

    // Initial measurement with delays to ensure layout is complete
    updateWidth();
    const timeoutId1 = setTimeout(updateWidth, 50);
    const timeoutId2 = setTimeout(updateWidth, 200);
    // Also try after next animation frame
    requestAnimationFrame(() => {
      updateWidth();
      requestAnimationFrame(updateWidth);
    });

    return () => {
      observer.disconnect();
      clearTimeout(timeoutId1);
      clearTimeout(timeoutId2);
    };
  }, []);

  // Load thumbnail for a given path
  const loadThumbnail = useCallback(async (imagePath: string) => {
    if (thumbnailUrls.has(imagePath) || loadingPaths.has(imagePath)) {
      return;
    }

    setLoadingPaths(prev => new Set(prev).add(imagePath));

    try {
      const url = await onLoadThumbnail(imagePath);
      setThumbnailUrls(prev => new Map(prev).set(imagePath, url));
    } catch (error) {
      console.error(`Failed to load thumbnail for ${imagePath}:`, error);
      setThumbnailUrls(prev => new Map(prev).set(imagePath, ''));
    } finally {
      setLoadingPaths(prev => {
        const next = new Set(prev);
        next.delete(imagePath);
        return next;
      });
    }
  }, [thumbnailUrls, loadingPaths, onLoadThumbnail]);

  // Get image at grid position
  const getImageAtPosition = useCallback((rowIndex: number, columnIndex: number): ImageItem | null => {
    const index = rowIndex * columnCount + columnIndex;
    return images[index] || null;
  }, [images, columnCount]);

  // Queue for images needing thumbnail load
  const pendingLoadsRef = useRef<Set<string>>(new Set());
  const [loadTrigger, setLoadTrigger] = useState(0);

  // Manual double-click detection (native double-click breaks due to re-render on click)
  const lastClickRef = useRef<{ id: number; time: number } | null>(null);
  const DOUBLE_CLICK_THRESHOLD = 300; // ms

  // Process pending thumbnail loads
  useEffect(() => {
    if (pendingLoadsRef.current.size === 0) return;

    const toLoad = Array.from(pendingLoadsRef.current);
    pendingLoadsRef.current.clear();

    toLoad.forEach(imagePath => {
      if (!thumbnailUrls.has(imagePath) && !loadingPaths.has(imagePath)) {
        loadThumbnail(imagePath);
      }
    });
  }, [loadTrigger, thumbnailUrls, loadingPaths, loadThumbnail]);

  // Cell renderer for react-window
  const Cell = useMemo(() => {
    return ({ columnIndex, rowIndex, style }: GridChildComponentProps) => {
      const image = getImageAtPosition(rowIndex, columnIndex);

      if (!image) {
        return <div style={style} />;
      }

      const isSelected = selectedIds.has(image.id);
      const thumbnailUrl = thumbnailUrls.get(image.path);
      const isLoading = loadingPaths.has(image.path);

      // Queue thumbnail loading (processed via effect after render)
      if (!thumbnailUrl && !isLoading && image.path && !pendingLoadsRef.current.has(image.path)) {
        pendingLoadsRef.current.add(image.path);
        // Trigger load processing after render completes
        requestAnimationFrame(() => setLoadTrigger(t => t + 1));
      }

      return (
        <div
          style={{
            ...style,
            left: (style.left as number) + gap / 2,
            top: (style.top as number) + gap / 2,
            width: (style.width as number) - gap,
            height: (style.height as number) - gap,
          }}
        >
          <div
            className={`
              thumbnail-item h-full w-full bg-gray-100
              ${isSelected ? 'selected ring-blue-500' : ''}
            `}
            onClick={(e) => {
              const now = Date.now();
              const lastClick = lastClickRef.current;

              // Check for double-click
              if (lastClick && lastClick.id === image.id && (now - lastClick.time) < DOUBLE_CLICK_THRESHOLD) {
                lastClickRef.current = null;
                onDoubleClickImage(image.id);
                return;
              }

              // Single click
              lastClickRef.current = { id: image.id, time: now };
              onSelectImage(image.id, e.ctrlKey || e.metaKey);
            }}
            role="option"
            aria-selected={isSelected}
            tabIndex={0}
          >
            {isLoading ? (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={image.filename}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            )}

            {/* Filename overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
              <p className="text-white text-xs truncate">{image.filename}</p>
            </div>
          </div>
        </div>
      );
    };
  }, [
    getImageAtPosition,
    selectedIds,
    thumbnailUrls,
    loadingPaths,
    onSelectImage,
    onDoubleClickImage,
    gap
  ]);

  // Re-measure when images change (container might now be visible)
  useEffect(() => {
    if (containerRef.current && images.length > 0 && containerWidth === 0) {
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width > 0) {
        setContainerWidth(rect.width);
      }
    }
  }, [images.length, containerWidth]);

  if (images.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-lg font-medium">No images</p>
          <p className="text-sm">Select a folder to view images</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`h-full w-full ${className}`}>
      {containerWidth > 0 && (
        <Grid
          className="scrollbar-thin"
          columnCount={columnCount}
          columnWidth={cellSize}
          height={containerRef.current?.clientHeight || 500}
          rowCount={rowCount}
          rowHeight={cellSize}
          width={containerWidth}
          overscanRowCount={2}
        >
          {Cell}
        </Grid>
      )}
    </div>
  );
};

// Types for react-window
declare module 'react-window' {
  export interface FixedSizeGridProps {
    overscanRowCount?: number;
  }
}

// Simple thumbnail item component for non-virtualized use
interface SimpleThumbnailProps {
  image: ImageItem;
  isSelected: boolean;
  thumbnailUrl?: string;
  onClick: (multiSelect: boolean) => void;
  onDoubleClick: () => void;
}

export const SimpleThumbnail: React.FC<SimpleThumbnailProps> = ({
  image,
  isSelected,
  thumbnailUrl,
  onClick,
  onDoubleClick
}) => {
  return (
    <div
      className={`
        thumbnail-item aspect-square bg-gray-100 relative
        ${isSelected ? 'selected ring-blue-500' : ''}
      `}
      onClick={(e) => onClick(e.ctrlKey || e.metaKey)}
      onDoubleClick={onDoubleClick}
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={image.filename}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-gray-400">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
        <p className="text-white text-xs truncate">{image.filename}</p>
      </div>
    </div>
  );
};

// Hook for keyboard navigation in the thumbnail grid
export function useThumbnailGridKeyboard(
  images: ImageItem[],
  selectedIds: Set<number>,
  columnCount: number,
  onSelect: (id: number, multiSelect: boolean) => void,
  onOpen: (id: number) => void,
  onDelete?: (ids: number[]) => void
) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (images.length === 0) return;

    // Get the currently focused image (first selected or first in list)
    const selectedArray = Array.from(selectedIds);
    const currentId = selectedArray.length > 0
      ? selectedArray[selectedArray.length - 1]
      : images[0]?.id;

    const currentIndex = images.findIndex(img => img.id === currentId);
    if (currentIndex === -1) return;

    const isShiftHeld = e.shiftKey;
    const isCtrlOrMeta = e.ctrlKey || e.metaKey;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        if (currentIndex < images.length - 1) {
          onSelect(images[currentIndex + 1].id, isShiftHeld || isCtrlOrMeta);
        }
        break;

      case 'ArrowLeft':
        e.preventDefault();
        if (currentIndex > 0) {
          onSelect(images[currentIndex - 1].id, isShiftHeld || isCtrlOrMeta);
        }
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (currentIndex + columnCount < images.length) {
          onSelect(images[currentIndex + columnCount].id, isShiftHeld || isCtrlOrMeta);
        }
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (currentIndex - columnCount >= 0) {
          onSelect(images[currentIndex - columnCount].id, isShiftHeld || isCtrlOrMeta);
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (currentId !== undefined) {
          onOpen(currentId);
        }
        break;

      case 'Delete':
      case 'Backspace':
        if (onDelete && selectedIds.size > 0) {
          e.preventDefault();
          onDelete(Array.from(selectedIds));
        }
        break;

      case 'a':
        if (isCtrlOrMeta) {
          e.preventDefault();
          // Select all
          images.forEach(img => onSelect(img.id, true));
        }
        break;

      case 'Escape':
        e.preventDefault();
        // Deselect all by selecting nothing
        if (selectedIds.size > 0 && images.length > 0) {
          onSelect(images[0].id, false);
        }
        break;

      case 'Home':
        e.preventDefault();
        if (images.length > 0) {
          onSelect(images[0].id, isShiftHeld || isCtrlOrMeta);
        }
        break;

      case 'End':
        e.preventDefault();
        if (images.length > 0) {
          onSelect(images[images.length - 1].id, isShiftHeld || isCtrlOrMeta);
        }
        break;
    }
  }, [images, selectedIds, columnCount, onSelect, onOpen, onDelete]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
