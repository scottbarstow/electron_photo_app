"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExifPanel = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const ExifPanel = ({ exifData, imagePath, onClose }) => {
    const [fileInfo, setFileInfo] = (0, react_1.useState)(null);
    const [expandedSections, setExpandedSections] = (0, react_1.useState)(new Set(['camera', 'image', 'location']));
    (0, react_1.useEffect)(() => {
        // Get file info via IPC
        const loadFileInfo = async () => {
            try {
                const response = await window.electronAPI.trash.getFileInfo(imagePath);
                if (response.success && response.data) {
                    setFileInfo({
                        size: response.data.size,
                        modified: new Date(response.data.modified)
                    });
                }
            }
            catch (err) {
                console.error('Failed to load file info:', err);
            }
        };
        loadFileInfo();
    }, [imagePath]);
    const toggleSection = (section) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(section)) {
                next.delete(section);
            }
            else {
                next.add(section);
            }
            return next;
        });
    };
    const formatDate = (date) => {
        if (!date)
            return '—';
        const d = date instanceof Date ? date : new Date(date);
        if (isNaN(d.getTime()))
            return '—';
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    const formatFileSize = (bytes) => {
        if (!bytes)
            return '—';
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(1)} ${units[unitIndex]}`;
    };
    const formatShutterSpeed = (exposureTime) => {
        if (!exposureTime)
            return '—';
        if (exposureTime >= 1) {
            return `${exposureTime}s`;
        }
        const denominator = Math.round(1 / exposureTime);
        return `1/${denominator}s`;
    };
    const formatAperture = (fNumber) => {
        if (!fNumber)
            return '—';
        return `ƒ/${fNumber.toFixed(1)}`;
    };
    const formatFocalLength = (focalLength) => {
        if (!focalLength)
            return '—';
        return `${Math.round(focalLength)}mm`;
    };
    const formatCoordinates = (lat, lng) => {
        if (lat === undefined || lng === undefined)
            return '—';
        const latDir = lat >= 0 ? 'N' : 'S';
        const lngDir = lng >= 0 ? 'E' : 'W';
        return `${Math.abs(lat).toFixed(6)}° ${latDir}, ${Math.abs(lng).toFixed(6)}° ${lngDir}`;
    };
    const getGoogleMapsUrl = (lat, lng) => {
        if (lat === undefined || lng === undefined)
            return null;
        return `https://www.google.com/maps?q=${lat},${lng}`;
    };
    const hasLocationData = exifData?.gpsLatitude !== undefined && exifData?.gpsLongitude !== undefined;
    const hasCameraData = exifData?.cameraMake || exifData?.cameraModel || exifData?.lens || exifData?.lensModel;
    const hasExposureData = exifData?.aperture || exifData?.fNumber || exifData?.shutterSpeed || exifData?.exposureTime || exifData?.iso || exifData?.focalLength;
    const SectionHeader = ({ title, section, hasData }) => ((0, jsx_runtime_1.jsxs)("button", { onClick: () => toggleSection(section), className: `w-full flex items-center justify-between py-2 text-left ${hasData ? 'text-white' : 'text-gray-500'}`, disabled: !hasData, children: [(0, jsx_runtime_1.jsx)("span", { className: "text-sm font-medium", children: title }), hasData && ((0, jsx_runtime_1.jsx)("svg", { className: `w-4 h-4 transition-transform ${expandedSections.has(section) ? 'rotate-180' : ''}`, fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 9l-7 7-7-7" }) }))] }));
    const InfoRow = ({ label, value }) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex justify-between py-1.5 border-b border-gray-700/50 last:border-0", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-gray-400 text-sm", children: label }), (0, jsx_runtime_1.jsx)("span", { className: "text-white text-sm text-right max-w-[60%] truncate", children: value })] }));
    return ((0, jsx_runtime_1.jsxs)("div", { className: "w-80 bg-gray-900 border-l border-gray-700 h-full overflow-y-auto flex-shrink-0", children: [(0, jsx_runtime_1.jsxs)("div", { className: "sticky top-0 bg-gray-900 border-b border-gray-700 px-4 py-3 flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-white font-medium", children: "Photo Info" }), (0, jsx_runtime_1.jsx)("button", { onClick: onClose, className: "p-1 text-gray-400 hover:text-white transition-colors", title: "Close panel", children: (0, jsx_runtime_1.jsx)("svg", { className: "w-5 h-5", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "p-4 space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "border-b border-gray-700 pb-4", children: [(0, jsx_runtime_1.jsx)(InfoRow, { label: "Date Taken", value: formatDate(exifData?.dateTaken) }), fileInfo && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(InfoRow, { label: "File Size", value: formatFileSize(fileInfo.size) }), (0, jsx_runtime_1.jsx)(InfoRow, { label: "Modified", value: formatDate(fileInfo.modified) })] }))] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(SectionHeader, { title: "Image", section: "image", hasData: !!(exifData?.width && exifData?.height) }), expandedSections.has('image') && (exifData?.width || exifData?.height) && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-2", children: [(0, jsx_runtime_1.jsx)(InfoRow, { label: "Dimensions", value: exifData?.width && exifData?.height ? `${exifData.width} × ${exifData.height}` : '—' }), exifData?.width && exifData?.height && ((0, jsx_runtime_1.jsx)(InfoRow, { label: "Megapixels", value: `${((exifData.width * exifData.height) / 1000000).toFixed(1)} MP` })), exifData?.orientation && ((0, jsx_runtime_1.jsx)(InfoRow, { label: "Orientation", value: `${exifData.orientation}` }))] }))] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(SectionHeader, { title: "Camera", section: "camera", hasData: !!hasCameraData }), expandedSections.has('camera') && hasCameraData && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-2", children: [(exifData?.cameraMake || exifData?.cameraModel) && ((0, jsx_runtime_1.jsx)(InfoRow, { label: "Camera", value: [exifData?.cameraMake, exifData?.cameraModel].filter(Boolean).join(' ') })), (exifData?.lens || exifData?.lensModel) && ((0, jsx_runtime_1.jsx)(InfoRow, { label: "Lens", value: exifData?.lens || exifData?.lensModel || '—' }))] }))] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(SectionHeader, { title: "Exposure", section: "exposure", hasData: !!hasExposureData }), expandedSections.has('exposure') && hasExposureData && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-2", children: [(0, jsx_runtime_1.jsx)(InfoRow, { label: "Aperture", value: formatAperture(exifData?.aperture || exifData?.fNumber) }), (0, jsx_runtime_1.jsx)(InfoRow, { label: "Shutter Speed", value: exifData?.shutterSpeed || formatShutterSpeed(exifData?.exposureTime) }), (0, jsx_runtime_1.jsx)(InfoRow, { label: "ISO", value: exifData?.iso ? `${exifData.iso}` : '—' }), (0, jsx_runtime_1.jsx)(InfoRow, { label: "Focal Length", value: formatFocalLength(exifData?.focalLength) })] }))] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)(SectionHeader, { title: "Location", section: "location", hasData: hasLocationData }), expandedSections.has('location') && hasLocationData && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-2", children: [(0, jsx_runtime_1.jsx)(InfoRow, { label: "Coordinates", value: formatCoordinates(exifData?.gpsLatitude, exifData?.gpsLongitude) }), getGoogleMapsUrl(exifData?.gpsLatitude, exifData?.gpsLongitude) && ((0, jsx_runtime_1.jsxs)("a", { href: getGoogleMapsUrl(exifData?.gpsLatitude, exifData?.gpsLongitude), target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1 mt-2 text-blue-400 hover:text-blue-300 text-sm", children: [(0, jsx_runtime_1.jsxs)("svg", { className: "w-4 h-4", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: [(0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" }), (0, jsx_runtime_1.jsx)("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M15 11a3 3 0 11-6 0 3 3 0 016 0z" })] }), "View on Google Maps"] }))] }))] }), (0, jsx_runtime_1.jsx)("div", { className: "border-t border-gray-700 pt-4", children: (0, jsx_runtime_1.jsx)("p", { className: "text-gray-500 text-xs break-all", children: imagePath }) })] })] }));
};
exports.ExifPanel = ExifPanel;
//# sourceMappingURL=ExifPanel.js.map