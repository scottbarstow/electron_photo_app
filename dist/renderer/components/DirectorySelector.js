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
    return ((0, jsx_runtime_1.jsxs)("div", { className: "card", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold text-gray-800 mb-5", children: "Root Directory" }), !currentDirectory ? ((0, jsx_runtime_1.jsxs)("div", { className: "text-center py-10 px-5", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-5xl mb-4", children: "\uD83D\uDDC2\uFE0F" }), (0, jsx_runtime_1.jsx)("p", { className: "text-base text-gray-500 mb-6 leading-relaxed", children: "No root directory selected. Choose a folder containing your photos to get started." }), (0, jsx_runtime_1.jsx)("button", { onClick: handleSelectDirectory, disabled: isLoading, className: "btn-primary text-base px-6 py-3", children: isLoading ? 'Processing...' : 'Select Photo Directory' })] })) : ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-start mb-4", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-2xl mr-3 mt-0.5", children: currentDirectory.isValid ? '📁' : '❌' }), (0, jsx_runtime_1.jsxs)("div", { className: "flex-1 min-w-0", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-lg font-semibold text-gray-800 mb-1 break-words", children: currentDirectory.name }), (0, jsx_runtime_1.jsx)("div", { className: "text-sm text-gray-500 font-mono mb-1 break-all bg-gray-50 px-2 py-1 rounded border border-gray-200", children: currentDirectory.path }), currentDirectory.lastAccessed && ((0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-gray-400 italic", children: ["Last accessed: ", new Date(currentDirectory.lastAccessed).toLocaleString()] }))] })] }), !currentDirectory.isValid && ((0, jsx_runtime_1.jsx)("div", { className: "bg-yellow-100 text-yellow-800 px-3 py-3 rounded-lg mb-4 border border-yellow-300", children: "\u26A0\uFE0F This directory is no longer accessible. Please select a new directory." })), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-3 flex-wrap", children: [(0, jsx_runtime_1.jsx)("button", { onClick: handleSelectDirectory, disabled: isLoading, className: "btn-secondary", children: "Change Directory" }), (0, jsx_runtime_1.jsx)("button", { onClick: onClearDirectory, disabled: isLoading, className: "btn-danger", children: "Clear Directory" })] })] }))] }));
};
exports.DirectorySelector = DirectorySelector;
//# sourceMappingURL=DirectorySelector.js.map