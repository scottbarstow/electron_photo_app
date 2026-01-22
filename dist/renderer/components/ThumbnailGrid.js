"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleThumbnail = exports.ThumbnailGrid = void 0;
exports.useThumbnailGridKeyboard = useThumbnailGridKeyboard;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const react_window_1 = require("react-window");
const ThumbnailGrid = ({ images, selectedIds, onSelectImage, onDoubleClickImage, onLoadThumbnail, thumbnailSize = 150, gap = 8, className = '' }) => {
    const containerRef = (0, react_1.useRef)(null);
    const [containerWidth, setContainerWidth] = (0, react_1.useState)(0);
    const [thumbnailUrls, setThumbnailUrls] = (0, react_1.useState)(new Map());
    const [loadingPaths, setLoadingPaths] = (0, react_1.useState)(new Set());
    // Calculate grid dimensions
    const cellSize = thumbnailSize + gap;
    const columnCount = Math.max(1, Math.floor((containerWidth - gap) / cellSize));
    const rowCount = Math.ceil(images.length / columnCount);
    // Track container width for responsive columns
    (0, react_1.useEffect)(() => {
        if (!containerRef.current)
            return;
        const updateWidth = () => {
            if (containerRef.current) {
                // Try multiple methods to get width
                const rect = containerRef.current.getBoundingClientRect();
                const width = rect.width || containerRef.current.clientWidth || containerRef.current.offsetWidth;
                console.log('Measuring width:', { rectWidth: rect.width, clientWidth: containerRef.current.clientWidth, offsetWidth: containerRef.current.offsetWidth });
                if (width > 0) {
                    setContainerWidth(width);
                }
            }
        };
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (entry.contentRect.width > 0) {
                    setContainerWidth(entry.contentRect.width);
                }
            }
        });
        observer.observe(containerRef.current);
        // Initial measurement with delays to ensure layout is complete
        updateWidth();
        const timeoutId1 = setTimeout(updateWidth, 50);
        const timeoutId2 = setTimeout(updateWidth, 200);
        // Also try after next animation frame
        requestAnimationFrame(() => {
            updateWidth();
            requestAnimationFrame(updateWidth);
        });
        return () => {
            observer.disconnect();
            clearTimeout(timeoutId1);
            clearTimeout(timeoutId2);
        };
    }, []);
    // Load thumbnail for a given path
    const loadThumbnail = (0, react_1.useCallback)(async (imagePath) => {
        if (thumbnailUrls.has(imagePath) || loadingPaths.has(imagePath)) {
            return;
        }
        console.log('Loading thumbnail for:', imagePath);
        setLoadingPaths(prev => new Set(prev).add(imagePath));
        try {
            const url = await onLoadThumbnail(imagePath);
            console.log('Thumbnail loaded:', imagePath, 'URL length:', url?.length || 0);
            setThumbnailUrls(prev => new Map(prev).set(imagePath, url));
        }
        catch (error) {
            console.error(`Failed to load thumbnail for ${imagePath}:`, error);
            // Mark as error by setting empty string
            setThumbnailUrls(prev => new Map(prev).set(imagePath, ''));
        }
        finally {
            setLoadingPaths(prev => {
                const next = new Set(prev);
                next.delete(imagePath);
                return next;
            });
        }
    }, [thumbnailUrls, loadingPaths, onLoadThumbnail]);
    // Get image at grid position
    const getImageAtPosition = (0, react_1.useCallback)((rowIndex, columnIndex) => {
        const index = rowIndex * columnCount + columnIndex;
        return images[index] || null;
    }, [images, columnCount]);
    // Cell renderer for react-window
    const Cell = (0, react_1.useMemo)(() => {
        return ({ columnIndex, rowIndex, style }) => {
            const image = getImageAtPosition(rowIndex, columnIndex);
            if (!image) {
                return (0, jsx_runtime_1.jsx)("div", { style: style });
            }
            const isSelected = selectedIds.has(image.id);
            const thumbnailUrl = thumbnailUrls.get(image.path);
            const isLoading = loadingPaths.has(image.path);
            // Load thumbnail if not yet loaded
            if (!thumbnailUrl && !isLoading && image.path) {
                loadThumbnail(image.path);
            }
            return ((0, jsx_runtime_1.jsx)("div", { style: {
                    ...style,
                    left: style.left + gap / 2,
                    top: style.top + gap / 2,
                    width: style.width - gap,
                    height: style.height - gap,
                }, children: (0, jsx_runtime_1.jsxs)("div", { className: `
              thumbnail-item h-full w-full bg-gray-100
              ${isSelected ? 'selected ring-blue-500' : ''}
            `, onClick: (e) => onSelectImage(image.id, e.ctrlKey || e.metaKey), onDoubleClick: () => onDoubleClickImage(image.id), role: "option", "aria-selected": isSelected, tabIndex: 0, children: [isLoading ? ((0, jsx_runtime_1.jsx)("div", { className: "w-full h-full flex items-center justify-center", children: (0, jsx_runtime_1.jsx)("div", { className: "w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" }) })) : thumbnailUrl ? ((0, jsx_runtime_1.jsx)("img", { src: thumbnailUrl, alt: image.filename, className: "w-full h-full object-cover", loading: "lazy" })) : ((0, jsx_runtime_1.jsx)("div", { className: "w-full h-full flex items-center justify-center text-gray-400", children: (0, jsx_runtime_1.jsx)("svg", { className: "w-8 h-8", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" }) }) })), (0, jsx_runtime_1.jsx)("div", { className: "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2", children: (0, jsx_runtime_1.jsx)("p", { className: "text-white text-xs truncate", children: image.filename }) })] }) }));
        };
    }, [
        getImageAtPosition,
        selectedIds,
        thumbnailUrls,
        loadingPaths,
        loadThumbnail,
        onSelectImage,
        onDoubleClickImage,
        gap
    ]);
    // Re-measure when images change (container might now be visible)
    (0, react_1.useEffect)(() => {
        if (containerRef.current && images.length > 0 && containerWidth === 0) {
            const rect = containerRef.current.getBoundingClientRect();
            console.log('Re-measuring on images change:', rect);
            if (rect.width > 0) {
                setContainerWidth(rect.width);
            }
        }
    }, [images.length, containerWidth]);
    // Debug logging
    console.log('ThumbnailGrid render:', {
        imageCount: images.length,
        containerWidth,
        columnCount,
        rowCount,
        firstImage: images[0]
    });
    if (images.length === 0) {
        return ((0, jsx_runtime_1.jsx)("div", { className: `flex items-center justify-center h-full ${className}`, children: (0, jsx_runtime_1.jsxs)("div", { className: "text-center text-gray-500", children: [(0, jsx_runtime_1.jsx)("svg", { className: "w-16 h-16 mx-auto mb-4 text-gray-300", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 1.5, d: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" }) }), (0, jsx_runtime_1.jsx)("p", { className: "text-lg font-medium", children: "No images" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm", children: "Select a folder to view images" })] }) }));
    }
    return ((0, jsx_runtime_1.jsx)("div", { ref: containerRef, className: `h-full w-full ${className}`, children: containerWidth > 0 && ((0, jsx_runtime_1.jsx)(react_window_1.FixedSizeGrid, { className: "scrollbar-thin", columnCount: columnCount, columnWidth: cellSize, height: containerRef.current?.clientHeight || 500, rowCount: rowCount, rowHeight: cellSize, width: containerWidth, overscanRowCount: 2, children: Cell })) }));
};
exports.ThumbnailGrid = ThumbnailGrid;
const SimpleThumbnail = ({ image, isSelected, thumbnailUrl, onClick, onDoubleClick }) => {
    return ((0, jsx_runtime_1.jsxs)("div", { className: `
        thumbnail-item aspect-square bg-gray-100 relative
        ${isSelected ? 'selected ring-blue-500' : ''}
      `, onClick: (e) => onClick(e.ctrlKey || e.metaKey), onDoubleClick: onDoubleClick, role: "option", "aria-selected": isSelected, tabIndex: 0, children: [thumbnailUrl ? ((0, jsx_runtime_1.jsx)("img", { src: thumbnailUrl, alt: image.filename, className: "w-full h-full object-cover", loading: "lazy" })) : ((0, jsx_runtime_1.jsx)("div", { className: "w-full h-full flex items-center justify-center text-gray-400", children: (0, jsx_runtime_1.jsx)("svg", { className: "w-8 h-8", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" }) }) })), (0, jsx_runtime_1.jsx)("div", { className: "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2", children: (0, jsx_runtime_1.jsx)("p", { className: "text-white text-xs truncate", children: image.filename }) })] }));
};
exports.SimpleThumbnail = SimpleThumbnail;
// Hook for keyboard navigation in the thumbnail grid
function useThumbnailGridKeyboard(images, selectedIds, columnCount, onSelect, onOpen, onDelete) {
    const handleKeyDown = (0, react_1.useCallback)((e) => {
        if (images.length === 0)
            return;
        // Get the currently focused image (first selected or first in list)
        const selectedArray = Array.from(selectedIds);
        const currentId = selectedArray.length > 0
            ? selectedArray[selectedArray.length - 1]
            : images[0]?.id;
        const currentIndex = images.findIndex(img => img.id === currentId);
        if (currentIndex === -1)
            return;
        const isShiftHeld = e.shiftKey;
        const isCtrlOrMeta = e.ctrlKey || e.metaKey;
        switch (e.key) {
            case 'ArrowRight':
                e.preventDefault();
                if (currentIndex < images.length - 1) {
                    onSelect(images[currentIndex + 1].id, isShiftHeld || isCtrlOrMeta);
                }
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (currentIndex > 0) {
                    onSelect(images[currentIndex - 1].id, isShiftHeld || isCtrlOrMeta);
                }
                break;
            case 'ArrowDown':
                e.preventDefault();
                if (currentIndex + columnCount < images.length) {
                    onSelect(images[currentIndex + columnCount].id, isShiftHeld || isCtrlOrMeta);
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (currentIndex - columnCount >= 0) {
                    onSelect(images[currentIndex - columnCount].id, isShiftHeld || isCtrlOrMeta);
                }
                break;
            case 'Enter':
                e.preventDefault();
                if (currentId !== undefined) {
                    onOpen(currentId);
                }
                break;
            case 'Delete':
            case 'Backspace':
                if (onDelete && selectedIds.size > 0) {
                    e.preventDefault();
                    onDelete(Array.from(selectedIds));
                }
                break;
            case 'a':
                if (isCtrlOrMeta) {
                    e.preventDefault();
                    // Select all
                    images.forEach(img => onSelect(img.id, true));
                }
                break;
            case 'Escape':
                e.preventDefault();
                // Deselect all by selecting nothing
                if (selectedIds.size > 0 && images.length > 0) {
                    onSelect(images[0].id, false);
                }
                break;
            case 'Home':
                e.preventDefault();
                if (images.length > 0) {
                    onSelect(images[0].id, isShiftHeld || isCtrlOrMeta);
                }
                break;
            case 'End':
                e.preventDefault();
                if (images.length > 0) {
                    onSelect(images[images.length - 1].id, isShiftHeld || isCtrlOrMeta);
                }
                break;
        }
    }, [images, selectedIds, columnCount, onSelect, onOpen, onDelete]);
    (0, react_1.useEffect)(() => {
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
}
//# sourceMappingURL=ThumbnailGrid.js.map