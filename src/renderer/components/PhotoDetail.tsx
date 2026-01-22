import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ExifPanel, ExifData } from './ExifPanel';

export interface PhotoDetailProps {
  imagePath: string;
  allImages: Array<{ id: number; path: string; filename: string }>;
  onClose: () => void;
  onNavigate: (imagePath: string) => void;
}

type ZoomMode = 'fit' | 'fill' | '100' | 'custom';

export const PhotoDetail: React.FC<PhotoDetailProps> = ({
  imagePath,
  allImages,
  onClose,
  onNavigate
}) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoomMode, setZoomMode] = useState<ZoomMode>('fit');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showExif, setShowExif] = useState(true);
  const [exifData, setExifData] = useState<ExifData | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Find current image index
  const currentIndex = allImages.findIndex(img => img.path === imagePath);
  const currentImage = allImages[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < allImages.length - 1;

  // Load full-resolution image
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });

    // Use custom photo:// protocol registered in main process
    // Use 'localhost' as host to avoid URL parsing issues with paths starting with /
    const photoUrl = `photo://localhost${imagePath}`;
    setImageUrl(photoUrl);
  }, [imagePath]);

  // Load EXIF data
  useEffect(() => {
    const loadExif = async () => {
      try {
        const response = await window.electronAPI.exif.extract(imagePath);
        if (response.success && response.data) {
          setExifData(response.data);
        }
      } catch (err) {
        console.error('Failed to load EXIF:', err);
      }
    };
    loadExif();
  }, [imagePath]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          if (hasPrev) {
            onNavigate(allImages[currentIndex - 1].path);
          }
          break;
        case 'ArrowRight':
          if (hasNext) {
            onNavigate(allImages[currentIndex + 1].path);
          }
          break;
        case '+':
        case '=':
          handleZoomIn();
          break;
        case '-':
          handleZoomOut();
          break;
        case '0':
          setZoomMode('fit');
          setZoomLevel(1);
          setPanOffset({ x: 0, y: 0 });
          break;
        case '1':
          setZoomMode('100');
          setZoomLevel(1);
          setPanOffset({ x: 0, y: 0 });
          break;
        case 'i':
          setShowExif(prev => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onNavigate, hasPrev, hasNext, currentIndex, allImages]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setIsLoading(false);
    const img = e.currentTarget;
    setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
  };

  const handleImageError = () => {
    setIsLoading(false);
    setError('Failed to load image');
  };

  const handleZoomIn = () => {
    setZoomMode('custom');
    setZoomLevel(prev => Math.min(prev * 1.25, 5));
  };

  const handleZoomOut = () => {
    setZoomMode('custom');
    setZoomLevel(prev => Math.max(prev / 1.25, 0.1));
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoomMode('custom');
      setZoomLevel(prev => Math.max(0.1, Math.min(5, prev * delta)));
    }
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomMode === 'custom' || zoomMode === '100') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const getImageStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      transition: isPanning ? 'none' : 'transform 0.2s ease-out',
      transformOrigin: 'center center',
      cursor: (zoomMode === 'custom' || zoomMode === '100') ? (isPanning ? 'grabbing' : 'grab') : 'default'
    };

    switch (zoomMode) {
      case 'fit':
        return {
          ...base,
          maxWidth: showExif ? 'calc(100vw - 320px - 2rem)' : 'calc(100vw - 2rem)',
          maxHeight: 'calc(100vh - 2rem)',
          objectFit: 'contain'
        };
      case 'fill':
        return {
          ...base,
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        };
      case '100':
        return {
          ...base,
          transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
          maxWidth: 'none',
          maxHeight: 'none'
        };
      case 'custom':
        return {
          ...base,
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
          maxWidth: 'none',
          maxHeight: 'none'
        };
      default:
        return base;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Main image area */}
      <div
        ref={containerRef}
        className={`flex-1 h-full flex items-center justify-center overflow-hidden relative ${showExif ? 'mr-80' : ''}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-red-400 text-center">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p>{error}</p>
          </div>
        )}

        {imageUrl && (
          <img
            ref={imageRef}
            src={imageUrl}
            alt={currentImage?.filename || ''}
            style={getImageStyle()}
            onLoad={handleImageLoad}
            onError={handleImageError}
            draggable={false}
            className={isLoading ? 'opacity-0' : 'opacity-100'}
          />
        )}

        {/* Navigation arrows */}
        {hasPrev && (
          <button
            onClick={() => onNavigate(allImages[currentIndex - 1].path)}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            title="Previous (Left Arrow)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {hasNext && (
          <button
            onClick={() => onNavigate(allImages[currentIndex + 1].path)}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            title="Next (Right Arrow)"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Top toolbar */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent">
          <div className="flex items-center justify-between">
            <div className="text-white">
              <h2 className="text-lg font-medium truncate max-w-md">{currentImage?.filename}</h2>
              <p className="text-sm text-gray-300">
                {currentIndex + 1} of {allImages.length}
                {imageSize && ` | ${imageSize.width} x ${imageSize.height}`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Zoom controls */}
              <div className="flex items-center bg-black/50 rounded-lg">
                <button
                  onClick={handleZoomOut}
                  className="p-2 text-white hover:bg-white/20 rounded-l-lg transition-colors"
                  title="Zoom Out (-)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <span className="px-2 text-white text-sm min-w-[4rem] text-center">
                  {zoomMode === 'fit' ? 'Fit' : zoomMode === 'fill' ? 'Fill' : zoomMode === '100' ? '100%' : `${Math.round(zoomLevel * 100)}%`}
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-2 text-white hover:bg-white/20 rounded-r-lg transition-colors"
                  title="Zoom In (+)"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              {/* Zoom mode buttons */}
              <div className="flex bg-black/50 rounded-lg">
                <button
                  onClick={() => { setZoomMode('fit'); setPanOffset({ x: 0, y: 0 }); }}
                  className={`px-3 py-2 text-sm rounded-l-lg transition-colors ${zoomMode === 'fit' ? 'bg-white/30 text-white' : 'text-gray-300 hover:bg-white/20'}`}
                  title="Fit to Screen (0)"
                >
                  Fit
                </button>
                <button
                  onClick={() => { setZoomMode('100'); setPanOffset({ x: 0, y: 0 }); }}
                  className={`px-3 py-2 text-sm rounded-r-lg transition-colors ${zoomMode === '100' ? 'bg-white/30 text-white' : 'text-gray-300 hover:bg-white/20'}`}
                  title="Actual Size (1)"
                >
                  100%
                </button>
              </div>

              {/* Toggle EXIF panel */}
              <button
                onClick={() => setShowExif(prev => !prev)}
                className={`p-2 rounded-lg transition-colors ${showExif ? 'bg-white/30 text-white' : 'bg-black/50 text-gray-300 hover:bg-white/20'}`}
                title="Toggle Info Panel (I)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>

              {/* Close button */}
              <button
                onClick={onClose}
                className="p-2 bg-black/50 hover:bg-white/20 rounded-lg text-white transition-colors"
                title="Close (Escape)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom info bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
          <p className="text-gray-400 text-sm truncate">{imagePath}</p>
        </div>
      </div>

      {/* EXIF Panel */}
      {showExif && (
        <ExifPanel
          exifData={exifData}
          imagePath={imagePath}
          onClose={() => setShowExif(false)}
        />
      )}
    </div>
  );
};

