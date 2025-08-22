import { Command } from 'commander';
import fs from 'fs/promises';
import { logger } from './logger';
import { generate } from './generate';

const readConfig = () => {
  const config = {
    gasApiToken: process.env.GAS_API_TOKEN,
    strict: process.env.MCP_STRICT === '1',
    mode: process.env.MCP_MODE,
    transport: process.env.MCP_TRANSPORT,
    tcpPort: process.env.MCP_TCP_PORT ? parseInt(process.env.MCP_TCP_PORT, 10) : undefined,
    timeoutMs: process.env.MCP_TIMEOUT_MS ? parseInt(process.env.MCP_TIMEOUT_MS, 10) : undefined,
    retry: process.env.MCP_RETRY ? parseInt(process.env.MCP_RETRY, 10) : undefined,
  };
  logger.info(`Configuration loaded: ${JSON.stringify(config)}`);
  return config;
};

export const run = async (argv: string[]) => {
  try {
    const config = readConfig();
    const program = new Command();

    program
      .name('mcp')
      .description('Model Context Protocol Bridge for Google Apps Script')
      .version('0.0.1');

    program
      .command('build')
      .description('Build mcp.tools.json from GAS project annotations')
      .action(async () => {
        logger.info('Running build command...');
        try {
          const toolsMap = await generate();
          const toolsArray = Array.from(toolsMap.values());
          const jsonContent = JSON.stringify({ tools: toolsArray }, null, 2);

          await fs.writeFile('mcp.tools.json', jsonContent, 'utf-8');

          logger.success(`Successfully generated mcp.tools.json with ${toolsArray.length} tools.`);
        } catch (error) {
          // The top-level try/catch in run() will handle logging and exit
          throw error;
        }
      });

    program
      .command('start')
      .description('Start the MCP server')
      .action(() => {
        logger.info('Starting MCP server...');
        // TODO: Implement server logic from Task 4
      });

    await program.parseAsync(argv);
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error('An unknown error occurred.');
    }
    process.exit(1);
  }
};
