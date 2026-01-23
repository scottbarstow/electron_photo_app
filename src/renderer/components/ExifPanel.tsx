import React, { useState, useEffect } from 'react';

export interface ExifData {
  dateTaken?: Date | string | number;
  cameraMake?: string;
  cameraModel?: string;
  lens?: string;
  aperture?: number;
  shutterSpeed?: string;
  iso?: number;
  focalLength?: number;
  width?: number;
  height?: number;
  gpsLatitude?: number;
  gpsLongitude?: number;
  orientation?: number;
  exposureTime?: number;
  fNumber?: number;
  lensModel?: string;
}

interface ExifPanelProps {
  exifData: ExifData | null;
  imagePath: string;
  onClose: () => void;
  embedded?: boolean; // When true, renders without outer container and header
}

interface FileInfo {
  size: number;
  modified: Date;
}

export const ExifPanel: React.FC<ExifPanelProps> = ({
  exifData,
  imagePath,
  onClose,
  embedded = false
}) => {
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['camera', 'image', 'location'])
  );

  useEffect(() => {
    // Get file info via IPC
    const loadFileInfo = async () => {
      try {
        const response = await window.electronAPI.trash.getFileInfo(imagePath);
        if (response.success && response.data) {
          setFileInfo({
            size: response.data.size,
            modified: new Date(response.data.modified)
          });
        }
      } catch (err) {
        console.error('Failed to load file info:', err);
      }
    };
    loadFileInfo();
  }, [imagePath]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const formatDate = (date: Date | string | number | undefined): string => {
    if (!date) return '—';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes: number | undefined): string => {
    if (!bytes) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatShutterSpeed = (exposureTime: number | undefined): string => {
    if (!exposureTime) return '—';
    if (exposureTime >= 1) {
      return `${exposureTime}s`;
    }
    const denominator = Math.round(1 / exposureTime);
    return `1/${denominator}s`;
  };

  const formatAperture = (fNumber: number | undefined): string => {
    if (!fNumber) return '—';
    return `ƒ/${fNumber.toFixed(1)}`;
  };

  const formatFocalLength = (focalLength: number | undefined): string => {
    if (!focalLength) return '—';
    return `${Math.round(focalLength)}mm`;
  };

  const formatCoordinates = (lat: number | undefined, lng: number | undefined): string => {
    if (lat === undefined || lng === undefined) return '—';
    const latDir = lat >= 0 ? 'N' : 'S';
    const lngDir = lng >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lng).toFixed(6)}° ${lngDir}`;
  };

  const getGoogleMapsUrl = (lat: number | undefined, lng: number | undefined): string | null => {
    if (lat === undefined || lng === undefined) return null;
    return `https://www.google.com/maps?q=${lat},${lng}`;
  };

  const hasLocationData = exifData?.gpsLatitude !== undefined && exifData?.gpsLongitude !== undefined;
  const hasCameraData = exifData?.cameraMake || exifData?.cameraModel || exifData?.lens || exifData?.lensModel;
  const hasExposureData = exifData?.aperture || exifData?.fNumber || exifData?.shutterSpeed || exifData?.exposureTime || exifData?.iso || exifData?.focalLength;

  const SectionHeader: React.FC<{ title: string; section: string; hasData: boolean }> = ({ title, section, hasData }) => (
    <button
      onClick={() => toggleSection(section)}
      className={`w-full flex items-center justify-between py-2 text-left ${hasData ? 'text-white' : 'text-gray-500'}`}
      disabled={!hasData}
    >
      <span className="text-sm font-medium">{title}</span>
      {hasData && (
        <svg
          className={`w-4 h-4 transition-transform ${expandedSections.has(section) ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </button>
  );

  const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
    <div className="flex justify-between py-1.5 border-b border-gray-700/50 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-white text-sm text-right max-w-[60%] truncate">{value}</span>
    </div>
  );

  // Content that's shared between embedded and standalone modes
  const content = (
    <div className={embedded ? "space-y-4" : "p-4 space-y-4"}>
        {/* Date Section */}
        <div className="border-b border-gray-700 pb-4">
          <InfoRow label="Date Taken" value={formatDate(exifData?.dateTaken)} />
          {fileInfo && (
            <>
              <InfoRow label="File Size" value={formatFileSize(fileInfo.size)} />
              <InfoRow label="Modified" value={formatDate(fileInfo.modified)} />
            </>
          )}
        </div>

        {/* Image Dimensions */}
        <div>
          <SectionHeader title="Image" section="image" hasData={!!(exifData?.width && exifData?.height)} />
          {expandedSections.has('image') && (exifData?.width || exifData?.height) && (
            <div className="mt-2">
              <InfoRow
                label="Dimensions"
                value={exifData?.width && exifData?.height ? `${exifData.width} × ${exifData.height}` : '—'}
              />
              {exifData?.width && exifData?.height && (
                <InfoRow
                  label="Megapixels"
                  value={`${((exifData.width * exifData.height) / 1000000).toFixed(1)} MP`}
                />
              )}
              {exifData?.orientation && (
                <InfoRow label="Orientation" value={`${exifData.orientation}`} />
              )}
            </div>
          )}
        </div>

        {/* Camera Section */}
        <div>
          <SectionHeader title="Camera" section="camera" hasData={!!hasCameraData} />
          {expandedSections.has('camera') && hasCameraData && (
            <div className="mt-2">
              {(exifData?.cameraMake || exifData?.cameraModel) && (
                <InfoRow
                  label="Camera"
                  value={[exifData?.cameraMake, exifData?.cameraModel].filter(Boolean).join(' ')}
                />
              )}
              {(exifData?.lens || exifData?.lensModel) && (
                <InfoRow label="Lens" value={exifData?.lens || exifData?.lensModel || '—'} />
              )}
            </div>
          )}
        </div>

        {/* Exposure Section */}
        <div>
          <SectionHeader title="Exposure" section="exposure" hasData={!!hasExposureData} />
          {expandedSections.has('exposure') && hasExposureData && (
            <div className="mt-2">
              <InfoRow
                label="Aperture"
                value={formatAperture(exifData?.aperture || exifData?.fNumber)}
              />
              <InfoRow
                label="Shutter Speed"
                value={exifData?.shutterSpeed || formatShutterSpeed(exifData?.exposureTime)}
              />
              <InfoRow
                label="ISO"
                value={exifData?.iso ? `${exifData.iso}` : '—'}
              />
              <InfoRow
                label="Focal Length"
                value={formatFocalLength(exifData?.focalLength)}
              />
            </div>
          )}
        </div>

        {/* Location Section */}
        <div>
          <SectionHeader title="Location" section="location" hasData={hasLocationData} />
          {expandedSections.has('location') && hasLocationData && (
            <div className="mt-2">
              <InfoRow
                label="Coordinates"
                value={formatCoordinates(exifData?.gpsLatitude, exifData?.gpsLongitude)}
              />
              {getGoogleMapsUrl(exifData?.gpsLatitude, exifData?.gpsLongitude) && (
                <a
                  href={getGoogleMapsUrl(exifData?.gpsLatitude, exifData?.gpsLongitude)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-2 text-blue-400 hover:text-blue-300 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  View on Google Maps
                </a>
              )}
            </div>
          )}
        </div>

        {/* File Path */}
        <div className="border-t border-gray-700 pt-4">
          <p className="text-gray-500 text-xs break-all">{imagePath}</p>
        </div>
      </div>
  );

  // If embedded, just return the content without the outer container
  if (embedded) {
    return <div className="p-4">{content}</div>;
  }

  // Standalone mode with full container and header
  return (
    <div className="w-80 bg-gray-900 border-l border-gray-700 h-full overflow-y-auto flex-shrink-0">
      {/* Header */}
      <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <h3 className="text-white font-medium">Photo Info</h3>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-white transition-colors"
          title="Close panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {content}
    </div>
  );
};
