import fg from 'fast-glob';
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';
import Ajv from 'ajv';
import { logger } from './logger';

const MCP_ANNOTATION_REGEX = /\/\*\*\s*@mcp((?:.|\r|\n)*?)\*\//g;
const ajv = new Ajv();

// Represents the raw, parsed tool definition from a file annotation.
interface RawToolDefinition {
  name?: unknown;
  description?: unknown;
  path?: unknown;
  schema?: unknown;
  filePath: string; // Injected during findTools
}

// Represents a validated and processed tool definition.
export interface ToolDefinition {
  name: string;
  description: string;
  path: string;
  schema: object;
}

/**
 * Processes raw tool definitions, validating them and handling duplicates.
 * @param rawTools An array of raw tool definitions.
 * @returns A map of valid tool definitions, keyed by tool name.
 */
export const processTools = (rawTools: RawToolDefinition[]): Map<string, ToolDefinition> => {
  const processedTools = new Map<string, ToolDefinition>();

  for (const tool of rawTools) {
    // 1. Validate name
    if (typeof tool.name !== 'string' || !tool.name) {
      logger.warn(`Skipping tool in ${tool.filePath} due to missing or invalid name.`);
      continue;
    }

    // 2. Validate schema
    if (typeof tool.schema !== 'object' || tool.schema === null) {
      logger.warn(`Skipping tool "${tool.name}" in ${tool.filePath} due to missing or invalid schema.`);
      continue;
    }
    const isSchemaValid = ajv.validateSchema(tool.schema);
    if (!isSchemaValid) {
      logger.warn(`Invalid JSON Schema for tool "${tool.name}" in ${tool.filePath}.`);
      logger.warn(ajv.errorsText(ajv.errors));
      // Continue processing, as this is an optional check
    }

    // 3. Default path (if not provided)
    const toolPath = typeof tool.path === 'string' && tool.path ? tool.path : tool.filePath;

    const finalTool: ToolDefinition = {
      name: tool.name,
      description: typeof tool.description === 'string' ? tool.description : '',
      path: toolPath,
      schema: tool.schema,
    };

    // "Last one wins" for duplicates is handled by Map's set method.
    processedTools.set(finalTool.name, finalTool);
  }

  logger.info(`Processed ${processedTools.size} valid tool definitions.`);
  return processedTools;
}

const createEchoTool = (): Map<string, ToolDefinition> => {
  const echoTool: ToolDefinition = {
    name: 'echo',
    description: 'A simple tool that echoes back the input. Used as a default when no other tools are defined.',
    path: 'echo', // Special path to be handled by the server
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The message to echo back.',
        },
      },
      required: ['message'],
    },
  };
  return new Map([[echoTool.name, echoTool]]);
};

/**
 * Main orchestration function to generate tool definitions.
 * It finds, processes, and handles special modes for tool generation.
 */
export const generate = async (): Promise<Map<string, ToolDefinition>> => {
  const rawTools = await findTools();
  let processedTools = processTools(rawTools);

  if (processedTools.size === 0) {
    logger.warn('No valid tool definitions found in project.');
    const strictMode = process.env.MCP_STRICT === '1';
    const emptyMode = process.env.MCP_MODE === 'empty';

    if (strictMode) {
      throw new Error('MCP_STRICT mode is enabled and no tool definitions were found.');
    }
    if (emptyMode) {
      logger.info('MCP_MODE=empty, generating empty tools file.');
      return new Map();
    }

    logger.info('No tools found, creating default "echo" tool.');
    processedTools = createEchoTool();
  }

  return processedTools;
}

/**
 * Finds and parses all MCP tool definitions from annotations in the project.
 * @param searchPath The path to search for source files. Defaults to current dir.
 */
export const findTools = async (searchPath = '.'): Promise<RawToolDefinition[]> => {
  const sourceFiles = await fg('**/*.{js,ts,gs}', {
    cwd: searchPath,
    ignore: ['node_modules/**', 'dist/**', 'build/**'],
    absolute: true,
  });

  logger.info(`Found ${sourceFiles.length} source files to scan...`);

  const allTools: RawToolDefinition[] = [];

  for (const file of sourceFiles) {
    try {
      const content = await fs.readFile(file, 'utf-8');
      const matches = content.matchAll(MCP_ANNOTATION_REGEX);

      for (const match of matches) {
        const rawYamlContent = match[1];
        if (rawYamlContent) {
          // Clean the YAML content by removing the leading '*' from each line
          const cleanedYaml = rawYamlContent
            .split('\n')
            .map(line => line.trim().replace(/^\* ?/, ''))
            .join('\n');

          const toolDef = yaml.load(cleanedYaml) as RawToolDefinition;
          // Add filePath to the definition for later use (e.g., default path)
          const toolWithPath = { ...toolDef, filePath: file };
          allTools.push(toolWithPath);
        }
      }
    } catch (error) {
      logger.warn(`Could not read or parse file ${path.basename(file)}: ${error}`);
    }
  }

  logger.info(`Found ${allTools.length} raw tool definitions.`);
  return allTools;
};
