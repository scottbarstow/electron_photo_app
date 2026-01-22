"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerticalSplitPane = exports.SplitPane = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const SplitPane = ({ leftPanel, rightPanel, defaultLeftWidth = 280, minLeftWidth = 200, maxLeftWidth = 500, className = '' }) => {
    const [leftWidth, setLeftWidth] = (0, react_1.useState)(defaultLeftWidth);
    const [isDragging, setIsDragging] = (0, react_1.useState)(false);
    const containerRef = (0, react_1.useRef)(null);
    const startXRef = (0, react_1.useRef)(0);
    const startWidthRef = (0, react_1.useRef)(0);
    const handleMouseDown = (0, react_1.useCallback)((e) => {
        e.preventDefault();
        setIsDragging(true);
        startXRef.current = e.clientX;
        startWidthRef.current = leftWidth;
    }, [leftWidth]);
    const handleMouseMove = (0, react_1.useCallback)((e) => {
        if (!isDragging)
            return;
        const delta = e.clientX - startXRef.current;
        let newWidth = startWidthRef.current + delta;
        // Clamp to min/max bounds
        newWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, newWidth));
        setLeftWidth(newWidth);
    }, [isDragging, minLeftWidth, maxLeftWidth]);
    const handleMouseUp = (0, react_1.useCallback)(() => {
        setIsDragging(false);
    }, []);
    // Add global mouse event listeners for drag
    (0, react_1.useEffect)(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            // Prevent text selection while dragging
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
        }
        else {
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);
    return ((0, jsx_runtime_1.jsxs)("div", { ref: containerRef, className: `flex h-full overflow-hidden ${className}`, children: [(0, jsx_runtime_1.jsx)("div", { className: "flex-shrink-0 h-full overflow-hidden", style: { width: leftWidth }, children: leftPanel }), (0, jsx_runtime_1.jsx)("div", { className: `
          w-1 bg-gray-200 cursor-col-resize
          hover:bg-blue-400 active:bg-blue-500
          transition-colors duration-150
          flex-shrink-0
          ${isDragging ? 'bg-blue-500' : ''}
        `, onMouseDown: handleMouseDown, role: "separator", "aria-orientation": "vertical", "aria-valuenow": leftWidth, "aria-valuemin": minLeftWidth, "aria-valuemax": maxLeftWidth }), (0, jsx_runtime_1.jsx)("div", { className: "flex-1 h-full overflow-hidden min-w-0", children: rightPanel })] }));
};
exports.SplitPane = SplitPane;
const VerticalSplitPane = ({ topPanel, bottomPanel, defaultTopHeight = 300, minTopHeight = 100, maxTopHeight = 600, className = '' }) => {
    const [topHeight, setTopHeight] = (0, react_1.useState)(defaultTopHeight);
    const [isDragging, setIsDragging] = (0, react_1.useState)(false);
    const startYRef = (0, react_1.useRef)(0);
    const startHeightRef = (0, react_1.useRef)(0);
    const handleMouseDown = (0, react_1.useCallback)((e) => {
        e.preventDefault();
        setIsDragging(true);
        startYRef.current = e.clientY;
        startHeightRef.current = topHeight;
    }, [topHeight]);
    const handleMouseMove = (0, react_1.useCallback)((e) => {
        if (!isDragging)
            return;
        const delta = e.clientY - startYRef.current;
        let newHeight = startHeightRef.current + delta;
        newHeight = Math.max(minTopHeight, Math.min(maxTopHeight, newHeight));
        setTopHeight(newHeight);
    }, [isDragging, minTopHeight, maxTopHeight]);
    const handleMouseUp = (0, react_1.useCallback)(() => {
        setIsDragging(false);
    }, []);
    (0, react_1.useEffect)(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'row-resize';
        }
        else {
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);
    return ((0, jsx_runtime_1.jsxs)("div", { className: `flex flex-col h-full overflow-hidden ${className}`, children: [(0, jsx_runtime_1.jsx)("div", { className: "flex-shrink-0 w-full overflow-hidden", style: { height: topHeight }, children: topPanel }), (0, jsx_runtime_1.jsx)("div", { className: `
          h-1 bg-gray-200 cursor-row-resize
          hover:bg-blue-400 active:bg-blue-500
          transition-colors duration-150
          flex-shrink-0
          ${isDragging ? 'bg-blue-500' : ''}
        `, onMouseDown: handleMouseDown, role: "separator", "aria-orientation": "horizontal", "aria-valuenow": topHeight, "aria-valuemin": minTopHeight, "aria-valuemax": maxTopHeight }), (0, jsx_runtime_1.jsx)("div", { className: "flex-1 w-full overflow-hidden min-h-0", children: bottomPanel })] }));
};
exports.VerticalSplitPane = VerticalSplitPane;
//# sourceMappingURL=SplitPane.js.map