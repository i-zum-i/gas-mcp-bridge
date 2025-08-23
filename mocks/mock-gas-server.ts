import express from 'express';
import { Server } from 'http';

export interface MockGASResponse {
  ok: boolean;
  result?: unknown;
  message?: string;
}

export interface MockGASRequest {
  tool: string;
  args: unknown;
}

export class MockGASServer {
  private app: express.Application;
  private server: Server | null = null;
  private port: number;
  private responses: Map<string, MockGASResponse> = new Map();
  private requests: MockGASRequest[] = [];
  private requireAuth = false;
  private validToken?: string;

  constructor(port = 0) {
    this.port = port;
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes(): void {
    this.app.post('/exec', (req, res) => {
      // Authentication check
      if (this.requireAuth) {
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
        
        if (!token || token !== this.validToken) {
          return res.json({
            ok: false,
            message: 'unauthorized'
          });
        }
      }

      const request: MockGASRequest = req.body;
      this.requests.push(request);

      // Find mock response for this tool
      const mockResponse = this.responses.get(request.tool);
      
      if (mockResponse) {
        res.json(mockResponse);
      } else {
        // Default echo behavior
        res.json({
          ok: true,
          result: {
            tool: request.tool,
            args: request.args,
            message: `Mock response for ${request.tool}`
          }
        });
      }
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });
  }

  async start(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.port, (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          const actualPort = (this.server!.address() as any)?.port || this.port;
          this.port = actualPort;
          resolve(`http://localhost:${actualPort}`);
        }
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  getUrl(): string {
    return `http://localhost:${this.port}`;
  }

  getExecUrl(): string {
    return `${this.getUrl()}/exec`;
  }

  // Test helper methods
  setMockResponse(tool: string, response: MockGASResponse): void {
    this.responses.set(tool, response);
  }

  setAuthToken(token: string): void {
    this.validToken = token;
    this.requireAuth = true;
  }

  disableAuth(): void {
    this.requireAuth = false;
    this.validToken = undefined;
  }

  getRequests(): MockGASRequest[] {
    return [...this.requests];
  }

  clearRequests(): void {
    this.requests = [];
  }

  clearMockResponses(): void {
    this.responses.clear();
  }

  reset(): void {
    this.clearRequests();
    this.clearMockResponses();
    this.disableAuth();
  }
}

// Factory function for easy testing
export function createMockGASServer(port = 0): MockGASServer {
  return new MockGASServer(port);
}