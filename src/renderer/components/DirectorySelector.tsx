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
    <div style={styles.container}>
      <h2 style={styles.title}>📁 Root Directory</h2>
      
      {!currentDirectory ? (
        <div style={styles.noDirectoryState}>
          <div style={styles.icon}>🗂️</div>
          <p style={styles.message}>
            No root directory selected. Choose a folder containing your photos to get started.
          </p>
          <button 
            onClick={handleSelectDirectory}
            disabled={isLoading}
            style={{
              ...styles.primaryButton,
              ...(isLoading ? styles.disabledButton : {})
            }}
          >
            {isLoading ? 'Processing...' : 'Select Photo Directory'}
          </button>
        </div>
      ) : (
        <div style={styles.directoryInfo}>
          <div style={styles.directoryHeader}>
            <div style={styles.directoryIcon}>
              {currentDirectory.isValid ? '📁' : '❌'}
            </div>
            <div style={styles.directoryDetails}>
              <div style={styles.directoryName}>{currentDirectory.name}</div>
              <div style={styles.directoryPath}>{currentDirectory.path}</div>
              {currentDirectory.lastAccessed && (
                <div style={styles.lastAccessed}>
                  Last accessed: {new Date(currentDirectory.lastAccessed).toLocaleString()}
                </div>
              )}
            </div>
          </div>
          
          {!currentDirectory.isValid && (
            <div style={styles.warningMessage}>
              ⚠️ This directory is no longer accessible. Please select a new directory.
            </div>
          )}
          
          <div style={styles.buttonGroup}>
            <button 
              onClick={handleSelectDirectory}
              disabled={isLoading}
              style={{
                ...styles.secondaryButton,
                ...(isLoading ? styles.disabledButton : {})
              }}
            >
              Change Directory
            </button>
            <button 
              onClick={onClearDirectory}
              disabled={isLoading}
              style={{
                ...styles.dangerButton,
                ...(isLoading ? styles.disabledButton : {})
              }}
            >
              Clear Directory
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
    border: '1px solid #e1e8ed'
  },
  title: {
    fontSize: '20px',
    margin: '0 0 20px 0',
    color: '#2c3e50',
    fontWeight: '600'
  },
  noDirectoryState: {
    textAlign: 'center' as const,
    padding: '40px 20px'
  },
  icon: {
    fontSize: '48px',
    marginBottom: '16px'
  },
  message: {
    fontSize: '16px',
    color: '#7f8c8d',
    marginBottom: '24px',
    lineHeight: '1.5'
  },
  primaryButton: {
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: '#2980b9'
    }
  },
  directoryInfo: {
    padding: '0'
  },
  directoryHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    marginBottom: '16px'
  },
  directoryIcon: {
    fontSize: '24px',
    marginRight: '12px',
    marginTop: '2px'
  },
  directoryDetails: {
    flex: 1,
    minWidth: 0
  },
  directoryName: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: '4px',
    wordBreak: 'break-word' as const
  },
  directoryPath: {
    fontSize: '14px',
    color: '#7f8c8d',
    fontFamily: 'Monaco, Consolas, monospace',
    marginBottom: '4px',
    wordBreak: 'break-all' as const,
    backgroundColor: '#f8f9fa',
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid #e9ecef'
  },
  lastAccessed: {
    fontSize: '12px',
    color: '#95a5a6',
    fontStyle: 'italic'
  },
  warningMessage: {
    backgroundColor: '#fff3cd',
    color: '#856404',
    padding: '12px',
    borderRadius: '6px',
    marginBottom: '16px',
    border: '1px solid #ffeaa7'
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap' as const
  },
  secondaryButton: {
    backgroundColor: '#95a5a6',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease'
  },
  dangerButton: {
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease'
  },
  disabledButton: {
    opacity: 0.6,
    cursor: 'not-allowed'
  }
};