"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.App = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const DirectorySelector_1 = require("./components/DirectorySelector");
const App = () => {
    const [currentDirectory, setCurrentDirectory] = (0, react_1.useState)(null);
    const [stats, setStats] = (0, react_1.useState)({ imageCount: 0, duplicateCount: 0 });
    const [isLoading, setIsLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [fileEvents, setFileEvents] = (0, react_1.useState)([]);
    // Load initial directory and stats on component mount
    (0, react_1.useEffect)(() => {
        loadInitialData();
        setupFileEventListeners();
    }, []);
    const loadInitialData = async () => {
        try {
            setIsLoading(true);
            // Load current directory
            const dirResponse = await window.electronAPI.directory.getRoot();
            if (dirResponse.success && dirResponse.data) {
                setCurrentDirectory(dirResponse.data);
            }
            // Load database stats
            await loadStats();
        }
        catch (err) {
            console.error('Failed to load initial data:', err);
            setError('Failed to load application data');
        }
        finally {
            setIsLoading(false);
        }
    };
    const loadStats = async () => {
        try {
            const [imageCountResponse, duplicateCountResponse] = await Promise.all([
                window.electronAPI.database.getImageCount(),
                window.electronAPI.database.getDuplicateCount()
            ]);
            setStats({
                imageCount: imageCountResponse.success ? imageCountResponse.data || 0 : 0,
                duplicateCount: duplicateCountResponse.success ? duplicateCountResponse.data || 0 : 0,
                lastScanTime: Date.now()
            });
        }
        catch (err) {
            console.error('Failed to load stats:', err);
        }
    };
    const setupFileEventListeners = () => {
        // Listen for file changes
        window.electronAPI.directory.onFileAdded((filePath) => {
            setFileEvents(prev => [...prev.slice(-9), `Added: ${filePath}`]);
            loadStats(); // Refresh stats when files change
        });
        window.electronAPI.directory.onFileRemoved((filePath) => {
            setFileEvents(prev => [...prev.slice(-9), `Removed: ${filePath}`]);
            loadStats();
        });
        window.electronAPI.directory.onFileChanged((filePath) => {
            setFileEvents(prev => [...prev.slice(-9), `Changed: ${filePath}`]);
        });
        window.electronAPI.directory.onWatcherError((error) => {
            console.error('Directory watcher error:', error);
            setError(`Directory watching error: ${error}`);
        });
    };
    const handleDirectorySelected = async (dirPath) => {
        try {
            setIsLoading(true);
            setError(null);
            // Validate directory
            const validResponse = await window.electronAPI.directory.isValid(dirPath);
            if (!validResponse.success || !validResponse.data) {
                throw new Error('Selected directory is not valid or accessible');
            }
            // Set as root directory
            const setResponse = await window.electronAPI.directory.setRoot(dirPath);
            if (!setResponse.success) {
                throw new Error(setResponse.error || 'Failed to set directory');
            }
            setCurrentDirectory(setResponse.data);
            // Start initial scan
            const scanResponse = await window.electronAPI.directory.scan();
            if (scanResponse.success) {
                console.log('Directory scan completed:', scanResponse.data);
            }
            // Refresh stats
            await loadStats();
        }
        catch (err) {
            console.error('Failed to set directory:', err);
            setError(err instanceof Error ? err.message : 'Failed to set directory');
        }
        finally {
            setIsLoading(false);
        }
    };
    const handleClearDirectory = async () => {
        try {
            setIsLoading(true);
            setError(null);
            const response = await window.electronAPI.directory.clearRoot();
            if (response.success) {
                setCurrentDirectory(null);
                setStats({ imageCount: 0, duplicateCount: 0 });
                setFileEvents([]);
            }
            else {
                throw new Error(response.error || 'Failed to clear directory');
            }
        }
        catch (err) {
            console.error('Failed to clear directory:', err);
            setError(err instanceof Error ? err.message : 'Failed to clear directory');
        }
        finally {
            setIsLoading(false);
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { style: styles.container, children: [(0, jsx_runtime_1.jsxs)("header", { style: styles.header, children: [(0, jsx_runtime_1.jsx)("h1", { style: styles.title, children: "\uD83D\uDDC2\uFE0F Photo Management App" }), (0, jsx_runtime_1.jsx)("p", { style: styles.subtitle, children: "Clean Electron + React + TypeScript" })] }), error && ((0, jsx_runtime_1.jsxs)("div", { style: styles.errorBanner, children: [(0, jsx_runtime_1.jsxs)("span", { children: ["\u274C ", error] }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setError(null), style: styles.closeButton, children: "\u00D7" })] })), (0, jsx_runtime_1.jsxs)("main", { style: styles.main, children: [(0, jsx_runtime_1.jsx)(DirectorySelector_1.DirectorySelector, { currentDirectory: currentDirectory, onDirectorySelected: handleDirectorySelected, onClearDirectory: handleClearDirectory, isLoading: isLoading }), currentDirectory && ((0, jsx_runtime_1.jsxs)("div", { style: styles.statsSection, children: [(0, jsx_runtime_1.jsx)("h3", { style: styles.sectionTitle, children: "\uD83D\uDCCA Statistics" }), (0, jsx_runtime_1.jsxs)("div", { style: styles.statsGrid, children: [(0, jsx_runtime_1.jsxs)("div", { style: styles.statCard, children: [(0, jsx_runtime_1.jsx)("div", { style: styles.statNumber, children: stats.imageCount }), (0, jsx_runtime_1.jsx)("div", { style: styles.statLabel, children: "Images" })] }), (0, jsx_runtime_1.jsxs)("div", { style: styles.statCard, children: [(0, jsx_runtime_1.jsx)("div", { style: styles.statNumber, children: stats.duplicateCount }), (0, jsx_runtime_1.jsx)("div", { style: styles.statLabel, children: "Duplicate Groups" })] })] }), stats.lastScanTime && ((0, jsx_runtime_1.jsxs)("p", { style: styles.lastScan, children: ["Last updated: ", new Date(stats.lastScanTime).toLocaleTimeString()] }))] })), fileEvents.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { style: styles.eventsSection, children: [(0, jsx_runtime_1.jsx)("h3", { style: styles.sectionTitle, children: "\uD83D\uDCDD Recent File Events" }), (0, jsx_runtime_1.jsx)("div", { style: styles.eventsList, children: fileEvents.map((event, index) => ((0, jsx_runtime_1.jsx)("div", { style: styles.eventItem, children: event }, index))) })] })), isLoading && ((0, jsx_runtime_1.jsxs)("div", { style: styles.loadingOverlay, children: [(0, jsx_runtime_1.jsx)("div", { style: styles.spinner }), (0, jsx_runtime_1.jsx)("p", { children: "Processing..." })] }))] })] }));
};
exports.App = App;
const styles = {
    container: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        margin: 0,
        padding: '20px',
        backgroundColor: '#f5f5f5',
        minHeight: '100vh',
        color: '#333'
    },
    header: {
        textAlign: 'center',
        marginBottom: '30px'
    },
    title: {
        fontSize: '28px',
        margin: '0 0 10px 0',
        color: '#2c3e50'
    },
    subtitle: {
        fontSize: '14px',
        color: '#7f8c8d',
        margin: 0
    },
    errorBanner: {
        backgroundColor: '#e74c3c',
        color: 'white',
        padding: '12px 16px',
        borderRadius: '6px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    closeButton: {
        background: 'none',
        border: 'none',
        color: 'white',
        fontSize: '18px',
        cursor: 'pointer',
        padding: '0 4px'
    },
    main: {
        maxWidth: '800px',
        margin: '0 auto',
        position: 'relative'
    },
    statsSection: {
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        marginTop: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    sectionTitle: {
        fontSize: '18px',
        margin: '0 0 16px 0',
        color: '#2c3e50'
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '16px',
        marginBottom: '16px'
    },
    statCard: {
        textAlign: 'center',
        padding: '16px',
        backgroundColor: '#ecf0f1',
        borderRadius: '6px'
    },
    statNumber: {
        fontSize: '24px',
        fontWeight: 'bold',
        color: '#3498db',
        marginBottom: '4px'
    },
    statLabel: {
        fontSize: '12px',
        color: '#7f8c8d',
        textTransform: 'uppercase'
    },
    lastScan: {
        fontSize: '12px',
        color: '#95a5a6',
        margin: 0,
        textAlign: 'center'
    },
    eventsSection: {
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '8px',
        marginTop: '20px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    eventsList: {
        maxHeight: '200px',
        overflowY: 'auto'
    },
    eventItem: {
        padding: '8px 12px',
        backgroundColor: '#f8f9fa',
        borderRadius: '4px',
        marginBottom: '8px',
        fontSize: '13px',
        fontFamily: 'Monaco, Consolas, monospace',
        color: '#495057'
    },
    loadingOverlay: {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '16px'
    },
    spinner: {
        width: '40px',
        height: '40px',
        border: '4px solid rgba(255,255,255,0.3)',
        borderTop: '4px solid white',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '16px'
    }
};
//# sourceMappingURL=App.js.map