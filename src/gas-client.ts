import { logger } from './logger.js';

export interface GASRequest {
  tool: string;
  args: unknown;
}

export interface GASResponse {
  ok: boolean;
  result?: unknown;
  message?: string;
}

export interface GASClientOptions {
  gasUrl: string;
  apiToken?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export class GASClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public gasResponse?: GASResponse
  ) {
    super(message);
    this.name = 'GASClientError';
  }
}

export class GASClient {
  private readonly gasUrl: string;
  private readonly apiToken?: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: GASClientOptions) {
    this.gasUrl = options.gasUrl;
    this.apiToken = options.apiToken;
    this.timeoutMs = options.timeoutMs ?? parseInt(process.env.MCP_TIMEOUT_MS || '30000', 10);
    this.maxRetries = options.maxRetries ?? parseInt(process.env.MCP_RETRY || '0', 10);
  }

  async callTool(tool: string, args: unknown): Promise<unknown> {
    const request: GASRequest = { tool, args };
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          logger.info(`Retrying GAS call for tool "${tool}" (attempt ${attempt + 1}/${this.maxRetries + 1})`);
        }

        const result = await this.performRequest(request);
        
        if (attempt > 0) {
          logger.success(`GAS call succeeded on retry for tool "${tool}"`);
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < this.maxRetries) {
          logger.warn(`GAS call failed for tool "${tool}": ${lastError.message}. Retrying...`);
          // Simple exponential backoff
          const delayMs = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          logger.error(`GAS call failed for tool "${tool}" after ${this.maxRetries + 1} attempts: ${lastError.message}`);
        }
      }
    }

    // All retries failed, throw the last error
    throw lastError;
  }

  private async performRequest(request: GASRequest): Promise<unknown> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiToken && { 'Authorization': `Bearer ${this.apiToken}` })
        },
        body: JSON.stringify(request),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Handle non-200 HTTP status codes
      if (!response.ok) {
        throw new GASClientError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status
        );
      }

      const gasResponse: GASResponse = await response.json();

      // Handle GAS-level errors (non-ok responses)
      if (!gasResponse.ok) {
        throw new GASClientError(
          gasResponse.message || 'GAS execution failed',
          response.status,
          gasResponse
        );
      }

      return gasResponse.result;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof GASClientError) {
        throw error;
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new GASClientError(`Request timeout after ${this.timeoutMs}ms`);
      }
      
      throw new GASClientError(
        `Network error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// Factory function for creating GAS client
export function createGASClient(options: GASClientOptions): GASClient {
  return new GASClient(options);
}

// Utility function for one-off calls (backward compatibility)
export async function callGAS(
  gasUrl: string,
  tool: string,
  args: unknown,
  token?: string
): Promise<unknown> {
  const client = createGASClient({
    gasUrl,
    apiToken: token,
  });
  
  return client.callTool(tool, args);
}