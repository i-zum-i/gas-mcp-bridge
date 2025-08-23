import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { spawn, ChildProcess } from 'child_process';
import { createMockGASServer, MockGASServer } from '../../mocks/mock-gas-server.js';
import { generate } from '../../src/generate.js';
import * as discover from '../../src/discover.js';

// Mock logger to reduce test output noise
jest.mock('../../src/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn()
  }
}));

describe('E2E Local Integration Tests', () => {
  let tempDir: string;
  let originalCwd: string;
  let mockGASServer: MockGASServer;
  let gasServerUrl: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'mcp-e2e-test-'));
    process.chdir(tempDir);
    
    // Start mock GAS server
    mockGASServer = createMockGASServer();
    gasServerUrl = await mockGASServer.start();
    
    jest.clearAllMocks();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rmdir(tempDir, { recursive: true });
    await mockGASServer.stop();
    
    // Clean environment variables
    delete process.env.GAS_API_TOKEN;
    delete process.env.MCP_STRICT;
    delete process.env.MCP_MODE;
  });

  describe('Full workflow: annotation → build → start', () => {
    it('should complete full workflow with GAS annotations', async () => {
      // 1. Create GAS source file with annotations
      const gasSourceFile = `
/* @mcp
name: sheet.appendRow
description: Append a row to a Google Sheet
path: sheet.appendRow
schema:
  type: object
  properties:
    spreadsheetId:
      type: string
      description: The ID of the spreadsheet
    values:
      type: array
      items:
        type: string
      description: Array of values to append
  required: [spreadsheetId, values]
*/
function sheet_appendRow({ spreadsheetId, values }) {
  // Mock implementation
  console.log(\`Appending to \${spreadsheetId}: \${values.join(', ')}\`);
  return { 
    success: true, 
    rowsAdded: 1,
    spreadsheetId,
    values 
  };
}

/* @mcp
name: drive.listFiles
description: List files in Google Drive
path: drive.listFiles
schema:
  type: object
  properties:
    query:
      type: string
      description: Search query
    maxResults:
      type: number
      description: Maximum number of results
      default: 10
  required: [query]
*/
function drive_listFiles({ query, maxResults = 10 }) {
  // Mock implementation
  return {
    files: [
      { id: '1', name: 'Document 1', type: 'document' },
      { id: '2', name: 'Spreadsheet 1', type: 'spreadsheet' }
    ],
    query,
    maxResults
  };
}
      `;

      await fs.writeFile('Code.gs', gasSourceFile.trim());

      // 2. Test generate function (mcp build equivalent)
      const tools = await generate();

      expect(tools.size).toBe(2);
      expect(tools.has('sheet.appendRow')).toBe(true);
      expect(tools.has('drive.listFiles')).toBe(true);

      const sheetTool = tools.get('sheet.appendRow');
      expect(sheetTool).toMatchObject({
        name: 'sheet.appendRow',
        description: 'Append a row to a Google Sheet',
        path: 'sheet.appendRow',
        schema: expect.objectContaining({
          type: 'object',
          properties: expect.objectContaining({
            spreadsheetId: expect.objectContaining({ type: 'string' }),
            values: expect.objectContaining({ type: 'array' })
          })
        })
      });

      // 3. Create mock GAS configuration
      const gasConfig = {
        scriptId: 'test-script-id-e2e',
        deploymentId: 'test-deployment-e2e',
        gasUrl: mockGASServer.getExecUrl(),
        apiToken: 'test-api-token-e2e'
      };

      await fs.writeFile('.mcp-gas.json', JSON.stringify(gasConfig, null, 2));

      // 4. Set up mock GAS responses
      mockGASServer.setAuthToken('test-api-token-e2e');
      
      mockGASServer.setMockResponse('sheet.appendRow', {
        ok: true,
        result: {
          success: true,
          rowsAdded: 1,
          spreadsheetId: 'test-spreadsheet-id',
          values: ['John', 'Doe', '30']
        }
      });

      mockGASServer.setMockResponse('drive.listFiles', {
        ok: true,
        result: {
          files: [
            { id: '1', name: 'Test Document', type: 'document' },
            { id: '2', name: 'Test Spreadsheet', type: 'spreadsheet' }
          ],
          query: 'test',
          maxResults: 10
        }
      });

      // 5. Test the complete flow by importing and testing components
      const { createGASClient } = await import('../../src/gas-client.js');
      
      const gasClient = createGASClient({
        gasUrl: mockGASServer.getExecUrl(),
        apiToken: 'test-api-token-e2e'
      });

      // Test sheet.appendRow tool
      const sheetResult = await gasClient.callTool('sheet.appendRow', {
        spreadsheetId: 'test-spreadsheet-id',
        values: ['John', 'Doe', '30']
      });

      expect(sheetResult).toEqual({
        success: true,
        rowsAdded: 1,
        spreadsheetId: 'test-spreadsheet-id',
        values: ['John', 'Doe', '30']
      });

      // Test drive.listFiles tool
      const driveResult = await gasClient.callTool('drive.listFiles', {
        query: 'test',
        maxResults: 10
      });

      expect(driveResult).toEqual({
        files: [
          { id: '1', name: 'Test Document', type: 'document' },
          { id: '2', name: 'Test Spreadsheet', type: 'spreadsheet' }
        ],
        query: 'test',
        maxResults: 10
      });

      // 6. Verify mock server received the expected requests
      const requests = mockGASServer.getRequests();
      expect(requests).toHaveLength(2);

      expect(requests[0]).toEqual({
        tool: 'sheet.appendRow',
        args: {
          spreadsheetId: 'test-spreadsheet-id',
          values: ['John', 'Doe', '30']
        }
      });

      expect(requests[1]).toEqual({
        tool: 'drive.listFiles',
        args: {
          query: 'test',
          maxResults: 10
        }
      });
    });

    it('should handle error scenarios end-to-end', async () => {
      // Create source with annotation
      const gasSourceFile = `
/* @mcp
name: error.tool
description: A tool that throws errors
path: error.tool
schema:
  type: object
  properties:
    shouldFail:
      type: boolean
      default: false
*/
function error_tool({ shouldFail = false }) {
  if (shouldFail) {
    throw new Error('Intentional error for testing');
  }
  return { success: true };
}
      `;

      await fs.writeFile('ErrorCode.gs', gasSourceFile.trim());

      // Generate tools
      const tools = await generate();
      expect(tools.has('error.tool')).toBe(true);

      // Set up GAS config
      const gasConfig = {
        scriptId: 'error-script-id',
        deploymentId: 'error-deployment-id',
        gasUrl: mockGASServer.getExecUrl(),
        apiToken: 'error-api-token'
      };
      await fs.writeFile('.mcp-gas.json', JSON.stringify(gasConfig, null, 2));

      // Set up mock error response
      mockGASServer.setAuthToken('error-api-token');
      mockGASServer.setMockResponse('error.tool', {
        ok: false,
        message: 'Intentional error for testing'
      });

      // Test error handling
      const { createGASClient, GASClientError } = await import('../../src/gas-client.js');
      
      const gasClient = createGASClient({
        gasUrl: mockGASServer.getExecUrl(),
        apiToken: 'error-api-token'
      });

      await expect(gasClient.callTool('error.tool', { shouldFail: true }))
        .rejects.toThrow('Intentional error for testing');

      // Verify the error request was received
      const requests = mockGASServer.getRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].tool).toBe('error.tool');
    });

    it('should handle authentication errors', async () => {
      // Set up basic configuration
      const gasConfig = {
        scriptId: 'auth-test-script',
        deploymentId: 'auth-test-deployment',
        gasUrl: mockGASServer.getExecUrl(),
        apiToken: 'wrong-token'
      };
      await fs.writeFile('.mcp-gas.json', JSON.stringify(gasConfig, null, 2));

      // Set up auth requirement with different token
      mockGASServer.setAuthToken('correct-token');

      const { createGASClient, GASClientError } = await import('../../src/gas-client.js');
      
      const gasClient = createGASClient({
        gasUrl: mockGASServer.getExecUrl(),
        apiToken: 'wrong-token'  // Wrong token
      });

      await expect(gasClient.callTool('any.tool', {}))
        .rejects.toThrow('unauthorized');
    });

    it('should work with echo tool when no annotations found', async () => {
      // Create source file without annotations
      await fs.writeFile('NoAnnotations.gs', `
        function regularFunction() {
          return 'This function has no MCP annotations';
        }
      `);

      // Generate should create echo tool
      const tools = await generate();
      expect(tools.size).toBe(1);
      expect(tools.has('echo')).toBe(true);

      const echoTool = tools.get('echo');
      expect(echoTool).toMatchObject({
        name: 'echo',
        path: 'echo',
        description: expect.stringContaining('echo')
      });

      // Echo tool doesn't need GAS server, it responds locally
      // This would be tested in the server integration tests
    });
  });

  describe('Environment variable integration', () => {
    it('should respect MCP_STRICT environment variable', async () => {
      process.env.MCP_STRICT = '1';

      // Create source file without annotations
      await fs.writeFile('Empty.gs', '// No annotations');

      // Should throw in strict mode
      await expect(generate()).rejects.toThrow(
        'MCP_STRICT mode is enabled and no tool definitions were found.'
      );
    });

    it('should respect MCP_MODE=empty environment variable', async () => {
      process.env.MCP_MODE = 'empty';

      // Create source file without annotations
      await fs.writeFile('Empty.gs', '// No annotations');

      const tools = await generate();
      expect(tools.size).toBe(0);
    });

    it('should use GAS_API_TOKEN from environment', async () => {
      process.env.GAS_API_TOKEN = 'env-api-token';

      // Set up GAS config without apiToken
      const gasConfig = {
        scriptId: 'env-script-id',
        deploymentId: 'env-deployment-id',
        gasUrl: mockGASServer.getExecUrl()
        // No apiToken in config
      };
      await fs.writeFile('.mcp-gas.json', JSON.stringify(gasConfig, null, 2));

      // Set up auth with env token
      mockGASServer.setAuthToken('env-api-token');
      mockGASServer.setMockResponse('test.tool', {
        ok: true,
        result: 'authenticated with env token'
      });

      const { createGASClient } = await import('../../src/gas-client.js');
      
      // Client should pick up token from config + env
      const gasClient = createGASClient({
        gasUrl: mockGASServer.getExecUrl(),
        // No apiToken specified, should use from environment
      });

      const result = await gasClient.callTool('test.tool', {});
      expect(result).toBe('authenticated with env token');
    });
  });

  describe('Configuration file integration', () => {
    it('should save and load MCP configuration correctly', async () => {
      const testConfig: discover.McpConfig = {
        scriptId: 'config-test-script',
        deploymentId: 'config-test-deployment', 
        gasUrl: 'https://script.google.com/macros/s/test/exec',
        apiToken: 'config-test-token'
      };

      // Test save
      await discover.saveMcpConfig(testConfig);

      // Verify file was created
      const savedContent = await fs.readFile('.mcp-gas.json', 'utf-8');
      const savedConfig = JSON.parse(savedContent);

      expect(savedConfig).toEqual(testConfig);

      // Test that the saved config can be loaded by server components
      const { GASClient } = await import('../../src/gas-client.js');
      
      // This simulates how the server would load the config
      const client = new GASClient({
        gasUrl: savedConfig.gasUrl,
        apiToken: savedConfig.apiToken
      });

      expect(client).toBeInstanceOf(GASClient);
    });
  });

  describe('Tool registration and execution flow', () => {
    it('should handle complex tool schemas correctly', async () => {
      const complexToolSource = `
/* @mcp
name: complex.tool
description: A tool with complex schema
path: complex.tool
schema:
  type: object
  properties:
    user:
      type: object
      properties:
        name: { type: string }
        age: { type: number, minimum: 0 }
        emails: 
          type: array
          items: { type: string, format: email }
      required: [name, age]
    options:
      type: object
      properties:
        includeDetails: { type: boolean, default: true }
        format: { type: string, enum: [json, xml, csv] }
      additionalProperties: false
    metadata:
      type: array
      items:
        type: object
        properties:
          key: { type: string }
          value: { type: string }
        required: [key, value]
  required: [user, options]
*/
function complex_tool({ user, options, metadata = [] }) {
  return {
    processedUser: user,
    appliedOptions: options,
    metadataCount: metadata.length,
    timestamp: new Date().toISOString()
  };
}
      `;

      await fs.writeFile('Complex.gs', complexToolSource.trim());

      const tools = await generate();
      expect(tools.has('complex.tool')).toBe(true);

      const complexTool = tools.get('complex.tool');
      expect(complexTool?.schema).toEqual(
        expect.objectContaining({
          type: 'object',
          properties: expect.objectContaining({
            user: expect.objectContaining({
              type: 'object',
              properties: expect.objectContaining({
                name: { type: 'string' },
                age: { type: 'number', minimum: 0 }
              })
            }),
            options: expect.objectContaining({
              type: 'object',
              properties: expect.objectContaining({
                includeDetails: { type: 'boolean', default: true }
              })
            })
          }),
          required: ['user', 'options']
        })
      );

      // Set up mock response for complex data
      const gasConfig = {
        scriptId: 'complex-script',
        deploymentId: 'complex-deployment',
        gasUrl: mockGASServer.getExecUrl(),
        apiToken: 'complex-token'
      };
      await fs.writeFile('.mcp-gas.json', JSON.stringify(gasConfig, null, 2));

      mockGASServer.setAuthToken('complex-token');
      mockGASServer.setMockResponse('complex.tool', {
        ok: true,
        result: {
          processedUser: { name: 'John Doe', age: 30 },
          appliedOptions: { includeDetails: true, format: 'json' },
          metadataCount: 2,
          timestamp: '2024-01-01T00:00:00.000Z'
        }
      });

      const { createGASClient } = await import('../../src/gas-client.js');
      
      const gasClient = createGASClient({
        gasUrl: mockGASServer.getExecUrl(),
        apiToken: 'complex-token'
      });

      const complexInput = {
        user: {
          name: 'John Doe',
          age: 30,
          emails: ['john@example.com']
        },
        options: {
          includeDetails: true,
          format: 'json'
        },
        metadata: [
          { key: 'source', value: 'api' },
          { key: 'version', value: '1.0' }
        ]
      };

      const result = await gasClient.callTool('complex.tool', complexInput);

      expect(result).toEqual({
        processedUser: { name: 'John Doe', age: 30 },
        appliedOptions: { includeDetails: true, format: 'json' },
        metadataCount: 2,
        timestamp: '2024-01-01T00:00:00.000Z'
      });

      // Verify the complex request was processed correctly
      const requests = mockGASServer.getRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].tool).toBe('complex.tool');
      expect(requests[0].args).toEqual(complexInput);
    });
  });
});