const winston = require('winston');
const path = require('path');
const fs = require('fs');

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const env = process.env.NODE_ENV || 'development';
const isDevelopment = env === 'development';
const defaultLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'cyan',
};

winston.addColors(colors);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => `${info.timestamp} ${info.level}: ${info.message}`),
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json(),
);

const transports = [
  new winston.transports.Console({ format: consoleFormat }),
];

const logToFiles = String(process.env.LOG_TO_FILES || '').toLowerCase() === 'true';
if (logToFiles) {
  const logsDir = process.env.LOG_FILES_DIR || path.join(process.cwd(), 'logs');
  try {
    fs.mkdirSync(logsDir, { recursive: true });
  } catch (err) {
    // se la cartella non può essere creata, ricadiamo su console-only
    console.warn(`Logger: impossibile creare la cartella log (${logsDir}): ${err.message}`);
  }

  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: fileFormat,
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: fileFormat,
    }),
  );
}

const logger = winston.createLogger({
  level: defaultLevel,
  levels,
  transports,
  exitOnError: false,
});

module.exports = logger;