import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { createMockGASServer, MockGASServer } from '../../mocks/mock-gas-server.js';

// Mock the MCP SDK since it requires complex setup
jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    registerTool: jest.fn(),
    connect: jest.fn()
  }))
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn()
}));

// Mock logger
jest.mock('../../src/logger.js', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    success: jest.fn()
  }
}));

describe('server', () => {
  let tempDir: string;
  let originalCwd: string;
  let mockGASServer: MockGASServer;
  
  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'mcp-server-test-'));
    process.chdir(tempDir);
    
    mockGASServer = createMockGASServer();
    await mockGASServer.start();
    
    jest.clearAllMocks();
  });
  
  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rmdir(tempDir, { recursive: true });
    await mockGASServer.stop();
    
    // Clean up environment variables
    delete process.env.GAS_API_TOKEN;
    delete process.env.MCP_TRANSPORT;
  });

  describe('tool loading', () => {
    it('should load tools from mcp.tools.json when file exists', async () => {
      const toolsConfig = {
        tools: [
          {
            name: 'test.tool',
            description: 'A test tool',
            path: 'test.tool',
            schema: {
              type: 'object',
              properties: {
                message: { type: 'string' }
              },
              required: ['message']
            }
          }
        ]
      };
      
      await fs.writeFile('mcp.tools.json', JSON.stringify(toolsConfig, null, 2));
      
      // Import startServer after setting up the test files
      const { startServer } = await import('../../src/server.js');
      
      // Mock the McpServer constructor to capture registered tools
      const mockRegisterTool = jest.fn();
      const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
      (McpServer as jest.MockedClass<any>).mockImplementation(() => ({
        registerTool: mockRegisterTool,
        connect: jest.fn()
      }));

      await expect(startServer()).resolves.toBeUndefined();
      
      // Verify that registerTool was called for the test tool
      expect(mockRegisterTool).toHaveBeenCalledWith(
        'test.tool',
        expect.objectContaining({
          title: 'test.tool',
          description: 'A test tool'
        }),
        expect.any(Function)
      );
    });

    it('should use echo tool when mcp.tools.json does not exist', async () => {
      // Don't create mcp.tools.json file
      
      const { startServer } = await import('../../src/server.js');
      
      const mockRegisterTool = jest.fn();
      const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
      (McpServer as jest.MockedClass<any>).mockImplementation(() => ({
        registerTool: mockRegisterTool,
        connect: jest.fn()
      }));

      await expect(startServer()).resolves.toBeUndefined();
      
      // Verify that registerTool was called for the echo tool
      expect(mockRegisterTool).toHaveBeenCalledWith(
        'echo',
        expect.objectContaining({
          title: 'echo',
          description: expect.stringContaining('echo')
        }),
        expect.any(Function)
      );
    });

    it('should load config from .mcp-gas.json when available', async () => {
      const config = {
        scriptId: 'test-script-id',
        deploymentId: 'test-deployment-id',
        gasUrl: mockGASServer.getExecUrl(),
        apiToken: 'test-api-token'
      };
      
      await fs.writeFile('.mcp-gas.json', JSON.stringify(config, null, 2));
      
      // Create a simple tools file
      const toolsConfig = {
        tools: [
          {
            name: 'test.tool',
            description: 'Test tool',
            path: 'test.tool',
            schema: { type: 'object' }
          }
        ]
      };
      await fs.writeFile('mcp.tools.json', JSON.stringify(toolsConfig, null, 2));
      
      const { startServer } = await import('../../src/server.js');
      
      const mockRegisterTool = jest.fn();
      const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
      (McpServer as jest.MockedClass<any>).mockImplementation(() => ({
        registerTool: mockRegisterTool,
        connect: jest.fn()
      }));

      await expect(startServer()).resolves.toBeUndefined();
      
      // Should register the actual tool (not echo)
      expect(mockRegisterTool).toHaveBeenCalledWith(
        'test.tool',
        expect.objectContaining({
          title: 'test.tool',
          description: 'Test tool'
        }),
        expect.any(Function)
      );
    });
  });

  describe('echo tool behavior', () => {
    it('should return template message for echo tool', async () => {
      // Set up echo tool scenario (no mcp.tools.json)
      
      const { startServer } = await import('../../src/server.js');
      
      let echoToolHandler: Function | undefined;
      const mockRegisterTool = jest.fn().mockImplementation((name, config, handler) => {
        if (name === 'echo') {
          echoToolHandler = handler;
        }
      });
      
      const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
      (McpServer as jest.MockedClass<any>).mockImplementation(() => ({
        registerTool: mockRegisterTool,
        connect: jest.fn()
      }));

      await startServer();
      
      expect(echoToolHandler).toBeDefined();
      
      // Test echo tool response
      const result = await echoToolHandler!({ message: 'test message' });
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const responseText = result.content[0].text;
      const parsedResponse = JSON.parse(responseText);
      
      expect(parsedResponse.testTool).toBe(true);
      expect(parsedResponse.inputReceived.message).toBe('test message');
      expect(parsedResponse.howToAnnotate).toBeDefined();
      expect(parsedResponse.howToAnnotate.template).toContain('/* @mcp');
    });
  });

  describe('GAS tool integration', () => {
    it('should call GAS client for non-echo tools', async () => {
      // Set up GAS config
      const config = {
        scriptId: 'test-script-id',
        deploymentId: 'test-deployment-id',
        gasUrl: mockGASServer.getExecUrl(),
        apiToken: 'test-api-token'
      };
      await fs.writeFile('.mcp-gas.json', JSON.stringify(config, null, 2));
      
      // Set up tools config
      const toolsConfig = {
        tools: [
          {
            name: 'gas.tool',
            description: 'GAS tool',
            path: 'gas.tool',
            schema: { type: 'object' }
          }
        ]
      };
      await fs.writeFile('mcp.tools.json', JSON.stringify(toolsConfig, null, 2));
      
      // Set up mock GAS response
      mockGASServer.setMockResponse('gas.tool', {
        ok: true,
        result: { success: true, data: 'GAS response' }
      });
      
      const { startServer } = await import('../../src/server.js');
      
      let gasToolHandler: Function | undefined;
      const mockRegisterTool = jest.fn().mockImplementation((name, config, handler) => {
        if (name === 'gas.tool') {
          gasToolHandler = handler;
        }
      });
      
      const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
      (McpServer as jest.MockedClass<any>).mockImplementation(() => ({
        registerTool: mockRegisterTool,
        connect: jest.fn()
      }));

      await startServer();
      
      expect(gasToolHandler).toBeDefined();
      
      // Test GAS tool call
      const result = await gasToolHandler!({ param: 'value' });
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const responseText = result.content[0].text;
      const parsedResponse = JSON.parse(responseText);
      
      expect(parsedResponse.success).toBe(true);
      expect(parsedResponse.data).toBe('GAS response');
      
      // Verify the GAS server received the request
      const requests = mockGASServer.getRequests();
      expect(requests).toHaveLength(1);
      expect(requests[0].tool).toBe('gas.tool');
      expect(requests[0].args).toEqual({ param: 'value' });
    });

    it('should handle GAS client errors', async () => {
      // Set up GAS config
      const config = {
        scriptId: 'test-script-id',
        deploymentId: 'test-deployment-id',
        gasUrl: mockGASServer.getExecUrl(),
        apiToken: 'test-api-token'
      };
      await fs.writeFile('.mcp-gas.json', JSON.stringify(config, null, 2));
      
      // Set up tools config
      const toolsConfig = {
        tools: [
          {
            name: 'error.tool',
            description: 'Tool that errors',
            path: 'error.tool',
            schema: { type: 'object' }
          }
        ]
      };
      await fs.writeFile('mcp.tools.json', JSON.stringify(toolsConfig, null, 2));
      
      // Set up mock GAS error response
      mockGASServer.setMockResponse('error.tool', {
        ok: false,
        message: 'GAS execution failed'
      });
      
      const { startServer } = await import('../../src/server.js');
      
      let errorToolHandler: Function | undefined;
      const mockRegisterTool = jest.fn().mockImplementation((name, config, handler) => {
        if (name === 'error.tool') {
          errorToolHandler = handler;
        }
      });
      
      const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
      (McpServer as jest.MockedClass<any>).mockImplementation(() => ({
        registerTool: mockRegisterTool,
        connect: jest.fn()
      }));

      await startServer();
      
      expect(errorToolHandler).toBeDefined();
      
      // Test error handling
      await expect(errorToolHandler!({})).rejects.toThrow(
        'GAS execution failed'
      );
    });

    it('should handle missing GAS config error', async () => {
      // Don't create .mcp-gas.json file
      
      // Set up tools config with non-echo tool
      const toolsConfig = {
        tools: [
          {
            name: 'no.config.tool',
            description: 'Tool without config',
            path: 'no.config.tool',
            schema: { type: 'object' }
          }
        ]
      };
      await fs.writeFile('mcp.tools.json', JSON.stringify(toolsConfig, null, 2));
      
      const { startServer } = await import('../../src/server.js');
      
      let noConfigToolHandler: Function | undefined;
      const mockRegisterTool = jest.fn().mockImplementation((name, config, handler) => {
        if (name === 'no.config.tool') {
          noConfigToolHandler = handler;
        }
      });
      
      const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
      (McpServer as jest.MockedClass<any>).mockImplementation(() => ({
        registerTool: mockRegisterTool,
        connect: jest.fn()
      }));

      await startServer();
      
      expect(noConfigToolHandler).toBeDefined();
      
      // Test missing config error
      await expect(noConfigToolHandler!({})).rejects.toThrow(
        'GAS configuration not found. Please run "mcp build" first.'
      );
    });
  });

  describe('environment variable handling', () => {
    it('should use GAS_API_TOKEN environment variable', async () => {
      process.env.GAS_API_TOKEN = 'env-token';
      
      // Set up minimal config without apiToken
      const config = {
        scriptId: 'test-script-id',
        deploymentId: 'test-deployment-id',
        gasUrl: mockGASServer.getExecUrl()
        // No apiToken field
      };
      await fs.writeFile('.mcp-gas.json', JSON.stringify(config, null, 2));
      
      const toolsConfig = {
        tools: [
          {
            name: 'env.tool',
            description: 'Tool using env token',
            path: 'env.tool',
            schema: { type: 'object' }
          }
        ]
      };
      await fs.writeFile('mcp.tools.json', JSON.stringify(toolsConfig, null, 2));
      
      // Set up auth on mock server
      mockGASServer.setAuthToken('env-token');
      mockGASServer.setMockResponse('env.tool', {
        ok: true,
        result: 'authenticated with env token'
      });
      
      const { startServer } = await import('../../src/server.js');
      
      let envToolHandler: Function | undefined;
      const mockRegisterTool = jest.fn().mockImplementation((name, config, handler) => {
        if (name === 'env.tool') {
          envToolHandler = handler;
        }
      });
      
      const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
      (McpServer as jest.MockedClass<any>).mockImplementation(() => ({
        registerTool: mockRegisterTool,
        connect: jest.fn()
      }));

      await startServer();
      
      expect(envToolHandler).toBeDefined();
      
      const result = await envToolHandler!({});
      const responseText = result.content[0].text;
      const parsedResponse = JSON.parse(responseText);
      
      expect(parsedResponse).toBe('authenticated with env token');
    });
  });
});