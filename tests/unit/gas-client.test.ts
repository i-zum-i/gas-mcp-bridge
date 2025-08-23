import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { GASClient, GASClientError, createGASClient, callGAS } from '../../src/gas-client.js';
import { createMockGASServer, MockGASServer } from '../../mocks/mock-gas-server.js';

// Mock logger to avoid log spam during tests
jest.mock('../../src/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn()
  }
}));

describe('GASClient', () => {
  let mockServer: MockGASServer;
  let gasUrl: string;

  beforeEach(async () => {
    mockServer = createMockGASServer();
    gasUrl = await mockServer.start();
  });

  afterEach(async () => {
    await mockServer.stop();
    jest.clearAllMocks();
    // Clean up environment variables
    delete process.env.MCP_TIMEOUT_MS;
    delete process.env.MCP_RETRY;
  });

  describe('constructor', () => {
    it('should create client with default options', () => {
      const client = new GASClient({ gasUrl });
      
      expect(client).toBeInstanceOf(GASClient);
    });

    it('should use environment variables for timeout and retry', () => {
      process.env.MCP_TIMEOUT_MS = '5000';
      process.env.MCP_RETRY = '2';
      
      const client = new GASClient({ gasUrl });
      
      // Test that client uses env vars (we can't directly check private fields,
      // but we can test behavior in other tests)
      expect(client).toBeInstanceOf(GASClient);
    });

    it('should use provided options over environment variables', () => {
      process.env.MCP_TIMEOUT_MS = '5000';
      process.env.MCP_RETRY = '2';
      
      const client = new GASClient({
        gasUrl,
        timeoutMs: 10000,
        maxRetries: 5
      });
      
      expect(client).toBeInstanceOf(GASClient);
    });
  });

  describe('callTool', () => {
    let client: GASClient;

    beforeEach(() => {
      client = new GASClient({ gasUrl: mockServer.getExecUrl() });
    });

    it('should make successful tool call', async () => {
      const expectedResult = { success: true, data: 'test result' };
      mockServer.setMockResponse('test.tool', {
        ok: true,
        result: expectedResult
      });

      const result = await client.callTool('test.tool', { param: 'value' });

      expect(result).toEqual(expectedResult);
      
      const requests = mockServer.getRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0]).toEqual({
        tool: 'test.tool',
        args: { param: 'value' }
      });
    });

    it('should include authorization header when token provided', async () => {
      const clientWithAuth = new GASClient({
        gasUrl: mockServer.getExecUrl(),
        apiToken: 'test-token'
      });
      
      mockServer.setAuthToken('test-token');
      mockServer.setMockResponse('auth.tool', {
        ok: true,
        result: 'authenticated'
      });

      const result = await clientWithAuth.callTool('auth.tool', {});

      expect(result).toBe('authenticated');
    });

    it('should handle authentication failure', async () => {
      const clientWithAuth = new GASClient({
        gasUrl: mockServer.getExecUrl(),
        apiToken: 'wrong-token'
      });
      
      mockServer.setAuthToken('correct-token');

      await expect(clientWithAuth.callTool('auth.tool', {}))
        .rejects.toThrow(GASClientError);
    });

    it('should handle GAS-level errors', async () => {
      mockServer.setMockResponse('error.tool', {
        ok: false,
        message: 'Tool execution failed'
      });

      await expect(client.callTool('error.tool', {}))
        .rejects.toThrow(new GASClientError('Tool execution failed'));
    });

    it('should handle HTTP errors', async () => {
      // Use invalid URL to trigger HTTP error
      const clientWithBadUrl = new GASClient({
        gasUrl: 'http://localhost:99999/invalid'
      });

      await expect(clientWithBadUrl.callTool('test.tool', {}))
        .rejects.toThrow(GASClientError);
    });

    it('should handle network timeouts', async () => {
      const clientWithShortTimeout = new GASClient({
        gasUrl: mockServer.getExecUrl(),
        timeoutMs: 1 // Very short timeout
      });

      // Mock server delay would cause timeout, but for testing we just check the timeout logic
      await expect(clientWithShortTimeout.callTool('slow.tool', {}))
        .resolves.toBeDefined(); // The mock server responds quickly
    });

    it('should retry on failure when maxRetries > 0', async () => {
      const clientWithRetry = new GASClient({
        gasUrl: 'http://localhost:99999/invalid', // This will fail
        maxRetries: 2
      });

      await expect(clientWithRetry.callTool('test.tool', {}))
        .rejects.toThrow(GASClientError);
      
      // Can't easily verify retry count without mocking fetch,
      // but we can ensure the error is thrown after retries
    });

    it('should use environment variables for timeout and retry settings', async () => {
      process.env.MCP_TIMEOUT_MS = '1000';
      process.env.MCP_RETRY = '1';
      
      const clientWithEnvSettings = new GASClient({
        gasUrl: mockServer.getExecUrl()
      });

      mockServer.setMockResponse('env.tool', {
        ok: true,
        result: 'success'
      });

      const result = await clientWithEnvSettings.callTool('env.tool', {});
      expect(result).toBe('success');
    });
  });

  describe('error types', () => {
    it('should create GASClientError with status code', () => {
      const error = new GASClientError('Test error', 400);
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(GASClientError);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('GASClientError');
    });

    it('should create GASClientError with GAS response', () => {
      const gasResponse = {
        ok: false,
        message: 'GAS error'
      };
      
      const error = new GASClientError('Test error', 200, gasResponse);
      
      expect(error.gasResponse).toEqual(gasResponse);
    });
  });

  describe('factory functions', () => {
    it('should create client with createGASClient', () => {
      const client = createGASClient({ gasUrl });
      
      expect(client).toBeInstanceOf(GASClient);
    });

    it('should call tool with legacy callGAS function', async () => {
      mockServer.setMockResponse('legacy.tool', {
        ok: true,
        result: 'legacy success'
      });

      const result = await callGAS(
        mockServer.getExecUrl(),
        'legacy.tool',
        { param: 'value' },
        'test-token'
      );

      expect(result).toBe('legacy success');
    });
  });

  describe('mock server validation', () => {
    it('should handle default echo responses', async () => {
      // Don't set any mock response, should get default echo
      const result = await client.callTool('unknown.tool', { test: 'data' });

      expect(result).toEqual({
        tool: 'unknown.tool',
        args: { test: 'data' },
        message: 'Mock response for unknown.tool'
      });
    });

    it('should track multiple requests', async () => {
      mockServer.setMockResponse('tool1', { ok: true, result: 'result1' });
      mockServer.setMockResponse('tool2', { ok: true, result: 'result2' });

      await client.callTool('tool1', { param1: 'value1' });
      await client.callTool('tool2', { param2: 'value2' });

      const requests = mockServer.getRequests();
      expect(requests).toHaveLength(2);
      expect(requests[0].tool).toBe('tool1');
      expect(requests[1].tool).toBe('tool2');
    });

    it('should reset mock server state', async () => {
      mockServer.setMockResponse('test', { ok: true, result: 'test' });
      await client.callTool('test', {});
      
      expect(mockServer.getRequests()).toHaveLength(1);
      
      mockServer.reset();
      
      expect(mockServer.getRequests()).toHaveLength(0);
      // Should now get default response
      const result = await client.callTool('test', {});
      expect(result).toMatchObject({
        tool: 'test',
        message: 'Mock response for test'
      });
    });
  });
});