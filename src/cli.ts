import { Command } from 'commander';
import fs from 'fs/promises';
import { logger } from './logger.js';
import { generate } from './generate.js';
import * as discover from './discover.js';
import { startServer } from './server.js';

const readConfig = () => {
  const config = {
    strict: process.env.MCP_STRICT === '1',
  };
  logger.info(`Configuration loaded: ${JSON.stringify(config)}`);
  return config;
};

export const run = async (argv: string[]) => {
  try {
    readConfig();
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
          process.exit(0);
        } catch (error) {
          logger.error(`Build command failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
      });

    program
      .command('start')
      .description('Start the MCP server')
      .action(async () => {
        await startServer();
      });

    program
      .command('discover')
      .description('Discover GAS project settings and save to .mcp-gas.json')
      .action(async () => {
        logger.info('Discovering GAS project settings...');
        try {
          const scriptId = await discover.getScriptId();
          const { accessToken } = await discover.getClaspCredentials();
          let deployment = await discover.getWebAppDeployment(scriptId, accessToken);
          if (!deployment) {
            logger.warn('No active web app deployment found. Attempting to create one...');
            await discover.runClaspDeploy();
            deployment = await discover.getWebAppDeployment(scriptId, accessToken);
          }
          if (!deployment) {
            throw new Error('Failed to find or create a web app deployment.');
          }
          const config: discover.McpConfig = {
            scriptId,
            deploymentId: deployment.deploymentId,
            gasUrl: deployment.url,
            apiToken: accessToken,
          };
          await discover.saveMcpConfig(config);
          logger.success('Successfully discovered and saved GAS project settings.');
          process.exit(0);
        } catch (error) {
          logger.error(`Discover command failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
          process.exit(1);
        }
      });

    await program.parseAsync(argv);

  if (error instanceof Error) {
      logger.error(error.message);
    } else {
      logger.error('An unknown error occurred.');
    }
    process.exit(1);
  }
};
};
