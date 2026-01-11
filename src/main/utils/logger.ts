import { app } from 'electron';
import {
  writeFileSync,
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  statSync,
} from 'fs';
import { appendFile } from 'fs/promises';
import { join } from 'path';

const LOG_RETENTION_DAYS = 7;

let saveLogsEnabled = false;
let logFilePath: string | null = null;

// Буфер для накопичення логів
let logBuffer: string[] = [];
let flushTimeout: NodeJS.Timeout | null = null;
let isWriting = false;

const FLUSH_INTERVAL_MS = 500; // Записувати кожні 500мс
const MAX_BUFFER_SIZE = 50; // Або коли накопичиться 50 записів

function getLogFilePath(): string {
  if (!logFilePath) {
    const logsDir = join(app.getPath('userData'), 'logs');
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
    const date = new Date().toISOString().split('T')[0];
    logFilePath = join(logsDir, `lbk-${date}.log`);
  }
  return logFilePath;
}

function formatLogMessage(level: string, message: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const formattedArgs =
    args.length > 0
      ? ` ${args
          .map((arg) => {
            if (typeof arg === 'object') {
              try {
                return JSON.stringify(arg);
              } catch {
                return String(arg);
              }
            }
            return String(arg);
          })
          .join(' ')}`
      : '';
  return `[${timestamp}] [${level}] ${message}${formattedArgs}\n`;
}

/**
 * Асинхронний flush буфера на диск
 */
async function flushBuffer(): Promise<void> {
  if (isWriting || logBuffer.length === 0) return;

  isWriting = true;
  const dataToWrite = logBuffer.join('');
  logBuffer = [];

  try {
    const filePath = getLogFilePath();
    await appendFile(filePath, dataToWrite);
  } catch (error) {
    // Silent fail - записуємо в оригінальний console
    originalConsoleError('[Logger] Failed to write to log file:', error);
  } finally {
    isWriting = false;
  }
}

/**
 * Запланувати flush якщо ще не заплановано
 */
function scheduleFlush(): void {
  if (flushTimeout) return;

  flushTimeout = setTimeout(() => {
    flushTimeout = null;
    flushBuffer();
  }, FLUSH_INTERVAL_MS);
}

/**
 * Додати повідомлення до буфера
 */
function writeToFile(logMessage: string): void {
  if (!saveLogsEnabled) return;

  logBuffer.push(logMessage);

  // Flush негайно якщо буфер заповнений
  if (logBuffer.length >= MAX_BUFFER_SIZE) {
    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    flushBuffer();
  } else {
    scheduleFlush();
  }
}

/**
 * Синхронний flush при закритті застосунку
 */
function flushLogsSync(): void {
  if (logBuffer.length === 0) return;

  try {
    const filePath = getLogFilePath();
    const dataToWrite = logBuffer.join('');
    appendFileSync(filePath, dataToWrite);
    logBuffer = [];
  } catch (error) {
    originalConsoleError('[Logger] Failed to flush logs:', error);
  }
}

export function setSaveLogsEnabled(enabled: boolean): void {
  saveLogsEnabled = enabled;

  if (enabled) {
    // Write header to log file when logging is enabled
    const filePath = getLogFilePath();
    if (!existsSync(filePath)) {
      writeFileSync(
        filePath,
        `=== LBK Launcher Logs ===\nStarted: ${new Date().toISOString()}\n\n`
      );
    }
  } else {
    // Flush буфер перед вимкненням
    flushLogsSync();
  }
}

export function isSaveLogsEnabled(): boolean {
  return saveLogsEnabled;
}

// Override console methods to also write to file
const originalConsoleLog = console.log.bind(console);
const originalConsoleError = console.error.bind(console);
const originalConsoleWarn = console.warn.bind(console);
const originalConsoleInfo = console.info.bind(console);

export function initLogger(): void {
  // Clean up old logs on startup
  cleanupOldLogs();

  console.log = (message: string, ...args: unknown[]) => {
    originalConsoleLog(message, ...args);
    writeToFile(formatLogMessage('LOG', message, ...args));
  };

  console.error = (message: string, ...args: unknown[]) => {
    originalConsoleError(message, ...args);
    writeToFile(formatLogMessage('ERROR', message, ...args));
  };

  console.warn = (message: string, ...args: unknown[]) => {
    originalConsoleWarn(message, ...args);
    writeToFile(formatLogMessage('WARN', message, ...args));
  };

  console.info = (message: string, ...args: unknown[]) => {
    originalConsoleInfo(message, ...args);
    writeToFile(formatLogMessage('INFO', message, ...args));
  };

  // Flush логи при закритті застосунку
  app.on('before-quit', () => {
    flushLogsSync();
  });

  app.on('will-quit', () => {
    flushLogsSync();
  });
}

export function getLogFileDirectory(): string {
  return join(app.getPath('userData'), 'logs');
}

/**
 * Clean up old log files (older than LOG_RETENTION_DAYS)
 */
function cleanupOldLogs(): void {
  try {
    const logsDir = getLogFileDirectory();
    if (!existsSync(logsDir)) return;

    const files = readdirSync(logsDir);
    const now = Date.now();
    const maxAge = LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (!file.startsWith('lbk-') || !file.endsWith('.log')) continue;

      const filePath = join(logsDir, file);
      try {
        const stats = statSync(filePath);
        const fileAge = now - stats.mtimeMs;

        if (fileAge > maxAge) {
          unlinkSync(filePath);
          originalConsoleLog(`[Logger] Deleted old log file: ${file}`);
        }
      } catch {
        // Ignore errors for individual files
      }
    }
  } catch (error) {
    originalConsoleError('[Logger] Failed to cleanup old logs:', error);
  }
}
