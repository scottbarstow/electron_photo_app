"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DirectorySelector = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const DirectorySelector = ({ currentDirectory, onDirectorySelected, onClearDirectory, isLoading }) => {
    const handleSelectDirectory = async () => {
        try {
            const response = await window.electronAPI.openDirectory();
            if (response.success && response.data) {
                onDirectorySelected(response.data);
            }
            else if (response.error) {
                console.error('Directory selection failed:', response.error);
            }
            // If no data and no error, user likely cancelled the dialog
        }
        catch (error) {
            console.error('Failed to open directory dialog:', error);
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { style: styles.container, children: [(0, jsx_runtime_1.jsx)("h2", { style: styles.title, children: "\uD83D\uDCC1 Root Directory" }), !currentDirectory ? ((0, jsx_runtime_1.jsxs)("div", { style: styles.noDirectoryState, children: [(0, jsx_runtime_1.jsx)("div", { style: styles.icon, children: "\uD83D\uDDC2\uFE0F" }), (0, jsx_runtime_1.jsx)("p", { style: styles.message, children: "No root directory selected. Choose a folder containing your photos to get started." }), (0, jsx_runtime_1.jsx)("button", { onClick: handleSelectDirectory, disabled: isLoading, style: {
                            ...styles.primaryButton,
                            ...(isLoading ? styles.disabledButton : {})
                        }, children: isLoading ? 'Processing...' : 'Select Photo Directory' })] })) : ((0, jsx_runtime_1.jsxs)("div", { style: styles.directoryInfo, children: [(0, jsx_runtime_1.jsxs)("div", { style: styles.directoryHeader, children: [(0, jsx_runtime_1.jsx)("div", { style: styles.directoryIcon, children: currentDirectory.isValid ? '📁' : '❌' }), (0, jsx_runtime_1.jsxs)("div", { style: styles.directoryDetails, children: [(0, jsx_runtime_1.jsx)("div", { style: styles.directoryName, children: currentDirectory.name }), (0, jsx_runtime_1.jsx)("div", { style: styles.directoryPath, children: currentDirectory.path }), currentDirectory.lastAccessed && ((0, jsx_runtime_1.jsxs)("div", { style: styles.lastAccessed, children: ["Last accessed: ", new Date(currentDirectory.lastAccessed).toLocaleString()] }))] })] }), !currentDirectory.isValid && ((0, jsx_runtime_1.jsx)("div", { style: styles.warningMessage, children: "\u26A0\uFE0F This directory is no longer accessible. Please select a new directory." })), (0, jsx_runtime_1.jsxs)("div", { style: styles.buttonGroup, children: [(0, jsx_runtime_1.jsx)("button", { onClick: handleSelectDirectory, disabled: isLoading, style: {
                                    ...styles.secondaryButton,
                                    ...(isLoading ? styles.disabledButton : {})
                                }, children: "Change Directory" }), (0, jsx_runtime_1.jsx)("button", { onClick: onClearDirectory, disabled: isLoading, style: {
                                    ...styles.dangerButton,
                                    ...(isLoading ? styles.disabledButton : {})
                                }, children: "Clear Directory" })] })] }))] }));
};
exports.DirectorySelector = DirectorySelector;
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
        textAlign: 'center',
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
        wordBreak: 'break-word'
    },
    directoryPath: {
        fontSize: '14px',
        color: '#7f8c8d',
        fontFamily: 'Monaco, Consolas, monospace',
        marginBottom: '4px',
        wordBreak: 'break-all',
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
        flexWrap: 'wrap'
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
//# sourceMappingURL=DirectorySelector.js.map