// Logger utilities placeholder

export const logger = {
  info: (message: string, meta?: any): void => {
    console.log(`[INFO] ${message}`, meta || '');
  },

  error: (message: string, error?: Error): void => {
    console.error(`[ERROR] ${message}`, error || '');
  },

  warn: (message: string, meta?: any): void => {
    console.warn(`[WARN] ${message}`, meta || '');
  },

  debug: (message: string, meta?: any): void => {
    if (process.env['NODE_ENV'] === 'development') {
      console.debug(`[DEBUG] ${message}`, meta || '');
    }
  },
};
