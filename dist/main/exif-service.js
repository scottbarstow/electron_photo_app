"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExifService = void 0;
exports.getExifService = getExifService;
exports.destroyExifService = destroyExifService;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const exifr_1 = __importDefault(require("exifr"));
class ExifService {
    constructor() {
        this.supportedExtensions = new Set([
            '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.heic', '.heif', '.webp',
            '.dng', '.cr2', '.nef', '.arw', '.orf', '.rw2'
        ]);
        this.defaultOptions = {
            includeRaw: false,
            includeGps: true,
            includeThumbnail: false
        };
    }
    /**
     * Check if file format is supported for EXIF extraction
     */
    isSupported(filepath) {
        const extension = path.extname(filepath).toLowerCase();
        return this.supportedExtensions.has(extension);
    }
    /**
     * Extract EXIF metadata from an image file
     */
    async extractExif(filepath, options) {
        // Validate file exists
        if (!fs.existsSync(filepath)) {
            throw new Error(`Image file not found: ${filepath}`);
        }
        // Validate format is supported
        if (!this.isSupported(filepath)) {
            // Return basic file info for unsupported formats
            const stats = await fs.promises.stat(filepath);
            return {
                filename: path.basename(filepath),
                filepath,
                filesize: stats.size
            };
        }
        const opts = { ...this.defaultOptions, ...options };
        try {
            // Configure exifr parsing options
            const parseOptions = {
                tiff: true,
                exif: true,
                iptc: true,
                icc: false,
                xmp: true,
                gps: opts.includeGps,
                interop: false,
                thumbnail: opts.includeThumbnail,
                translateKeys: true,
                translateValues: true,
                reviveValues: true
            };
            // Parse EXIF data
            const rawExif = await exifr_1.default.parse(filepath, parseOptions);
            const stats = await fs.promises.stat(filepath);
            // Build standardized ExifData object
            const exifData = {
                filename: path.basename(filepath),
                filepath,
                filesize: stats.size
            };
            if (rawExif) {
                // Image dimensions
                exifData.width = rawExif.ImageWidth || rawExif.ExifImageWidth;
                exifData.height = rawExif.ImageHeight || rawExif.ExifImageHeight;
                exifData.orientation = rawExif.Orientation;
                // Camera info
                exifData.make = rawExif.Make;
                exifData.model = rawExif.Model;
                exifData.software = rawExif.Software;
                // Exposure settings
                exifData.exposureTime = rawExif.ExposureTime;
                exifData.exposureTimeFormatted = this.formatExposureTime(rawExif.ExposureTime);
                exifData.fNumber = rawExif.FNumber;
                exifData.apertureFormatted = this.formatAperture(rawExif.FNumber);
                exifData.iso = rawExif.ISO;
                exifData.focalLength = rawExif.FocalLength;
                exifData.focalLengthFormatted = this.formatFocalLength(rawExif.FocalLength);
                exifData.focalLength35mm = rawExif.FocalLengthIn35mmFormat;
                // Flash info
                exifData.flash = rawExif.Flash;
                exifData.flashFired = this.parseFlashFired(rawExif.Flash);
                // Metering and exposure
                exifData.meteringMode = rawExif.MeteringMode;
                exifData.exposureMode = rawExif.ExposureMode;
                exifData.exposureCompensation = rawExif.ExposureCompensation;
                exifData.whiteBalance = rawExif.WhiteBalance;
                // Date/time
                exifData.dateTimeOriginal = rawExif.DateTimeOriginal;
                exifData.dateTimeDigitized = rawExif.DateTimeDigitized;
                exifData.modifyDate = rawExif.ModifyDate;
                // GPS data
                if (opts.includeGps) {
                    exifData.latitude = rawExif.latitude;
                    exifData.longitude = rawExif.longitude;
                    exifData.altitude = rawExif.GPSAltitude;
                    if (rawExif.latitude !== undefined && rawExif.longitude !== undefined) {
                        exifData.gpsFormatted = this.formatGps(rawExif.latitude, rawExif.longitude);
                    }
                }
                // Lens info
                exifData.lensModel = rawExif.LensModel;
                exifData.lensMake = rawExif.LensMake;
                // Color
                exifData.colorSpace = rawExif.ColorSpace;
                // Copyright/author
                exifData.artist = rawExif.Artist;
                exifData.copyright = rawExif.Copyright;
                // Include raw data if requested
                if (opts.includeRaw) {
                    exifData.raw = rawExif;
                }
            }
            // Clean up undefined values
            return this.cleanExifData(exifData);
        }
        catch (error) {
            // If EXIF extraction fails, return basic file info
            console.error(`Failed to extract EXIF from ${filepath}:`, error);
            const stats = await fs.promises.stat(filepath);
            return {
                filename: path.basename(filepath),
                filepath,
                filesize: stats.size
            };
        }
    }
    /**
     * Extract EXIF from multiple files in batch
     */
    async extractBatch(filepaths, options, onProgress) {
        const results = new Map();
        const total = filepaths.length;
        for (let i = 0; i < filepaths.length; i++) {
            try {
                const exifData = await this.extractExif(filepaths[i], options);
                results.set(filepaths[i], exifData);
            }
            catch (error) {
                // Store basic info on error
                results.set(filepaths[i], {
                    filename: path.basename(filepaths[i]),
                    filepath: filepaths[i]
                });
            }
            if (onProgress) {
                onProgress(i + 1, total);
            }
        }
        return results;
    }
    /**
     * Get only GPS coordinates from an image (faster than full extraction)
     */
    async getGpsCoordinates(filepath) {
        if (!fs.existsSync(filepath) || !this.isSupported(filepath)) {
            return null;
        }
        try {
            const gps = await exifr_1.default.gps(filepath);
            if (gps && gps.latitude !== undefined && gps.longitude !== undefined) {
                // Get altitude from full EXIF since gps() only returns lat/long
                const fullExif = await exifr_1.default.parse(filepath, { pick: ['GPSAltitude'] });
                return {
                    latitude: gps.latitude,
                    longitude: gps.longitude,
                    altitude: fullExif?.GPSAltitude
                };
            }
            return null;
        }
        catch {
            return null;
        }
    }
    /**
     * Get only the capture date from an image (faster than full extraction)
     */
    async getCaptureDate(filepath) {
        if (!fs.existsSync(filepath) || !this.isSupported(filepath)) {
            return null;
        }
        try {
            const result = await exifr_1.default.parse(filepath, {
                pick: ['DateTimeOriginal', 'DateTimeDigitized', 'ModifyDate']
            });
            if (result) {
                return result.DateTimeOriginal || result.DateTimeDigitized || result.ModifyDate || null;
            }
            return null;
        }
        catch {
            return null;
        }
    }
    /**
     * Get camera and lens info only (faster than full extraction)
     */
    async getCameraInfo(filepath) {
        if (!fs.existsSync(filepath) || !this.isSupported(filepath)) {
            return null;
        }
        try {
            const result = await exifr_1.default.parse(filepath, {
                pick: ['Make', 'Model', 'LensModel', 'LensMake']
            });
            if (result) {
                return {
                    make: result.Make,
                    model: result.Model,
                    lensModel: result.LensModel
                };
            }
            return null;
        }
        catch {
            return null;
        }
    }
    // Formatting helpers
    formatExposureTime(exposureTime) {
        if (exposureTime === undefined)
            return undefined;
        if (exposureTime >= 1) {
            return `${exposureTime}s`;
        }
        else {
            // Convert to fraction (e.g., 1/250)
            const denominator = Math.round(1 / exposureTime);
            return `1/${denominator}`;
        }
    }
    formatAperture(fNumber) {
        if (fNumber === undefined)
            return undefined;
        return `f/${fNumber}`;
    }
    formatFocalLength(focalLength) {
        if (focalLength === undefined)
            return undefined;
        return `${Math.round(focalLength)}mm`;
    }
    formatGps(latitude, longitude) {
        const latDir = latitude >= 0 ? 'N' : 'S';
        const lonDir = longitude >= 0 ? 'E' : 'W';
        return `${Math.abs(latitude).toFixed(4)}° ${latDir}, ${Math.abs(longitude).toFixed(4)}° ${lonDir}`;
    }
    parseFlashFired(flash) {
        if (flash === undefined)
            return undefined;
        if (typeof flash === 'string') {
            return flash.toLowerCase().includes('fired');
        }
        // Flash value is a bitmask where bit 0 indicates if flash fired
        if (typeof flash === 'number') {
            return (flash & 1) === 1;
        }
        return undefined;
    }
    /**
     * Remove undefined values from ExifData object
     */
    cleanExifData(data) {
        const cleaned = {
            filename: data.filename,
            filepath: data.filepath
        };
        for (const [key, value] of Object.entries(data)) {
            if (value !== undefined && value !== null) {
                cleaned[key] = value;
            }
        }
        return cleaned;
    }
    /**
     * Get image orientation as a rotation value
     */
    getRotationFromOrientation(orientation) {
        switch (orientation) {
            case 3: return 180;
            case 6: return 90;
            case 8: return 270;
            default: return 0;
        }
    }
}
exports.ExifService = ExifService;
// Export singleton instance
let serviceInstance = null;
function getExifService() {
    if (!serviceInstance) {
        serviceInstance = new ExifService();
    }
    return serviceInstance;
}
function destroyExifService() {
    serviceInstance = null;
}
//# sourceMappingURL=exif-service.js.map