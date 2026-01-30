import winston from 'winston';
import 'winston-daily-rotate-file';

// Format configuration
const logFormat = winston.format.printf((info) => {
  const { level, message, label, timestamp, ...meta } = info;
  const metaKeys = Object.keys(meta).filter(key => meta[key] !== undefined);
  const metaString = metaKeys.length ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] [${label}]: ${message}${metaString}`;
});

const logger = winston.createLogger({
  level: 'info', // info, warn, error
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.label({ label: 'Core Service' })
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),

    // Rotating file transport
    new winston.transports.DailyRotateFile({
      filename: 'logs/%DATE%-app.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '3d', // Keep logs for 3 days
      maxSize: '20m',
      format: logFormat
    }),

    // Separate error logger
    new winston.transports.DailyRotateFile({
      filename: 'logs/%DATE%-error.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '3d', // Keep error logs for 3 days
      maxSize: '20m',
      format: logFormat
    })
  ]
});

export default logger;
