"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhotoDetail = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const ExifPanel_1 = require("./ExifPanel");
const PhotoDetail = ({ imagePath, allImages, onClose, onNavigate }) => {
    const [imageUrl, setImageUrl] = (0, react_1.useState)('');
    const [isLoading, setIsLoading] = (0, react_1.useState)(true);
    const [error, setError] = (0, react_1.useState)(null);
    const [zoomMode, setZoomMode] = (0, react_1.useState)('fit');
    const [zoomLevel, setZoomLevel] = (0, react_1.useState)(1);
    const [panOffset, setPanOffset] = (0, react_1.useState)({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = (0, react_1.useState)(false);
    const [panStart, setPanStart] = (0, react_1.useState)({ x: 0, y: 0 });
    const [showExif, setShowExif] = (0, react_1.useState)(true);
    const [exifData, setExifData] = (0, react_1.useState)(null);
    const [imageSize, setImageSize] = (0, react_1.useState)(null);
    const containerRef = (0, react_1.useRef)(null);
    const imageRef = (0, react_1.useRef)(null);
    // Find current image index
    const currentIndex = allImages.findIndex(img => img.path === imagePath);
    const currentImage = allImages[currentIndex];
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < allImages.length - 1;
    // Load full-resolution image
    (0, react_1.useEffect)(() => {
        setIsLoading(true);
        setError(null);
        setZoomLevel(1);
        setPanOffset({ x: 0, y: 0 });
        // Use custom photo:// protocol registered in main process
        // Use 'localhost' as host to avoid URL parsing issues with paths starting with /
        const photoUrl = `photo://localhost${imagePath}`;
        setImageUrl(photoUrl);
    }, [imagePath]);
    // Load EXIF data
    (0, react_1.useEffect)(() => {
        const loadExif = async () => {
            try {
                const response = await window.electronAPI.exif.extract(imagePath);
                if (response.success && response.data) {
                    setExifData(response.data);
                }
            }
            catch (err) {
                console.error('Failed to load EXIF:', err);
            }
        };
        loadExif();
    }, [imagePath]);
    // Keyboard navigation
    (0, react_1.useEffect)(() => {
        const handleKeyDown = (e) => {
            switch (e.key) {
                case 'Escape':
                    onClose();
                    break;
                case 'ArrowLeft':
                    if (hasPrev) {
                        onNavigate(allImages[currentIndex - 1].path);
                    }
                    break;
                case 'ArrowRight':
                    if (hasNext) {
                        onNavigate(allImages[currentIndex + 1].path);
                    }
                    break;
                case '+':
                case '=':
                    handleZoomIn();
                    break;
                case '-':
                    handleZoomOut();
                    break;
                case '0':
                    setZoomMode('fit');
                    setZoomLevel(1);
                    setPanOffset({ x: 0, y: 0 });
                    break;
                case '1':
                    setZoomMode('100');
                    setZoomLevel(1);
                    setPanOffset({ x: 0, y: 0 });
                    break;
                case 'i':
                    setShowExif(prev => !prev);
                    break;
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, onNavigate, hasPrev, hasNext, currentIndex, allImages]);
    const handleImageLoad = (e) => {
        setIsLoading(false);
        const img = e.currentTarget;
        setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    const handleImageError = () => {
        setIsLoading(false);
        setError('Failed to load image');
    };
    const handleZoomIn = () => {
        setZoomMode('custom');
        setZoomLevel(prev => Math.min(prev * 1.25, 5));
    };
    const handleZoomOut = () => {
        setZoomMode('custom');
        setZoomLevel(prev => Math.max(prev / 1.25, 0.1));
    };
    const handleWheel = (0, react_1.useCallback)((e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            setZoomMode('custom');
            setZoomLevel(prev => Math.max(0.1, Math.min(5, prev * delta)));
        }
    }, []);
    const handleMouseDown = (e) => {
        if (zoomMode === 'custom' || zoomMode === '100') {
            setIsPanning(true);
            setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
        }
    };
    const handleMouseMove = (e) => {
        if (isPanning) {
            setPanOffset({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
            });
        }
    };
    const handleMouseUp = () => {
        setIsPanning(false);
    };
    const getImageStyle = () => {
        const base = {
            transition: isPanning ? 'none' : 'transform 0.2s ease-out',
            transformOrigin: 'center center',
            cursor: (zoomMode === 'custom' || zoomMode === '100') ? (isPanning ? 'grabbing' : 'grab') : 'default'
        };
        switch (zoomMode) {
            case 'fit':
                return {
                    ...base,
                    maxWidth: showExif ? 'calc(100vw - 320px - 2rem)' : 'calc(100vw - 2rem)',
                    maxHeight: 'calc(100vh - 2rem)',
                    objectFit: 'contain'
                };
            case 'fill':
                return {
                    ...base,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                };
            case '100':
                return {
                    ...base,
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
                    maxWidth: 'none',
                    maxHeight: 'none'
                };
            case 'custom':
                return {
                    ...base,
                    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
                    maxWidth: 'none',
                    maxHeight: 'none'
                };
            default:
                return base;
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "fixed inset-0 z-50 bg-black/95 flex", onClick: (e) => {
            if (e.target === e.currentTarget)
                onClose();
        }, children: [(0, jsx_runtime_1.jsxs)("div", { ref: containerRef, className: `flex-1 h-full flex items-center justify-center overflow-hidden relative ${showExif ? 'mr-80' : ''}`, onWheel: handleWheel, onMouseDown: handleMouseDown, onMouseMove: handleMouseMove, onMouseUp: handleMouseUp, onMouseLeave: handleMouseUp, children: [isLoading && ((0, jsx_runtime_1.jsx)("div", { className: "absolute inset-0 flex items-center justify-center", children: (0, jsx_runtime_1.jsx)("div", { className: "w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" }) })), error && ((0, jsx_runtime_1.jsxs)("div", { className: "text-red-400 text-center", children: [(0, jsx_runtime_1.jsx)("svg", { className: "w-16 h-16 mx-auto mb-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" }) }), (0, jsx_runtime_1.jsx)("p", { children: error })] })), imageUrl && ((0, jsx_runtime_1.jsx)("img", { ref: imageRef, src: imageUrl, alt: currentImage?.filename || '', style: getImageStyle(), onLoad: handleImageLoad, onError: handleImageError, draggable: false, className: isLoading ? 'opacity-0' : 'opacity-100' })), hasPrev && ((0, jsx_runtime_1.jsx)("button", { onClick: () => onNavigate(allImages[currentIndex - 1].path), className: "absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors", title: "Previous (Left Arrow)", children: (0, jsx_runtime_1.jsx)("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 19l-7-7 7-7" }) }) })), hasNext && ((0, jsx_runtime_1.jsx)("button", { onClick: () => onNavigate(allImages[currentIndex + 1].path), className: "absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors", title: "Next (Right Arrow)", children: (0, jsx_runtime_1.jsx)("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 5l7 7-7 7" }) }) })), (0, jsx_runtime_1.jsx)("div", { className: "absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { className: "text-white", children: [(0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-medium truncate max-w-md", children: currentImage?.filename }), (0, jsx_runtime_1.jsxs)("p", { className: "text-sm text-gray-300", children: [currentIndex + 1, " of ", allImages.length, imageSize && ` | ${imageSize.width} x ${imageSize.height}`] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex items-center gap-2", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center bg-black/50 rounded-lg", children: [(0, jsx_runtime_1.jsx)("button", { onClick: handleZoomOut, className: "p-2 text-white hover:bg-white/20 rounded-l-lg transition-colors", title: "Zoom Out (-)", children: (0, jsx_runtime_1.jsx)("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M20 12H4" }) }) }), (0, jsx_runtime_1.jsx)("span", { className: "px-2 text-white text-sm min-w-[4rem] text-center", children: zoomMode === 'fit' ? 'Fit' : zoomMode === 'fill' ? 'Fill' : zoomMode === '100' ? '100%' : `${Math.round(zoomLevel * 100)}%` }), (0, jsx_runtime_1.jsx)("button", { onClick: handleZoomIn, className: "p-2 text-white hover:bg-white/20 rounded-r-lg transition-colors", title: "Zoom In (+)", children: (0, jsx_runtime_1.jsx)("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 4v16m8-8H4" }) }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex bg-black/50 rounded-lg", children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => { setZoomMode('fit'); setPanOffset({ x: 0, y: 0 }); }, className: `px-3 py-2 text-sm rounded-l-lg transition-colors ${zoomMode === 'fit' ? 'bg-white/30 text-white' : 'text-gray-300 hover:bg-white/20'}`, title: "Fit to Screen (0)", children: "Fit" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => { setZoomMode('100'); setPanOffset({ x: 0, y: 0 }); }, className: `px-3 py-2 text-sm rounded-r-lg transition-colors ${zoomMode === '100' ? 'bg-white/30 text-white' : 'text-gray-300 hover:bg-white/20'}`, title: "Actual Size (1)", children: "100%" })] }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setShowExif(prev => !prev), className: `p-2 rounded-lg transition-colors ${showExif ? 'bg-white/30 text-white' : 'bg-black/50 text-gray-300 hover:bg-white/20'}`, title: "Toggle Info Panel (I)", children: (0, jsx_runtime_1.jsx)("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }), (0, jsx_runtime_1.jsx)("button", { onClick: onClose, className: "p-2 bg-black/50 hover:bg-white/20 rounded-lg text-white transition-colors", title: "Close (Escape)", children: (0, jsx_runtime_1.jsx)("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] })] }) }), (0, jsx_runtime_1.jsx)("div", { className: "absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent", children: (0, jsx_runtime_1.jsx)("p", { className: "text-gray-400 text-sm truncate", children: imagePath }) })] }), showExif && ((0, jsx_runtime_1.jsx)(ExifPanel_1.ExifPanel, { exifData: exifData, imagePath: imagePath, onClose: () => setShowExif(false) }))] }));
};
exports.PhotoDetail = PhotoDetail;
//# sourceMappingURL=PhotoDetail.js.map