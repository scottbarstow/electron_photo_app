import * as fs from 'fs';
import * as path from 'path';
import exifr from 'exifr';

export interface ExifData {
  // Basic file info
  filename: string;
  filepath: string;
  filesize?: number;

  // Image dimensions
  width?: number;
  height?: number;
  orientation?: number;

  // Camera info
  make?: string;
  model?: string;
  software?: string;

  // Capture settings
  exposureTime?: number;       // Shutter speed in seconds
  exposureTimeFormatted?: string; // e.g., "1/250"
  fNumber?: number;            // Aperture
  apertureFormatted?: string;  // e.g., "f/2.8"
  iso?: number;
  focalLength?: number;
  focalLengthFormatted?: string; // e.g., "50mm"
  focalLength35mm?: number;

  // Flash
  flash?: string;
  flashFired?: boolean;

  // Metering and exposure
  meteringMode?: string;
  exposureMode?: string;
  exposureCompensation?: number;
  whiteBalance?: string;

  // Date/time
  dateTimeOriginal?: Date;
  dateTimeDigitized?: Date;
  modifyDate?: Date;

  // GPS location
  latitude?: number;
  longitude?: number;
  altitude?: number;
  gpsFormatted?: string; // e.g., "40.7128° N, 74.0060° W"

  // Lens info
  lensModel?: string;
  lensMake?: string;

  // Color and processing
  colorSpace?: string;

  // Copyright/author
  artist?: string;
  copyright?: string;

  // Raw EXIF data for advanced users
  raw?: Record<string, any>;
}

export interface ExifExtractOptions {
  includeRaw?: boolean;        // Include raw EXIF data
  includeGps?: boolean;        // Extract GPS data (default: true)
  includeThumbnail?: boolean;  // Extract embedded thumbnail (default: false)
}

export class ExifService {
  private readonly supportedExtensions = new Set([
    '.jpg', '.jpeg', '.png', '.tiff', '.tif', '.heic', '.heif', '.webp',
    '.dng', '.cr2', '.nef', '.arw', '.orf', '.rw2'
  ]);

  private readonly defaultOptions: Required<ExifExtractOptions> = {
    includeRaw: false,
    includeGps: true,
    includeThumbnail: false
  };

  /**
   * Check if file format is supported for EXIF extraction
   */
  isSupported(filepath: string): boolean {
    const extension = path.extname(filepath).toLowerCase();
    return this.supportedExtensions.has(extension);
  }

  /**
   * Extract EXIF metadata from an image file
   */
  async extractExif(
    filepath: string,
    options?: ExifExtractOptions
  ): Promise<ExifData> {
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
      const parseOptions: any = {
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
      const rawExif = await exifr.parse(filepath, parseOptions);
      const stats = await fs.promises.stat(filepath);

      // Build standardized ExifData object
      const exifData: ExifData = {
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
    } catch (error) {
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
  async extractBatch(
    filepaths: string[],
    options?: ExifExtractOptions,
    onProgress?: (completed: number, total: number) => void
  ): Promise<Map<string, ExifData>> {
    const results = new Map<string, ExifData>();
    const total = filepaths.length;

    for (let i = 0; i < filepaths.length; i++) {
      try {
        const exifData = await this.extractExif(filepaths[i], options);
        results.set(filepaths[i], exifData);
      } catch (error) {
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
  async getGpsCoordinates(
    filepath: string
  ): Promise<{ latitude: number; longitude: number; altitude?: number } | null> {
    if (!fs.existsSync(filepath) || !this.isSupported(filepath)) {
      return null;
    }

    try {
      const gps = await exifr.gps(filepath);
      if (gps && gps.latitude !== undefined && gps.longitude !== undefined) {
        // Get altitude from full EXIF since gps() only returns lat/long
        const fullExif = await exifr.parse(filepath, { pick: ['GPSAltitude'] });
        return {
          latitude: gps.latitude,
          longitude: gps.longitude,
          altitude: fullExif?.GPSAltitude
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get only the capture date from an image (faster than full extraction)
   */
  async getCaptureDate(filepath: string): Promise<Date | null> {
    if (!fs.existsSync(filepath) || !this.isSupported(filepath)) {
      return null;
    }

    try {
      const result = await exifr.parse(filepath, {
        pick: ['DateTimeOriginal', 'DateTimeDigitized', 'ModifyDate']
      });

      if (result) {
        return result.DateTimeOriginal || result.DateTimeDigitized || result.ModifyDate || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get camera and lens info only (faster than full extraction)
   */
  async getCameraInfo(filepath: string): Promise<{
    make?: string;
    model?: string;
    lensModel?: string;
  } | null> {
    if (!fs.existsSync(filepath) || !this.isSupported(filepath)) {
      return null;
    }

    try {
      const result = await exifr.parse(filepath, {
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
    } catch {
      return null;
    }
  }

  // Formatting helpers
  private formatExposureTime(exposureTime?: number): string | undefined {
    if (exposureTime === undefined) return undefined;

    if (exposureTime >= 1) {
      return `${exposureTime}s`;
    } else {
      // Convert to fraction (e.g., 1/250)
      const denominator = Math.round(1 / exposureTime);
      return `1/${denominator}`;
    }
  }

  private formatAperture(fNumber?: number): string | undefined {
    if (fNumber === undefined) return undefined;
    return `f/${fNumber}`;
  }

  private formatFocalLength(focalLength?: number): string | undefined {
    if (focalLength === undefined) return undefined;
    return `${Math.round(focalLength)}mm`;
  }

  private formatGps(latitude: number, longitude: number): string {
    const latDir = latitude >= 0 ? 'N' : 'S';
    const lonDir = longitude >= 0 ? 'E' : 'W';
    return `${Math.abs(latitude).toFixed(4)}° ${latDir}, ${Math.abs(longitude).toFixed(4)}° ${lonDir}`;
  }

  private parseFlashFired(flash?: string | number): boolean | undefined {
    if (flash === undefined) return undefined;

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
  private cleanExifData(data: ExifData): ExifData {
    const cleaned: ExifData = {
      filename: data.filename,
      filepath: data.filepath
    };

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) {
        (cleaned as any)[key] = value;
      }
    }

    return cleaned;
  }

  /**
   * Get image orientation as a rotation value
   */
  getRotationFromOrientation(orientation?: number): number {
    switch (orientation) {
      case 3: return 180;
      case 6: return 90;
      case 8: return 270;
      default: return 0;
    }
  }
}

// Export singleton instance
let serviceInstance: ExifService | null = null;

export function getExifService(): ExifService {
  if (!serviceInstance) {
    serviceInstance = new ExifService();
  }
  return serviceInstance;
}

export function destroyExifService(): void {
  serviceInstance = null;
}
