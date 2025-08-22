import pc from 'picocolors';

export const logger = {
  info: (message: string) => {
    console.log(`${pc.blue('[INFO]')} ${message}`);
  },
  warn: (message: string) => {
    console.warn(`${pc.yellow('[WARN]')} ${message}`);
  },
  error: (message: string) => {
    console.error(`${pc.red('[ERROR]')} ${message}`);
  },
  success: (message: string) => {
    console.log(`${pc.green('[SUCCESS]')} ${message}`);
  },
};
