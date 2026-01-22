"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FolderTree = void 0;
exports.useFolderTreeKeyboard = useFolderTreeKeyboard;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const FolderTree = ({ rootPath, selectedPath, onSelectFolder, onLoadChildren, className = '' }) => {
    const [tree, setTree] = (0, react_1.useState)(null);
    const [loadingPaths, setLoadingPaths] = (0, react_1.useState)(new Set());
    // Initialize tree when root path changes
    (0, react_1.useEffect)(() => {
        if (rootPath) {
            initializeTree(rootPath);
        }
        else {
            setTree(null);
        }
    }, [rootPath]);
    const initializeTree = async (path) => {
        const rootName = path.split('/').pop() || path;
        const rootNode = {
            path,
            name: rootName,
            hasImages: false,
            imageCount: 0,
            isLoaded: false,
            isExpanded: true,
            depth: 0,
            children: []
        };
        setTree(rootNode);
        // Load children for root
        await loadChildrenForPath(path, rootNode);
    };
    const loadChildrenForPath = async (path, node) => {
        if (loadingPaths.has(path))
            return;
        setLoadingPaths(prev => new Set(prev).add(path));
        try {
            const children = await onLoadChildren(path);
            setTree(prevTree => {
                if (!prevTree)
                    return null;
                return updateNodeInTree(prevTree, path, {
                    children,
                    isLoaded: true
                });
            });
        }
        catch (error) {
            console.error(`Failed to load children for ${path}:`, error);
        }
        finally {
            setLoadingPaths(prev => {
                const next = new Set(prev);
                next.delete(path);
                return next;
            });
        }
    };
    const updateNodeInTree = (node, targetPath, updates) => {
        if (node.path === targetPath) {
            return { ...node, ...updates };
        }
        if (node.children) {
            return {
                ...node,
                children: node.children.map(child => updateNodeInTree(child, targetPath, updates))
            };
        }
        return node;
    };
    const handleToggleExpand = (0, react_1.useCallback)(async (node) => {
        const newExpanded = !node.isExpanded;
        setTree(prevTree => {
            if (!prevTree)
                return null;
            return updateNodeInTree(prevTree, node.path, { isExpanded: newExpanded });
        });
        // Load children if expanding and not yet loaded
        if (newExpanded && !node.isLoaded) {
            await loadChildrenForPath(node.path, node);
        }
    }, [loadingPaths]);
    const handleSelectFolder = (0, react_1.useCallback)((node) => {
        onSelectFolder(node.path);
    }, [onSelectFolder]);
    const renderNode = (node) => {
        const isSelected = node.path === selectedPath;
        const isLoading = loadingPaths.has(node.path);
        const hasChildren = node.children && node.children.length > 0;
        const canExpand = hasChildren || !node.isLoaded;
        return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: `
            folder-tree-item
            ${isSelected ? 'selected' : ''}
          `, style: { paddingLeft: `${node.depth * 16 + 8}px` }, onClick: () => handleSelectFolder(node), onDoubleClick: () => handleToggleExpand(node), role: "treeitem", "aria-selected": isSelected, "aria-expanded": node.isExpanded, children: [(0, jsx_runtime_1.jsx)("button", { className: `
              w-5 h-5 flex items-center justify-center rounded
              hover:bg-gray-200 transition-colors
              ${canExpand ? 'opacity-100' : 'opacity-0'}
            `, onClick: (e) => {
                                e.stopPropagation();
                                handleToggleExpand(node);
                            }, disabled: !canExpand, tabIndex: -1, children: isLoading ? ((0, jsx_runtime_1.jsx)("span", { className: "w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" })) : ((0, jsx_runtime_1.jsx)("svg", { className: `w-4 h-4 text-gray-500 transition-transform ${node.isExpanded ? 'rotate-90' : ''}`, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) })) }), (0, jsx_runtime_1.jsx)("span", { className: "text-lg", children: node.isExpanded ? '📂' : '📁' }), (0, jsx_runtime_1.jsx)("span", { className: "flex-1 truncate text-sm font-medium", children: node.name }), node.imageCount > 0 && ((0, jsx_runtime_1.jsx)("span", { className: "text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded", children: node.imageCount }))] }), node.isExpanded && node.children && ((0, jsx_runtime_1.jsx)("div", { role: "group", children: node.children.map(child => renderNode(child)) }))] }, node.path));
    };
    if (!rootPath) {
        return ((0, jsx_runtime_1.jsx)("div", { className: `sidebar p-4 ${className}`, children: (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-gray-500 text-center", children: "No directory selected" }) }));
    }
    return ((0, jsx_runtime_1.jsxs)("div", { className: `sidebar ${className}`, role: "tree", "aria-label": "Folder tree", children: [(0, jsx_runtime_1.jsx)("div", { className: "px-4 py-3 border-b border-gray-200", children: (0, jsx_runtime_1.jsx)("h2", { className: "text-sm font-semibold text-gray-600 uppercase tracking-wide", children: "Folders" }) }), (0, jsx_runtime_1.jsx)("div", { className: "overflow-y-auto flex-1 py-2", children: tree ? (renderNode(tree)) : ((0, jsx_runtime_1.jsx)("div", { className: "flex items-center justify-center p-4", children: (0, jsx_runtime_1.jsx)("span", { className: "w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" }) })) })] }));
};
exports.FolderTree = FolderTree;
// Utility hook for keyboard navigation
function useFolderTreeKeyboard(tree, selectedPath, onSelect, onToggleExpand) {
    const handleKeyDown = (0, react_1.useCallback)((e) => {
        if (!tree || !selectedPath)
            return;
        const flattenTree = (node) => {
            const result = [node];
            if (node.isExpanded && node.children) {
                node.children.forEach(child => {
                    result.push(...flattenTree(child));
                });
            }
            return result;
        };
        const flatNodes = flattenTree(tree);
        const currentIndex = flatNodes.findIndex(n => n.path === selectedPath);
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (currentIndex < flatNodes.length - 1) {
                    onSelect(flatNodes[currentIndex + 1].path);
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (currentIndex > 0) {
                    onSelect(flatNodes[currentIndex - 1].path);
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                const nodeToExpand = flatNodes[currentIndex];
                if (!nodeToExpand.isExpanded) {
                    onToggleExpand(nodeToExpand.path);
                }
                else if (nodeToExpand.children && nodeToExpand.children.length > 0) {
                    onSelect(nodeToExpand.children[0].path);
                }
                break;
            case 'ArrowLeft':
                e.preventDefault();
                const nodeToCollapse = flatNodes[currentIndex];
                if (nodeToCollapse.isExpanded) {
                    onToggleExpand(nodeToCollapse.path);
                }
                else if (nodeToCollapse.depth > 0) {
                    // Find parent and select it
                    const parent = flatNodes.find(n => n.children?.some(c => c.path === selectedPath));
                    if (parent) {
                        onSelect(parent.path);
                    }
                }
                break;
            case 'Enter':
            case ' ':
                e.preventDefault();
                onToggleExpand(selectedPath);
                break;
        }
    }, [tree, selectedPath, onSelect, onToggleExpand]);
    (0, react_1.useEffect)(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
}
//# sourceMappingURL=FolderTree.js.map