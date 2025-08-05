import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

// Log levels
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

// Log entry interface
interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  data?: any;
  stack?: string;
}

// Logger configuration
interface LoggerConfig {
  level: LogLevel;
  writeToFile: boolean;
  writeToConsole: boolean;
  maxFileSize: number; // in bytes
  maxFiles: number;
  logDirectory: string;
}

// Default configuration
const DEFAULT_CONFIG: LoggerConfig = {
  level:
    process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
  writeToFile: true,
  writeToConsole: true,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxFiles: 5,
  logDirectory: path.join(app.getPath('userData'), 'logs'),
};

export class Logger {
  private config: LoggerConfig;
  private currentLogFile: string;
  private writeQueue: LogEntry[] = [];
  private isWriting = false;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentLogFile = this.getLogFileName();
    this.ensureLogDirectory();
  }

  /**
   * Log an error message
   */
  error(message: string, data?: any, error?: Error): void {
    this.log(LogLevel.ERROR, message, data, error?.stack);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log an info message
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Log a message at the specified level
   */
  private log(
    level: LogLevel,
    message: string,
    data?: any,
    stack?: string,
  ): void {
    if (level > this.config.level) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      message,
      data,
      ...(stack && { stack }),
    };

    // Write to console if enabled
    if (this.config.writeToConsole) {
      this.writeToConsole(entry);
    }

    // Write to file if enabled
    if (this.config.writeToFile) {
      this.writeQueue.push(entry);
      this.processWriteQueue();
    }
  }

  /**
   * Write log entry to console
   */
  private writeToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.substring(11, 23); // HH:mm:ss.SSS
    const prefix = `[${timestamp}] [${entry.level}]`;

    const message = entry.data
      ? `${prefix} ${entry.message} ${JSON.stringify(entry.data)}`
      : `${prefix} ${entry.message}`;

    switch (entry.level) {
      case 'ERROR':
        console.error(message);
        if (entry.stack) {
          console.error(entry.stack);
        }
        break;
      case 'WARN':
        console.warn(message);
        break;
      case 'INFO':
        console.info(message);
        break;
      case 'DEBUG':
        console.debug(message);
        break;
      default:
        console.log(message);
    }
  }

  /**
   * Process the write queue
   */
  private async processWriteQueue(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0) {
      return;
    }

    this.isWriting = true;

    try {
      // Check if we need to rotate the log file
      await this.rotateLogFileIfNeeded();

      // Write all queued entries
      const entries = this.writeQueue.splice(0);
      const logLines = `${entries.map(entry => JSON.stringify(entry)).join('\n')}\n`;

      await fs.appendFile(this.currentLogFile, logLines, 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    } finally {
      this.isWriting = false;

      // Process remaining queue if needed
      if (this.writeQueue.length > 0) {
        setImmediate(() => this.processWriteQueue());
      }
    }
  }

  /**
   * Rotate log file if it exceeds maximum size
   */
  private async rotateLogFileIfNeeded(): Promise<void> {
    try {
      const stats = await fs.stat(this.currentLogFile);

      if (stats.size >= this.config.maxFileSize) {
        await this.rotateLogFiles();
        this.currentLogFile = this.getLogFileName();
      }
    } catch (error) {
      // File doesn't exist yet, which is fine
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Error checking log file size:', error);
      }
    }
  }

  /**
   * Rotate log files
   */
  private async rotateLogFiles(): Promise<void> {
    const baseName = 'app.log';

    try {
      // Remove oldest log file if we exceed max files
      const oldestFile = path.join(
        this.config.logDirectory,
        `${baseName}.${this.config.maxFiles - 1}`,
      );
      try {
        await fs.unlink(oldestFile);
      } catch {
        // File doesn't exist, which is fine
      }

      // Rotate existing files
      for (let i = this.config.maxFiles - 2; i >= 0; i--) {
        const currentFile =
          i === 0
            ? path.join(this.config.logDirectory, baseName)
            : path.join(this.config.logDirectory, `${baseName}.${i}`);

        const nextFile = path.join(
          this.config.logDirectory,
          `${baseName}.${i + 1}`,
        );

        try {
          await fs.rename(currentFile, nextFile);
        } catch {
          // File doesn't exist, which is fine
        }
      }
    } catch (error) {
      console.error('Error rotating log files:', error);
    }
  }

  /**
   * Ensure log directory exists
   */
  private async ensureLogDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.config.logDirectory, { recursive: true });
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  /**
   * Get current log file name
   */
  private getLogFileName(): string {
    return path.join(this.config.logDirectory, 'app.log');
  }

  /**
   * Get log directory path
   */
  getLogDirectory(): string {
    return this.config.logDirectory;
  }

  /**
   * Get current log level
   */
  getLevel(): LogLevel {
    return this.config.level;
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Clear all log files
   */
  async clearLogs(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.logDirectory);
      const logFiles = files.filter(file => file.startsWith('app.log'));

      await Promise.all(
        logFiles.map(file =>
          fs.unlink(path.join(this.config.logDirectory, file)),
        ),
      );

      this.info('Log files cleared');
    } catch (error) {
      console.error('Failed to clear log files:', error);
    }
  }

  /**
   * Flush any pending writes
   */
  async flush(): Promise<void> {
    while (this.writeQueue.length > 0 || this.isWriting) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

// Singleton instance
let logger: Logger | null = null;

/**
 * Get the logger instance
 */
export const getLogger = (): Logger => {
  if (!logger) {
    logger = new Logger();
  }
  return logger;
};

/**
 * Initialize logger with custom configuration
 */
export const initializeLogger = (config?: Partial<LoggerConfig>): Logger => {
  logger = new Logger(config);
  return logger;
};
