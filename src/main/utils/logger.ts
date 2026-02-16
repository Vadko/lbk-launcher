import { app } from 'electron';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { appendFile } from 'fs/promises';
import { join } from 'path';

const LOG_RETENTION_DAYS = 7;
const LOGGER_CONFIG_FILE = 'logger-config.json';

let saveLogsEnabled = false;
let logFilePath: string | null = null;

// Буфер для накопичення логів
let logBuffer: string[] = [];
let flushTimeout: NodeJS.Timeout | null = null;
let isWriting = false;

const FLUSH_INTERVAL_MS = 500; // Записувати кожні 500мс
const MAX_BUFFER_SIZE = 50; // Або коли накопичиться 50 записів

/**
 * Отримати шлях до конфіг файлу логера
 */
function getLoggerConfigPath(): string {
  return join(app.getPath('userData'), LOGGER_CONFIG_FILE);
}

/**
 * Прочитати налаштування логера з файлу (викликається при старті)
 */
function readLoggerConfig(): boolean {
  try {
    const configPath = getLoggerConfigPath();
    if (existsSync(configPath)) {
      const data = JSON.parse(readFileSync(configPath, 'utf-8'));
      return data.enabled === true;
    }
  } catch {
    // Ignore errors, use default
  }
  return false;
}

/**
 * Зберегти налаштування логера у файл
 */
function saveLoggerConfig(enabled: boolean): void {
  try {
    const configPath = getLoggerConfigPath();
    writeFileSync(configPath, JSON.stringify({ enabled }));
  } catch {
    // Ignore errors
  }
}

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
  // Зберегти налаштування у файл для наступного запуску
  saveLoggerConfig(enabled);

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

// Override console methods to also write to file
const originalConsoleLog = console.log.bind(console);
const originalConsoleError = console.error.bind(console);
const originalConsoleWarn = console.warn.bind(console);
const originalConsoleInfo = console.info.bind(console);

/**
 * Форматувати таймстемп для консолі (тільки час з мілісекундами)
 */
function getConsoleTimestamp(): string {
  const now = new Date();
  return `[${now.toTimeString().split(' ')[0]}.${String(now.getMilliseconds()).padStart(3, '0')}]`;
}

export function initLogger(): void {
  // Прочитати налаштування логера з файлу
  saveLogsEnabled = readLoggerConfig();

  // Clean up old logs on startup
  cleanupOldLogs();

  // Write header if logging is enabled
  if (saveLogsEnabled) {
    const filePath = getLogFilePath();
    if (!existsSync(filePath)) {
      writeFileSync(
        filePath,
        `=== LBK Launcher Logs ===\nStarted: ${new Date().toISOString()}\n\n`
      );
    }
  }

  console.log = (message: string, ...args: unknown[]) => {
    originalConsoleLog(getConsoleTimestamp(), message, ...args);
    writeToFile(formatLogMessage('LOG', message, ...args));
  };

  console.error = (message: string, ...args: unknown[]) => {
    originalConsoleError(getConsoleTimestamp(), message, ...args);
    writeToFile(formatLogMessage('ERROR', message, ...args));
  };

  console.warn = (message: string, ...args: unknown[]) => {
    originalConsoleWarn(getConsoleTimestamp(), message, ...args);
    writeToFile(formatLogMessage('WARN', message, ...args));
  };

  console.info = (message: string, ...args: unknown[]) => {
    originalConsoleInfo(getConsoleTimestamp(), message, ...args);
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
 * Вимірювач часу для профілювання операцій
 */
export function createTimer(label: string): { end: () => number } {
  const start = performance.now();
  console.log(`[PERF] ⏱️ START: ${label}`);

  return {
    end: () => {
      const duration = performance.now() - start;
      const formatted =
        duration < 1000 ? `${duration.toFixed(1)}ms` : `${(duration / 1000).toFixed(2)}s`;
      console.log(`[PERF] ✅ END: ${label} (${formatted})`);
      return duration;
    },
  };
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
