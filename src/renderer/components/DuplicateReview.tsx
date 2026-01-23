import React, { useState, useEffect, useCallback } from 'react';

// Types for duplicate detection
interface DuplicateGroup {
  hash: string;
  filesize: number;
  files: string[];
}

interface ScanProgress {
  phase: string;
  completed: number;
  total: number;
  currentFile?: string;
}

interface ScanResult {
  groups: DuplicateGroup[];
  totalWastedBytes: number;
  totalDuplicateFiles: number;
  totalGroups: number;
}

interface DuplicateReviewProps {
  rootPath: string | null;
  currentFolderPath: string | null;
  onBack: () => void;
  onRefreshStats: () => void;
  onLoadThumbnail: (imagePath: string) => Promise<string>;
}

// Format bytes to human readable size
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
}

export const DuplicateReview: React.FC<DuplicateReviewProps> = ({
  rootPath,
  currentFolderPath,
  onBack,
  onRefreshStats,
  onLoadThumbnail,
}) => {
  // Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // UI state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [groupThumbnails, setGroupThumbnails] = useState<Map<string, string>>(new Map());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [comparisonFiles, setComparisonFiles] = useState<string[] | null>(null);
  const [comparisonThumbnails, setComparisonThumbnails] = useState<Map<string, string>>(new Map());

  // Setup progress listener
  useEffect(() => {
    const removeListener = window.electronAPI.duplicates.onProgress((progress) => {
      setScanProgress(progress);
    });

    return () => {
      removeListener();
    };
  }, []);

  // Track which groups we've already started loading thumbnails for
  const loadingGroupsRef = React.useRef(new Set<string>());

  // Load thumbnails for groups
  const loadGroupThumbnail = useCallback(async (group: DuplicateGroup) => {
    if (group.files.length > 0 && !loadingGroupsRef.current.has(group.hash)) {
      loadingGroupsRef.current.add(group.hash);
      try {
        const thumbnail = await onLoadThumbnail(group.files[0]);
        if (thumbnail) {
          setGroupThumbnails(prev => new Map(prev).set(group.hash, thumbnail));
        }
      } catch (err) {
        console.error('Failed to load thumbnail for group:', err);
      }
    }
  }, [onLoadThumbnail]);

  // Load thumbnails when result changes
  useEffect(() => {
    if (scanResult?.groups) {
      scanResult.groups.slice(0, 10).forEach(loadGroupThumbnail);
    }
  }, [scanResult, loadGroupThumbnail]);

  const handleScan = async (recursive: boolean) => {
    const scanPath = recursive ? rootPath : currentFolderPath;
    if (!scanPath) {
      setScanError('No folder selected');
      return;
    }

    setIsScanning(true);
    setScanProgress({ phase: 'collecting', completed: 0, total: 0 });
    setScanError(null);
    setScanResult(null);
    setSelectedFiles(new Set());
    setExpandedGroups(new Set());

    try {
      const response = await window.electronAPI.duplicates.scan(scanPath, recursive);
      if (response.success && response.data) {
        setScanResult(response.data);
        // Don't auto-select anything - let user choose what to delete
      } else {
        setScanError(response.error || 'Scan failed');
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsScanning(false);
      setScanProgress(null);
    }
  };

  const toggleGroupExpanded = (hash: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(hash)) {
        next.delete(hash);
      } else {
        next.add(hash);
      }
      return next;
    });
  };

  const toggleFileSelected = (filePath: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
      } else {
        next.add(filePath);
      }
      return next;
    });
  };

  const selectAllDuplicates = () => {
    if (!scanResult) return;

    const toSelect = new Set<string>();
    for (const group of scanResult.groups) {
      // Skip first file (keep it), select the rest
      for (let i = 1; i < group.files.length; i++) {
        toSelect.add(group.files[i]);
      }
    }
    setSelectedFiles(toSelect);
  };

  const clearSelection = () => {
    setSelectedFiles(new Set());
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return;

    setIsDeleting(true);
    try {
      const filesToDelete = Array.from(selectedFiles);
      const response = await window.electronAPI.trash.trashFiles(filesToDelete);

      if (response.success && response.data) {
        const { successful, failed } = response.data;

        // Update scan result to remove deleted files
        if (scanResult) {
          const deletedSet = new Set(successful);
          const updatedGroups = scanResult.groups
            .map(group => ({
              ...group,
              files: group.files.filter(f => !deletedSet.has(f))
            }))
            .filter(group => group.files.length > 1); // Remove groups with less than 2 files

          // Recalculate stats
          let totalWastedBytes = 0;
          let totalDuplicateFiles = 0;
          for (const group of updatedGroups) {
            totalWastedBytes += group.filesize * (group.files.length - 1);
            totalDuplicateFiles += group.files.length - 1;
          }

          setScanResult({
            ...scanResult,
            groups: updatedGroups,
            totalWastedBytes,
            totalDuplicateFiles,
            totalGroups: updatedGroups.length
          });
        }

        // Clear selection
        setSelectedFiles(new Set());
        setShowDeleteConfirm(false);

        // Refresh app stats
        onRefreshStats();

        if (failed.length > 0) {
          setScanError(`Deleted ${successful.length} files, ${failed.length} failed`);
        }
      } else {
        setScanError(response.error || 'Delete failed');
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsDeleting(false);
    }
  };

  const openComparison = async (files: string[]) => {
    setComparisonFiles(files.slice(0, 2));

    // Load thumbnails for comparison
    const thumbnails = new Map<string, string>();
    for (const file of files.slice(0, 2)) {
      try {
        const thumb = await onLoadThumbnail(file);
        if (thumb) {
          thumbnails.set(file, thumb);
        }
      } catch (err) {
        console.error('Failed to load comparison thumbnail:', err);
      }
    }
    setComparisonThumbnails(thumbnails);
  };

  const closeComparison = () => {
    setComparisonFiles(null);
    setComparisonThumbnails(new Map());
  };

  // Calculate selected size
  const selectedSize = scanResult?.groups.reduce((total, group) => {
    const selectedInGroup = group.files.filter(f => selectedFiles.has(f));
    return total + (selectedInGroup.length * group.filesize);
  }, 0) || 0;

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="text-gray-600 hover:text-gray-800 flex items-center gap-1"
            >
              <span>&larr;</span> Back to Browser
            </button>
            <span className="text-gray-300">|</span>
            <h2 className="text-lg font-semibold text-gray-800">Duplicate Detection</h2>
          </div>
        </div>
      </div>

      {/* Scan Controls */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleScan(false)}
            disabled={isScanning || !currentFolderPath}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Scan Current Folder
          </button>
          <button
            onClick={() => handleScan(true)}
            disabled={isScanning || !rootPath}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Scan All (Recursive)
          </button>
          {currentFolderPath && (
            <span className="text-sm text-gray-500 truncate max-w-md">
              Current: {currentFolderPath}
            </span>
          )}
        </div>

        {/* Progress Bar */}
        {isScanning && scanProgress && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
              <span>
                {scanProgress.phase === 'collecting' ? 'Collecting files...' : 'Scanning...'}
              </span>
              <span>
                {scanProgress.completed} of {scanProgress.total} ({scanProgress.total > 0 ? Math.round((scanProgress.completed / scanProgress.total) * 100) : 0}%)
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${scanProgress.total > 0 ? (scanProgress.completed / scanProgress.total) * 100 : 0}%` }}
              />
            </div>
            {scanProgress.currentFile && (
              <div className="text-xs text-gray-500 mt-1 truncate">
                {scanProgress.currentFile}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
      {scanError && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-3 text-red-700 flex items-center justify-between">
          <span>{scanError}</span>
          <button onClick={() => setScanError(null)} className="text-red-500 hover:text-red-700">
            &times;
          </button>
        </div>
      )}

      {/* Results */}
      {scanResult && (
        <>
          {/* Stats Bar */}
          <div className="bg-white border-b border-gray-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm">
                <span className="font-medium text-gray-700">
                  Found <span className="text-blue-600">{scanResult.totalGroups}</span> duplicate groups
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-600">
                  <span className="font-medium text-orange-500">{scanResult.totalDuplicateFiles}</span> duplicate files
                </span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-600">
                  <span className="font-medium text-red-500">{formatSize(scanResult.totalWastedBytes)}</span> recoverable
                </span>
              </div>

              <div className="flex items-center gap-3">
                {selectedFiles.size > 0 && (
                  <>
                    <span className="text-sm text-gray-600">
                      <span className="font-medium">{selectedFiles.size}</span> selected ({formatSize(selectedSize)})
                    </span>
                    <button
                      onClick={clearSelection}
                      className="text-sm text-gray-500 hover:text-gray-700"
                    >
                      Clear
                    </button>
                  </>
                )}
                <button
                  onClick={selectAllDuplicates}
                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                  title="Selects all except the first file in each group"
                >
                  Quick Select (keep first)
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={selectedFiles.size === 0}
                  className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Delete Selected ({selectedFiles.size})
                </button>
              </div>
            </div>
          </div>

          {/* Groups List */}
          <div className="flex-1 overflow-y-auto p-4">
            {scanResult.groups.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">&#10003;</div>
                <div className="text-lg font-medium">No duplicates found</div>
                <div className="text-sm">All files in this location are unique.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {scanResult.groups.map(group => (
                  <DuplicateGroupItem
                    key={group.hash}
                    group={group}
                    isExpanded={expandedGroups.has(group.hash)}
                    onToggleExpanded={() => toggleGroupExpanded(group.hash)}
                    selectedFiles={selectedFiles}
                    onToggleFileSelected={toggleFileSelected}
                    thumbnail={groupThumbnails.get(group.hash)}
                    onCompare={() => openComparison(group.files)}
                    onLoadThumbnail={onLoadThumbnail}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* No Scan Yet */}
      {!isScanning && !scanResult && !scanError && (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-5xl mb-4">&#128269;</div>
            <div className="text-lg font-medium">Ready to scan for duplicates</div>
            <div className="text-sm mt-2">
              Click "Scan Current Folder" or "Scan All" to find duplicate photos.
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Confirm Deletion</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to move <span className="font-medium">{selectedFiles.size}</span> files
              ({formatSize(selectedSize)}) to the trash?
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Files will be moved to the system trash and can be recovered.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Move to Trash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comparison Modal */}
      {comparisonFiles && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">Compare Images</h3>
              <button
                onClick={closeComparison}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                &times;
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              {comparisonFiles.map((file, index) => (
                <div key={file} className="space-y-2">
                  <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                    {comparisonThumbnails.get(file) ? (
                      <img
                        src={comparisonThumbnails.get(file)}
                        alt={`File ${index + 1}`}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <div className="text-gray-400">Loading...</div>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 truncate" title={file}>
                    {file.split('/').pop()}
                  </div>
                  <div className="text-xs text-gray-400 truncate" title={file}>
                    {file}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component for individual duplicate groups
interface DuplicateGroupItemProps {
  group: DuplicateGroup;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  selectedFiles: Set<string>;
  onToggleFileSelected: (path: string) => void;
  thumbnail?: string;
  onCompare: () => void;
  onLoadThumbnail: (imagePath: string) => Promise<string>;
}

const DuplicateGroupItem: React.FC<DuplicateGroupItemProps> = ({
  group,
  isExpanded,
  onToggleExpanded,
  selectedFiles,
  onToggleFileSelected,
  thumbnail,
  onCompare,
  onLoadThumbnail,
}) => {
  const [fileThumbnails, setFileThumbnails] = useState<Map<string, string>>(new Map());
  const wastedSize = group.filesize * (group.files.length - 1);
  const filename = group.files[0].split('/').pop() || 'Unknown';

  // Load file thumbnails when expanded
  useEffect(() => {
    if (isExpanded) {
      group.files.forEach(async (file) => {
        if (!fileThumbnails.has(file)) {
          try {
            const thumb = await onLoadThumbnail(file);
            if (thumb) {
              setFileThumbnails(prev => new Map(prev).set(file, thumb));
            }
          } catch (err) {
            console.error('Failed to load file thumbnail:', err);
          }
        }
      });
    }
  }, [isExpanded, group.files, fileThumbnails, onLoadThumbnail]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Group Header */}
      <div
        onClick={onToggleExpanded}
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <span className="text-gray-400 w-6 text-center">
          {isExpanded ? '▼' : '▶'}
        </span>

        {/* Thumbnail */}
        <div className="w-12 h-12 bg-gray-100 rounded overflow-hidden flex-shrink-0">
          {thumbnail ? (
            <img src={thumbnail} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xl">
              &#128247;
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-800 truncate">{filename}</div>
          <div className="text-sm text-gray-500">
            {group.files.length} copies &middot; {formatSize(wastedSize)} wasted
          </div>
        </div>

        {/* Compare Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCompare();
          }}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
          title="Compare"
        >
          &#128065;
        </button>
      </div>

      {/* Expanded File List */}
      {isExpanded && (
        <div className="border-t border-gray-100">
          {group.files.map((file) => {
            const isSelected = selectedFiles.has(file);

            return (
              <div
                key={file}
                className={`flex items-center gap-3 px-3 py-2 pl-12 hover:bg-gray-50 ${
                  isSelected ? 'bg-red-50' : ''
                }`}
              >
                {/* Checkbox - user chooses what to delete */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleFileSelected(file)}
                  className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />

                {/* File Thumbnail */}
                <div className="w-10 h-10 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                  {fileThumbnails.get(file) ? (
                    <img src={fileThumbnails.get(file)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-sm">
                      &#128247;
                    </div>
                  )}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-700 truncate" title={file}>
                    {file}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatSize(group.filesize)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DuplicateReview;
