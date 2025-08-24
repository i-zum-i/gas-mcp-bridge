import pc from 'picocolors';

// Debug logging configuration
const DEBUG = process.env.DEBUG === '1' || process.env.NODE_ENV === 'development';
const MCP_DEBUG = process.env.MCP_DEBUG === '1';

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
  debug: (message: string, data?: any) => {
    if (DEBUG || MCP_DEBUG) {
      const timestamp = new Date().toISOString();
      const dataStr = data ? ` ${JSON.stringify(data, null, 2)}` : '';
      console.log(`${pc.gray(`[DEBUG ${timestamp}]`)} ${message}${dataStr}`);
    }
  },
  mcpRequest: (method: string, params?: any) => {
    if (MCP_DEBUG) {
      const timestamp = new Date().toISOString();
      console.log(`${pc.cyan(`[MCP-REQ ${timestamp}]`)} ${method}`);
      if (params) {
        console.log(`${pc.cyan('[MCP-REQ-PARAMS]')} ${JSON.stringify(params, null, 2)}`);
      }
    }
  },
  mcpResponse: (method: string, response?: any) => {
    if (MCP_DEBUG) {
      const timestamp = new Date().toISOString();
      console.log(`${pc.magenta(`[MCP-RES ${timestamp}]`)} ${method}`);
      if (response) {
        console.log(`${pc.magenta('[MCP-RES-DATA]')} ${JSON.stringify(response, null, 2)}`);
      }
    }
  },
  mcpError: (method: string, error: any) => {
    if (MCP_DEBUG) {
      const timestamp = new Date().toISOString();
      console.error(`${pc.red(`[MCP-ERR ${timestamp}]`)} ${method}`);
      console.error(`${pc.red('[MCP-ERR-DETAIL]')} ${error instanceof Error ? error.message : JSON.stringify(error)}`);
      if (error instanceof Error && error.stack) {
        console.error(`${pc.red('[MCP-ERR-STACK]')} ${error.stack}`);
      }
    }
  }
};

// Export debug configuration for use in other modules
export const isDebugMode = () => DEBUG || MCP_DEBUG;
export const isMcpDebugMode = () => MCP_DEBUG;
