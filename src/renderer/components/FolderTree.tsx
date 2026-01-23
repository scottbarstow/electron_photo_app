import React, { useState, useCallback, useEffect } from 'react';

export interface FolderNode {
  path: string;
  name: string;
  hasImages: boolean;
  imageCount: number;
  isLoaded: boolean;
  isExpanded: boolean;
  depth: number;
  children?: FolderNode[];
}

interface FolderTreeProps {
  rootPath: string | null;
  selectedPath: string | null;
  onSelectFolder: (path: string) => void;
  onLoadChildren: (path: string) => Promise<FolderNode[]>;
  className?: string;
}

export const FolderTree: React.FC<FolderTreeProps> = ({
  rootPath,
  selectedPath,
  onSelectFolder,
  onLoadChildren,
  className = ''
}) => {
  const [tree, setTree] = useState<FolderNode | null>(null);
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());

  // Initialize tree when root path changes
  useEffect(() => {
    if (rootPath) {
      initializeTree(rootPath);
    } else {
      setTree(null);
    }
  }, [rootPath]);

  const initializeTree = async (path: string) => {
    const rootName = path.split('/').pop() || path;
    const rootNode: FolderNode = {
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

  const loadChildrenForPath = async (path: string, node?: FolderNode) => {
    if (loadingPaths.has(path)) return;

    setLoadingPaths(prev => new Set(prev).add(path));

    try {
      const children = await onLoadChildren(path);

      setTree(prevTree => {
        if (!prevTree) return null;
        return updateNodeInTree(prevTree, path, {
          children,
          isLoaded: true
        });
      });
    } catch (error) {
      console.error(`Failed to load children for ${path}:`, error);
    } finally {
      setLoadingPaths(prev => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    }
  };

  const updateNodeInTree = (
    node: FolderNode,
    targetPath: string,
    updates: Partial<FolderNode>
  ): FolderNode => {
    if (node.path === targetPath) {
      return { ...node, ...updates };
    }

    if (node.children) {
      return {
        ...node,
        children: node.children.map(child =>
          updateNodeInTree(child, targetPath, updates)
        )
      };
    }

    return node;
  };

  const handleToggleExpand = useCallback(async (node: FolderNode) => {
    const newExpanded = !node.isExpanded;

    setTree(prevTree => {
      if (!prevTree) return null;
      return updateNodeInTree(prevTree, node.path, { isExpanded: newExpanded });
    });

    // Load children if expanding and not yet loaded
    if (newExpanded && !node.isLoaded) {
      await loadChildrenForPath(node.path, node);
    }
  }, [loadingPaths]);

  const handleSelectFolder = useCallback((node: FolderNode) => {
    onSelectFolder(node.path);
  }, [onSelectFolder]);

  const renderNode = (node: FolderNode): React.ReactNode => {
    const isSelected = node.path === selectedPath;
    const isLoading = loadingPaths.has(node.path);
    const hasChildren = node.children && node.children.length > 0;
    const canExpand = hasChildren || !node.isLoaded;

    return (
      <div key={node.path}>
        <div
          className={`
            folder-tree-item
            ${isSelected ? 'selected' : ''}
          `}
          style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
          onClick={() => handleSelectFolder(node)}
          onDoubleClick={() => handleToggleExpand(node)}
          role="treeitem"
          aria-selected={isSelected}
          aria-expanded={node.isExpanded}
        >
          {/* Expand/Collapse Toggle */}
          <button
            className={`
              w-5 h-5 flex items-center justify-center rounded
              hover:bg-gray-200 transition-colors
              ${canExpand ? 'opacity-100' : 'opacity-0'}
            `}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleExpand(node);
            }}
            disabled={!canExpand}
            tabIndex={-1}
          >
            {isLoading ? (
              <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg
                className={`w-4 h-4 text-gray-500 transition-transform ${
                  node.isExpanded ? 'rotate-90' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </button>

          {/* Folder Icon */}
          <span className="text-lg">
            {node.isExpanded ? '📂' : '📁'}
          </span>

          {/* Folder Name */}
          <span className="flex-1 truncate text-sm font-medium">
            {node.name}
          </span>

          {/* Image Count Badge */}
          {node.imageCount > 0 && (
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
              {node.imageCount}
            </span>
          )}
        </div>

        {/* Children */}
        {node.isExpanded && node.children && (
          <div role="group">
            {node.children.map(child => renderNode(child))}
          </div>
        )}
      </div>
    );
  };

  if (!rootPath) {
    return (
      <div className={`sidebar p-4 ${className}`}>
        <p className="text-sm text-gray-500 text-center">
          No directory selected
        </p>
      </div>
    );
  }

  return (
    <div className={`sidebar ${className}`} role="tree" aria-label="Folder tree">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
          Folders
        </h2>
      </div>

      {/* Tree Content */}
      <div className="overflow-y-auto flex-1 py-2">
        {tree ? (
          renderNode(tree)
        ) : (
          <div className="flex items-center justify-center p-4">
            <span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
};

// Utility hook for keyboard navigation
export function useFolderTreeKeyboard(
  tree: FolderNode | null,
  selectedPath: string | null,
  onSelect: (path: string) => void,
  onToggleExpand: (path: string) => void
) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!tree || !selectedPath) return;

    const flattenTree = (node: FolderNode): FolderNode[] => {
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
        } else if (nodeToExpand.children && nodeToExpand.children.length > 0) {
          onSelect(nodeToExpand.children[0].path);
        }
        break;
      case 'ArrowLeft':
        e.preventDefault();
        const nodeToCollapse = flatNodes[currentIndex];
        if (nodeToCollapse.isExpanded) {
          onToggleExpand(nodeToCollapse.path);
        } else if (nodeToCollapse.depth > 0) {
          // Find parent and select it
          const parent = flatNodes.find(n =>
            n.children?.some(c => c.path === selectedPath)
          );
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

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
