import React from 'react';

interface DirectoryInfo {
  path: string;
  name: string;
  isValid: boolean;
  lastAccessed?: number;
}

interface DirectorySelectorProps {
  currentDirectory: DirectoryInfo | null;
  onDirectorySelected: (dirPath: string) => void;
  onClearDirectory: () => void;
  isLoading: boolean;
}

export const DirectorySelector: React.FC<DirectorySelectorProps> = ({
  currentDirectory,
  onDirectorySelected,
  onClearDirectory,
  isLoading
}) => {
  const handleSelectDirectory = async () => {
    try {
      const response = await window.electronAPI.openDirectory();

      if (response.success && response.data) {
        onDirectorySelected(response.data);
      } else if (response.error) {
        console.error('Directory selection failed:', response.error);
      }
      // If no data and no error, user likely cancelled the dialog
    } catch (error) {
      console.error('Failed to open directory dialog:', error);
    }
  };

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-gray-800 mb-5">Root Directory</h2>

      {!currentDirectory ? (
        <div className="text-center py-10 px-5">
          <div className="text-5xl mb-4">🗂️</div>
          <p className="text-base text-gray-500 mb-6 leading-relaxed">
            No root directory selected. Choose a folder containing your photos to get started.
          </p>
          <button
            onClick={handleSelectDirectory}
            disabled={isLoading}
            className="btn-primary text-base px-6 py-3"
          >
            {isLoading ? 'Processing...' : 'Select Photo Directory'}
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-start mb-4">
            <div className="text-2xl mr-3 mt-0.5">
              {currentDirectory.isValid ? '📁' : '❌'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-lg font-semibold text-gray-800 mb-1 break-words">
                {currentDirectory.name}
              </div>
              <div className="text-sm text-gray-500 font-mono mb-1 break-all bg-gray-50 px-2 py-1 rounded border border-gray-200">
                {currentDirectory.path}
              </div>
              {currentDirectory.lastAccessed && (
                <div className="text-xs text-gray-400 italic">
                  Last accessed: {new Date(currentDirectory.lastAccessed).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {!currentDirectory.isValid && (
            <div className="bg-yellow-100 text-yellow-800 px-3 py-3 rounded-lg mb-4 border border-yellow-300">
              ⚠️ This directory is no longer accessible. Please select a new directory.
            </div>
          )}

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleSelectDirectory}
              disabled={isLoading}
              className="btn-secondary"
            >
              Change Directory
            </button>
            <button
              onClick={onClearDirectory}
              disabled={isLoading}
              className="btn-danger"
            >
              Clear Directory
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
