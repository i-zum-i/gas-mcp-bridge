import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { getScriptId, getClaspCredentials, getWebAppDeployment, saveMcpConfig, McpConfig } from '../../src/discover.js';

// Mock the googleapis module
jest.mock('googleapis', () => ({
  google: {
    script: jest.fn(() => ({
      projects: {
        deployments: {
          list: jest.fn()
        }
      }
    })),
    auth: {
      OAuth2: jest.fn()
    }
  }
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

describe('discover', () => {
  let tempDir: string;
  let originalCwd: string;
  
  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'mcp-discover-test-'));
    process.chdir(tempDir);
  });
  
  afterEach(async () => {
    process.chdir(originalCwd);
    await fs.rmdir(tempDir, { recursive: true });
    jest.clearAllMocks();
  });

  describe('getScriptId', () => {
    it('should read script ID from valid .clasp.json', async () => {
      const claspConfig = {
        scriptId: 'test-script-id-123',
        rootDir: './src'
      };
      
      await fs.writeFile('.clasp.json', JSON.stringify(claspConfig, null, 2));
      
      const scriptId = await getScriptId();
      
      expect(scriptId).toBe('test-script-id-123');
    });

    it('should throw error when .clasp.json not found', async () => {
      await expect(getScriptId()).rejects.toThrow(
        "Could not find .clasp.json. Make sure you are in a 'clasp' project directory or run 'clasp create'."
      );
    });

    it('should throw error when scriptId is missing', async () => {
      const claspConfig = {
        rootDir: './src'
      };
      
      await fs.writeFile('.clasp.json', JSON.stringify(claspConfig));
      
      await expect(getScriptId()).rejects.toThrow(
        "'scriptId' not found or is invalid in"
      );
    });

    it('should throw error when scriptId is empty', async () => {
      const claspConfig = {
        scriptId: '',
        rootDir: './src'
      };
      
      await fs.writeFile('.clasp.json', JSON.stringify(claspConfig));
      
      await expect(getScriptId()).rejects.toThrow(
        "'scriptId' not found or is invalid in"
      );
    });

    it('should throw error when .clasp.json has invalid JSON', async () => {
      await fs.writeFile('.clasp.json', '{ invalid json }');
      
      await expect(getScriptId()).rejects.toThrow(
        'Failed to read or parse'
      );
    });
  });

  describe('getClaspCredentials', () => {
    const mockCredentials = {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      scope: 'https://www.googleapis.com/auth/script.projects',
      token_type: 'Bearer',
      expiry_date: Date.now() + 3600000
    };

    it('should read credentials from .clasprc.json in home directory', async () => {
      // Mock os.homedir to return our temp directory
      const originalHomedir = require('os').homedir;
      require('os').homedir = jest.fn(() => tempDir);
      
      const clasprcPath = path.join(tempDir, '.clasprc.json');
      await fs.writeFile(clasprcPath, JSON.stringify(mockCredentials, null, 2));
      
      try {
        const credentials = await getClaspCredentials();
        
        expect(credentials.accessToken).toBe('test-access-token');
        expect(credentials.refreshToken).toBe('test-refresh-token');
      } finally {
        // Restore original homedir
        require('os').homedir = originalHomedir;
      }
    });

    it('should throw error when .clasprc.json not found', async () => {
      const originalHomedir = require('os').homedir;
      require('os').homedir = jest.fn(() => tempDir);
      
      try {
        await expect(getClaspCredentials()).rejects.toThrow(
          'Could not find .clasprc.json'
        );
      } finally {
        require('os').homedir = originalHomedir;
      }
    });

    it('should throw error when access_token is missing', async () => {
      const originalHomedir = require('os').homedir;
      require('os').homedir = jest.fn(() => tempDir);
      
      const invalidCredentials = {
        refresh_token: 'test-refresh-token'
      };
      
      const clasprcPath = path.join(tempDir, '.clasprc.json');
      await fs.writeFile(clasprcPath, JSON.stringify(invalidCredentials));
      
      try {
        await expect(getClaspCredentials()).rejects.toThrow(
          'access_token not found'
        );
      } finally {
        require('os').homedir = originalHomedir;
      }
    });
  });

  describe('getWebAppDeployment', () => {
    const mockGoogleScript = {
      projects: {
        deployments: {
          list: jest.fn()
        }
      }
    };

    beforeEach(() => {
      const { google } = require('googleapis');
      google.script.mockReturnValue(mockGoogleScript);
    });

    it('should find web app deployment', async () => {
      const mockDeployments = {
        data: {
          deployments: [
            {
              deploymentId: 'deployment-123',
              entryPoints: [
                {
                  entryPointType: 'WEB_APP',
                  webApp: {
                    url: 'https://script.google.com/macros/s/test-script-id/exec'
                  }
                }
              ]
            }
          ]
        }
      };

      mockGoogleScript.projects.deployments.list.mockResolvedValue(mockDeployments);

      const deployment = await getWebAppDeployment('test-script-id', 'test-token');

      expect(deployment).toEqual({
        deploymentId: 'deployment-123',
        url: 'https://script.google.com/macros/s/test-script-id/exec'
      });
    });

    it('should return null when no web app deployment found', async () => {
      const mockDeployments = {
        data: {
          deployments: [
            {
              deploymentId: 'deployment-123',
              entryPoints: [
                {
                  entryPointType: 'EXECUTION_API'
                }
              ]
            }
          ]
        }
      };

      mockGoogleScript.projects.deployments.list.mockResolvedValue(mockDeployments);

      const deployment = await getWebAppDeployment('test-script-id', 'test-token');

      expect(deployment).toBeNull();
    });

    it('should return null when no deployments exist', async () => {
      const mockDeployments = {
        data: {
          deployments: []
        }
      };

      mockGoogleScript.projects.deployments.list.mockResolvedValue(mockDeployments);

      const deployment = await getWebAppDeployment('test-script-id', 'test-token');

      expect(deployment).toBeNull();
    });

    it('should handle API errors', async () => {
      mockGoogleScript.projects.deployments.list.mockRejectedValue(
        new Error('API Error')
      );

      await expect(getWebAppDeployment('test-script-id', 'test-token'))
        .rejects.toThrow('API Error');
    });
  });

  describe('saveMcpConfig', () => {
    it('should save MCP configuration to .mcp-gas.json', async () => {
      const config: McpConfig = {
        scriptId: 'test-script-id',
        deploymentId: 'test-deployment-id',
        gasUrl: 'https://script.google.com/macros/s/test/exec',
        apiToken: 'test-token'
      };

      await saveMcpConfig(config);

      const savedContent = await fs.readFile('.mcp-gas.json', 'utf-8');
      const savedConfig = JSON.parse(savedContent);

      expect(savedConfig).toEqual(config);
    });

    it('should handle optional fields correctly', async () => {
      const config: McpConfig = {
        scriptId: 'test-script-id',
        deploymentId: 'test-deployment-id',
        gasUrl: 'https://script.google.com/macros/s/test/exec'
        // apiToken is optional
      };

      await saveMcpConfig(config);

      const savedContent = await fs.readFile('.mcp-gas.json', 'utf-8');
      const savedConfig = JSON.parse(savedContent);

      expect(savedConfig.scriptId).toBe('test-script-id');
      expect(savedConfig.deploymentId).toBe('test-deployment-id');
      expect(savedConfig.gasUrl).toBe('https://script.google.com/macros/s/test/exec');
      expect(savedConfig.apiToken).toBeUndefined();
    });

    it('should format JSON with proper indentation', async () => {
      const config: McpConfig = {
        scriptId: 'test-script-id',
        deploymentId: 'test-deployment-id',
        gasUrl: 'https://script.google.com/macros/s/test/exec'
      };

      await saveMcpConfig(config);

      const savedContent = await fs.readFile('.mcp-gas.json', 'utf-8');
      
      // Check that the JSON is properly formatted (contains newlines and spaces)
      expect(savedContent).toContain('\n');
      expect(savedContent).toContain('  ');
    });
  });
});