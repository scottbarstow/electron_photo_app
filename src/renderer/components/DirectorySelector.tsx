import React from 'react';
import { useDirectory } from '../contexts/DirectoryContext';

const DirectorySelector: React.FC = () => {
  console.log('DirectorySelector: Component rendering...');
  const { state, actions } = useDirectory();
  console.log('DirectorySelector: State and actions loaded', {
    state,
    actions,
  });

  const handleSelectDirectory = async () => {
    try {
      const selectedPath = await actions.selectDirectory();
      if (selectedPath) {
        console.log('Directory selected:', selectedPath);
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
    }
  };

  const handleClearDirectory = async () => {
    try {
      await actions.clearDirectory();
      console.log('Directory cleared');
    } catch (error) {
      console.error('Failed to clear directory:', error);
    }
  };

  const handleToggleWatching = async () => {
    try {
      if (state.isWatching) {
        await actions.stopWatching();
      } else {
        await actions.startWatching();
      }
    } catch (error) {
      console.error('Failed to toggle watching:', error);
    }
  };

  const handleRefresh = async () => {
    try {
      await actions.refreshDirectoryInfo();
      console.log('Directory info refreshed');
    } catch (error) {
      console.error('Failed to refresh directory info:', error);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <div
      style={{
        padding: '20px',
        maxWidth: '800px',
        backgroundColor: '#f0f8ff',
        border: '2px solid #4CAF50',
        borderRadius: '8px',
        margin: '20px 0',
      }}
    >
      <h2 style={{ color: '#2196F3', marginTop: 0 }}>
        🗂️ Directory Management
      </h2>

      {/* Error Display */}
      {state.error && (
        <div
          style={{
            background: '#fee',
            border: '1px solid #fcc',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '20px',
            color: '#c00',
          }}
        >
          <strong>Error:</strong> {state.error}
        </div>
      )}

      {/* Loading Indicator */}
      {state.isLoading && (
        <div
          style={{
            background: '#eff',
            border: '1px solid #cdf',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '20px',
            color: '#05c',
          }}
        >
          Loading...
        </div>
      )}

      {/* Directory Actions */}
      <div
        style={{
          marginBottom: '20px',
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
        }}
      >
        <button onClick={handleSelectDirectory} disabled={state.isLoading}>
          Select Directory
        </button>

        {state.rootDirectory && (
          <>
            <button onClick={handleClearDirectory} disabled={state.isLoading}>
              Clear Directory
            </button>

            <button onClick={handleToggleWatching} disabled={state.isLoading}>
              {state.isWatching ? 'Stop Watching' : 'Start Watching'}
            </button>

            <button onClick={handleRefresh} disabled={state.isLoading}>
              Refresh Info
            </button>

            <button onClick={actions.clearRecentChanges}>
              Clear Recent Changes
            </button>
          </>
        )}
      </div>

      {/* Current Directory Info */}
      {state.rootDirectory ? (
        <div>
          <h3>Current Directory</h3>
          <div
            style={{
              background: '#f9f9f9',
              padding: '15px',
              borderRadius: '4px',
              marginBottom: '20px',
              border: '1px solid #ddd',
            }}
          >
            <div style={{ marginBottom: '10px' }}>
              <strong>Path:</strong> {state.rootDirectory}
            </div>

            {state.directoryInfo && (
              <>
                <div style={{ marginBottom: '5px' }}>
                  <strong>Status:</strong>{' '}
                  {state.directoryInfo.accessible ? (
                    <span style={{ color: '#0a0' }}>✓ Accessible</span>
                  ) : (
                    <span style={{ color: '#a00' }}>✗ Not Accessible</span>
                  )}
                </div>
                <div style={{ marginBottom: '5px' }}>
                  <strong>Exists:</strong>{' '}
                  {state.directoryInfo.exists ? (
                    <span style={{ color: '#0a0' }}>✓ Yes</span>
                  ) : (
                    <span style={{ color: '#a00' }}>✗ No</span>
                  )}
                </div>
                <div style={{ marginBottom: '5px' }}>
                  <strong>Is Directory:</strong>{' '}
                  {state.directoryInfo.isDirectory ? (
                    <span style={{ color: '#0a0' }}>✓ Yes</span>
                  ) : (
                    <span style={{ color: '#a00' }}>✗ No</span>
                  )}
                </div>
                <div>
                  <strong>Last Checked:</strong>{' '}
                  {new Date(state.directoryInfo.lastChecked).toLocaleString()}
                </div>
              </>
            )}

            {state.directoryStats && (
              <div style={{ marginTop: '15px' }}>
                <h4>Statistics</h4>
                <div style={{ marginBottom: '5px' }}>
                  <strong>Total Files:</strong>{' '}
                  {state.directoryStats.totalFiles.toLocaleString()}
                </div>
                <div style={{ marginBottom: '5px' }}>
                  <strong>Total Directories:</strong>{' '}
                  {state.directoryStats.totalDirectories.toLocaleString()}
                </div>
                <div style={{ marginBottom: '5px' }}>
                  <strong>Image Files:</strong>{' '}
                  {state.directoryStats.imageFiles.toLocaleString()}
                </div>
                <div style={{ marginBottom: '5px' }}>
                  <strong>Total Size:</strong>{' '}
                  {formatFileSize(state.directoryStats.totalSize)}
                </div>
                {state.directoryStats.lastScanned && (
                  <div>
                    <strong>Last Scanned:</strong>{' '}
                    {new Date(
                      state.directoryStats.lastScanned,
                    ).toLocaleString()}
                  </div>
                )}
              </div>
            )}

            <div style={{ marginTop: '15px' }}>
              <strong>Watching:</strong>{' '}
              {state.isWatching ? (
                <span style={{ color: '#0a0' }}>✓ Active</span>
              ) : (
                <span style={{ color: '#888' }}>○ Inactive</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: '#fff8dc',
            border: '1px solid #f0e68c',
            padding: '15px',
            borderRadius: '4px',
            marginBottom: '20px',
          }}
        >
          No directory selected. Click &quot;Select Directory&quot; to choose a
          photo directory.
        </div>
      )}

      {/* Recent Changes */}
      {state.recentChanges.length > 0 && (
        <div>
          <h3>Recent Changes ({state.recentChanges.length})</h3>
          <div
            style={{
              maxHeight: '200px',
              overflowY: 'auto',
              background: '#f9f9f9',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          >
            {state.recentChanges.map((change, index) => (
              <div
                key={index}
                style={{
                  padding: '8px 12px',
                  borderBottom:
                    index < state.recentChanges.length - 1
                      ? '1px solid #eee'
                      : undefined,
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                >
                  <span
                    style={{
                      fontWeight: 'bold',
                      color:
                        change.type === 'add' || change.type === 'addDir'
                          ? '#0a0'
                          : change.type === 'unlink' ||
                              change.type === 'unlinkDir'
                            ? '#a00'
                            : '#08c',
                    }}
                  >
                    {change.type.toUpperCase()}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: '0.9em' }}>
                    {change.path.length > 60
                      ? `...${change.path.slice(-60)}`
                      : change.path}
                  </span>
                </div>
                {change.stats && (
                  <div
                    style={{
                      marginTop: '4px',
                      fontSize: '0.8em',
                      color: '#666',
                    }}
                  >
                    {change.stats.isFile &&
                      `Size: ${formatFileSize(change.stats.size)}`}
                    {change.stats.modified &&
                      ` • Modified: ${new Date(change.stats.modified).toLocaleString()}`}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DirectorySelector;
