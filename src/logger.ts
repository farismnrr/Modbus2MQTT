import { EventEmitter } from 'node:events';
import { LogLevel } from './config/schema.js';

export interface LogEntry {
  level: 'debug' | 'info' | 'warning' | 'error';
  message: string;
  namespace: string;
  timestamp: string;
}

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export class BridgeLogger extends EventEmitter {
  private level: LogLevel = 'info';
  private readonly history: LogEntry[] = [];
  private readonly maxHistory = 300;

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getHistory(): LogEntry[] {
    return [...this.history];
  }

  log(level: LogLevel, namespace: string, message: string): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[this.level]) return;
    const z2mLevel = level === 'warn' ? 'warning' : level;
    const entry: LogEntry = {
      level: z2mLevel,
      message,
      namespace,
      timestamp: new Date().toISOString(),
    };
    this.history.push(entry);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    const line = `[${entry.timestamp}] ${z2mLevel}: ${namespace}: ${message}`;
    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else {
      console.log(line);
    }
    this.emit('log', entry);
  }

  debug(namespace: string, message: string): void {
    this.log('debug', namespace, message);
  }

  info(namespace: string, message: string): void {
    this.log('info', namespace, message);
  }

  warn(namespace: string, message: string): void {
    this.log('warn', namespace, message);
  }

  error(namespace: string, message: string): void {
    this.log('error', namespace, message);
  }
}
