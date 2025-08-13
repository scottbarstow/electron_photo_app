import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
} from 'react';

// Types
export interface DirectoryInfo {
  path: string;
  exists: boolean;
  accessible: boolean;
  isDirectory: boolean;
  lastChecked: string;
}

export interface DirectoryStats {
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
  imageFiles: number;
  lastScanned?: string;
}

export interface DirectoryChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  stats?: {
    size: number;
    isDirectory: boolean;
    isFile: boolean;
    modified: Date;
  };
}

// State interface
export interface DirectoryState {
  rootDirectory: string | null;
  directoryInfo: DirectoryInfo | null;
  directoryStats: DirectoryStats | null;
  isWatching: boolean;
  isLoading: boolean;
  error: string | null;
  recentChanges: DirectoryChangeEvent[];
}

// Action types
export type DirectoryAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_ROOT_DIRECTORY'; payload: string | null }
  | { type: 'SET_DIRECTORY_INFO'; payload: DirectoryInfo | null }
  | { type: 'SET_DIRECTORY_STATS'; payload: DirectoryStats | null }
  | { type: 'SET_WATCHING'; payload: boolean }
  | { type: 'ADD_CHANGE_EVENT'; payload: DirectoryChangeEvent }
  | { type: 'CLEAR_CHANGE_EVENTS' }
  | { type: 'RESET_STATE' };

// Initial state
const initialState: DirectoryState = {
  rootDirectory: null,
  directoryInfo: null,
  directoryStats: null,
  isWatching: false,
  isLoading: false,
  error: null,
  recentChanges: [],
};

// Reducer
function directoryReducer(
  state: DirectoryState,
  action: DirectoryAction,
): DirectoryState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false };

    case 'SET_ROOT_DIRECTORY':
      return {
        ...state,
        rootDirectory: action.payload,
        error: null,
      };

    case 'SET_DIRECTORY_INFO':
      return { ...state, directoryInfo: action.payload };

    case 'SET_DIRECTORY_STATS':
      return { ...state, directoryStats: action.payload };

    case 'SET_WATCHING':
      return { ...state, isWatching: action.payload };

    case 'ADD_CHANGE_EVENT':
      return {
        ...state,
        recentChanges: [action.payload, ...state.recentChanges.slice(0, 49)], // Keep last 50 events
      };

    case 'CLEAR_CHANGE_EVENTS':
      return { ...state, recentChanges: [] };

    case 'RESET_STATE':
      return initialState;

    default:
      return state;
  }
}

// Context interface
export interface DirectoryContextValue {
  state: DirectoryState;
  actions: {
    selectDirectory: () => Promise<string | null>;
    setRootDirectory: (path: string) => Promise<void>;
    getRootDirectory: () => Promise<string | null>;
    getDirectoryInfo: (path?: string) => Promise<DirectoryInfo | null>;
    getDirectoryStats: (path?: string) => Promise<DirectoryStats | null>;
    validateDirectory: (path: string) => Promise<DirectoryInfo>;
    clearDirectory: () => Promise<void>;
    startWatching: () => Promise<void>;
    stopWatching: () => Promise<void>;
    refreshDirectoryInfo: () => Promise<void>;
    clearRecentChanges: () => void;
  };
}

// Create context
const DirectoryContext = createContext<DirectoryContextValue | undefined>(
  undefined,
);

// Hook to use directory context
export const useDirectory = (): DirectoryContextValue => {
  const context = useContext(DirectoryContext);
  if (!context) {
    throw new Error('useDirectory must be used within a DirectoryProvider');
  }
  return context;
};

// Provider props
interface DirectoryProviderProps {
  children: React.ReactNode;
}

// Provider component
export const DirectoryProvider: React.FC<DirectoryProviderProps> = ({
  children,
}) => {
  console.log('DirectoryProvider: Initializing...');
  const [state, dispatch] = useReducer(directoryReducer, initialState);
  console.log('DirectoryProvider: State initialized', state);

  // Helper to handle IPC calls with error handling
  const handleIpcCall = async <T,>(
    ipcCall: () => Promise<{ success: boolean; data?: T; error?: string }>,
    errorMessage: string,
  ): Promise<T | null> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'SET_ERROR', payload: null });

      const response = await ipcCall();

      if (response.success && response.data !== undefined) {
        dispatch({ type: 'SET_LOADING', payload: false });
        return response.data;
      } else {
        const error = response.error || errorMessage;
        dispatch({ type: 'SET_ERROR', payload: error });
        return null;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : errorMessage;
      dispatch({ type: 'SET_ERROR', payload: errorMsg });
      return null;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Forward declare refreshDirectoryInfo to avoid circular dependency
  const refreshDirectoryInfo = useCallback(async (): Promise<void> => {
    if (state.rootDirectory) {
      // Refresh both info and stats
      await Promise.all([
        (async () => {
          const result = (await handleIpcCall(
            () => (window as any).electron.getDirectoryInfo(),
            'Failed to get directory info',
          )) as DirectoryInfo | null;
          if (result) {
            dispatch({ type: 'SET_DIRECTORY_INFO', payload: result });
          }
        })(),
        (async () => {
          const result = (await handleIpcCall(
            () => (window as any).electron.getDirectoryStats(),
            'Failed to get directory stats',
          )) as DirectoryStats | null;
          if (result) {
            dispatch({ type: 'SET_DIRECTORY_STATS', payload: result });
          }
        })(),
      ]);

      // Check watching status
      const watchingResult = (await handleIpcCall(
        () => (window as any).electron.isWatching(),
        'Failed to check watching status',
      )) as boolean | null;

      if (watchingResult !== null) {
        dispatch({ type: 'SET_WATCHING', payload: watchingResult });
      }
    }
  }, [state.rootDirectory]);

  // Actions
  const selectDirectory = useCallback(async (): Promise<string | null> => {
    const result = (await handleIpcCall(
      () => (window as any).electron.selectDirectory(),
      'Failed to select directory',
    )) as string | null;

    if (result) {
      dispatch({ type: 'SET_ROOT_DIRECTORY', payload: result });
      // Refresh info after setting new directory
      await refreshDirectoryInfo();
    }

    return result;
  }, [refreshDirectoryInfo]);

  const setRootDirectory = useCallback(
    async (path: string): Promise<void> => {
      await handleIpcCall(
        () => (window as any).electron.setRootDirectory(path),
        'Failed to set root directory',
      );

      dispatch({ type: 'SET_ROOT_DIRECTORY', payload: path });
      await refreshDirectoryInfo();
    },
    [refreshDirectoryInfo],
  );

  const getRootDirectory = useCallback(async (): Promise<string | null> => {
    const result = (await handleIpcCall(
      () => (window as any).electron.getRootDirectory(),
      'Failed to get root directory',
    )) as string | null;

    if (result !== null) {
      dispatch({ type: 'SET_ROOT_DIRECTORY', payload: result });
    }

    return result;
  }, []);

  const getDirectoryInfo = useCallback(
    async (path?: string): Promise<DirectoryInfo | null> => {
      const result = (await handleIpcCall(
        () => (window as any).electron.getDirectoryInfo(path),
        'Failed to get directory info',
      )) as DirectoryInfo | null;

      if (result && !path) {
        // If no specific path provided, this is for the root directory
        dispatch({ type: 'SET_DIRECTORY_INFO', payload: result });
      }

      return result;
    },
    [],
  );

  const getDirectoryStats = useCallback(
    async (path?: string): Promise<DirectoryStats | null> => {
      const result = (await handleIpcCall(
        () => (window as any).electron.getDirectoryStats(path),
        'Failed to get directory stats',
      )) as DirectoryStats | null;

      if (result && !path) {
        // If no specific path provided, this is for the root directory
        dispatch({ type: 'SET_DIRECTORY_STATS', payload: result });
      }

      return result;
    },
    [],
  );

  const validateDirectory = useCallback(
    async (path: string): Promise<DirectoryInfo> => {
      const result = (await handleIpcCall(
        () => (window as any).electron.validateDirectory(path),
        'Failed to validate directory',
      )) as DirectoryInfo | null;

      // This shouldn't return null as it's a validation, but handle it just in case
      if (!result) {
        throw new Error('Failed to validate directory');
      }

      return result;
    },
    [],
  );

  const clearDirectory = useCallback(async (): Promise<void> => {
    await handleIpcCall(
      () => (window as any).electron.clearDirectory(),
      'Failed to clear directory',
    );

    dispatch({ type: 'RESET_STATE' });
  }, []);

  const startWatching = useCallback(async (): Promise<void> => {
    await handleIpcCall(
      () => (window as any).electron.startWatching(),
      'Failed to start watching directory',
    );

    dispatch({ type: 'SET_WATCHING', payload: true });
  }, []);

  const stopWatching = useCallback(async (): Promise<void> => {
    await handleIpcCall(
      () => (window as any).electron.stopWatching(),
      'Failed to stop watching directory',
    );

    dispatch({ type: 'SET_WATCHING', payload: false });
  }, []);

  const clearRecentChanges = useCallback((): void => {
    dispatch({ type: 'CLEAR_CHANGE_EVENTS' });
  }, []);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      await getRootDirectory();
      await refreshDirectoryInfo();
    };

    initialize();
  }, [getRootDirectory, refreshDirectoryInfo]);

  // Listen for directory change events
  useEffect(() => {
    const handleDirectoryChange = (event: DirectoryChangeEvent) => {
      dispatch({ type: 'ADD_CHANGE_EVENT', payload: event });
    };

    // Set up event listener
    if ((window as any).electron?.onDirectoryChanged) {
      const cleanup = (window as any).electron.onDirectoryChanged(
        handleDirectoryChange,
      );

      return cleanup;
    }
  }, []);

  const contextValue: DirectoryContextValue = {
    state,
    actions: {
      selectDirectory,
      setRootDirectory,
      getRootDirectory,
      getDirectoryInfo,
      getDirectoryStats,
      validateDirectory,
      clearDirectory,
      startWatching,
      stopWatching,
      refreshDirectoryInfo,
      clearRecentChanges,
    },
  };

  return (
    <DirectoryContext.Provider value={contextValue}>
      {children}
    </DirectoryContext.Provider>
  );
};

export default DirectoryContext;
