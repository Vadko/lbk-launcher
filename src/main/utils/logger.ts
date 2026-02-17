import { app } from 'electron';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { join } from 'path';

const LOG_RETENTION_DAYS = 1;

let logFilePath: string | null = null;

// Зберігаємо оригінальні console методи до override
const originalConsole = {
  log: console.log.bind(console),
  error: console.error.bind(console),
  warn: console.warn.bind(console),
  info: console.info.bind(console),
};

// --- Log file ---

function getLogFilePath(): string {
  if (!logFilePath) {
    const logsDir = join(app.getPath('userData'), 'logs');
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
    logFilePath = join(logsDir, `lbk-${new Date().toISOString().split('T')[0]}.log`);
  }
  return logFilePath;
}

// --- Formatting ---

function formatMessage(level: string, message: string, ...args: unknown[]): string {
  const timestamp = new Date().toISOString();
  const formattedArgs =
    args.length > 0
      ? ` ${args
          .map((arg) => {
            if (arg instanceof Error) {
              return `${arg.message}${arg.stack ? `\n${arg.stack}` : ''}`;
            }
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

function getConsoleTimestamp(): string {
  const now = new Date();
  return `[${now.toTimeString().split(' ')[0]}.${String(now.getMilliseconds()).padStart(3, '0')}]`;
}

// --- Writing ---

function writeToFile(message: string): void {
  try {
    appendFileSync(getLogFilePath(), message);
  } catch {
    // Silent fail
  }
}

// --- Public API ---

export function initLogger(): void {
  cleanupOldLogs();

  // Header для нового лог-файлу
  const filePath = getLogFilePath();
  if (!existsSync(filePath)) {
    writeFileSync(
      filePath,
      `=== LBK Launcher Logs ===\nStarted: ${new Date().toISOString()}\n\n`
    );
  }

  console.log = (message: string, ...args: unknown[]) => {
    originalConsole.log(getConsoleTimestamp(), message, ...args);
    writeToFile(formatMessage('LOG', message, ...args));
  };

  console.error = (message: string, ...args: unknown[]) => {
    originalConsole.error(getConsoleTimestamp(), message, ...args);
    writeToFile(formatMessage('ERROR', message, ...args));
  };

  console.warn = (message: string, ...args: unknown[]) => {
    originalConsole.warn(getConsoleTimestamp(), message, ...args);
    writeToFile(formatMessage('WARN', message, ...args));
  };

  console.info = (message: string, ...args: unknown[]) => {
    originalConsole.info(getConsoleTimestamp(), message, ...args);
    writeToFile(formatMessage('INFO', message, ...args));
  };
}

export function getLogFileDirectory(): string {
  return join(app.getPath('userData'), 'logs');
}

// --- Timer ---

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

// --- Cleanup ---

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
        if (now - stats.mtimeMs > maxAge) {
          unlinkSync(filePath);
          originalConsole.log(`[Logger] Deleted old log file: ${file}`);
        }
      } catch {
        // Ignore
      }
    }
  } catch {
    // Ignore
  }
}
