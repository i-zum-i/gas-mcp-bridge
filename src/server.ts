// @ts-expect-error - MCP SDK type definitions are not properly exported
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// @ts-expect-error - MCP SDK type definitions are not properly exported
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import fs from 'fs/promises';
import { z } from 'zod';
import { logger } from './logger.js';

interface ToolDefinition {
  name: string;
  description: string;
  path: string;
  schema: object;
}

interface McpConfig {
  gasUrl: string;
  scriptId: string;
  deploymentId?: string;
  apiToken?: string;
}

async function callGAS(gasUrl: string, tool: string, args: unknown, token?: string): Promise<unknown> {
  const response = await fetch(gasUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    },
    body: JSON.stringify({
      tool,
      args
    })
  });

  if (!response.ok) {
    throw new Error(`GAS request failed: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();
  if (!result.ok) {
    throw new Error(result.message || 'GAS execution failed');
  }

  return result.result;
}

async function loadTools(): Promise<ToolDefinition[]> {
  try {
    const toolsContent = await fs.readFile('mcp.tools.json', 'utf-8');
    const toolsData = JSON.parse(toolsContent);
    return toolsData.tools || [];
  } catch {
    logger.warn('mcp.tools.json not found. Using default echo tool.');
    return [
      {
        name: 'echo',
        description: 'A simple tool that echoes back the input. Used as a default when no other tools are defined.',
        path: 'echo',
        schema: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The message to echo back.'
            }
          },
          required: ['message']
        }
      }
    ];
  }
}

async function loadConfig(): Promise<McpConfig | null> {
  try {
    const configContent = await fs.readFile('.mcp-gas.json', 'utf-8');
    return JSON.parse(configContent);
  } catch {
    logger.warn('.mcp-gas.json not found. Echo tool will work, but GAS tools will fail.');
    return null;
  }
}

export const startServer = async () => {
  const server = new McpServer(
    {
      name: 'gas-mcp-bridge',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  const tools = await loadTools();
  const config = await loadConfig();
  const gasApiToken = process.env.GAS_API_TOKEN || config?.apiToken;

  // Register tools dynamically
  for (const tool of tools) {
    if (tool.name === 'echo' && tool.path === 'echo') {
      // Register echo tool
      server.registerTool(tool.name, {
        title: tool.name,
        description: tool.description,
        inputSchema: {
          message: z.string().describe('The message to echo back.')
        }
      }, async ({ message }: { message: string }) => {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                testTool: true,
                note: 'これはテスト用ツールです。/* @mcp ... */ 注釈を追加してから `npx mcp build` を実行してください。',
                inputReceived: { message },
                howToAnnotate: {
                  template: [
                    '/* @mcp',
                    'name: <tool.name>',
                    'description: <説明（任意）>',
                    'path: <ルーティングキー（省略可）>',
                    'schema:',
                    '  type: object',
                    '  properties:',
                    '    <paramA>: { type: string }',
                    '  required: [<paramA>]',
                    '*/'
                  ].join('\n'),
                  example: '/* @mcp\nname: sheet.appendRow\ndescription: Append one row to a sheet\n...'
                }
              }, null, 2)
            }
          ]
        };
      });
    } else {
      // Register GAS tool with dynamic schema
      server.registerTool(tool.name, {
        title: tool.name,
        description: tool.description,
        inputSchema: z.any().describe('Tool input parameters')
      }, async (args: unknown) => {
        if (!config) {
          throw new Error('GAS configuration not found. Please run "mcp build" first.');
        }

        try {
          const result = await callGAS(config.gasUrl, tool.path, args, gasApiToken);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error(`Tool ${tool.name} failed: ${errorMessage}`);
          throw new Error(`Tool execution failed: ${errorMessage}`);
        }
      });
    }
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.success('MCP Server started successfully');
};
