#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';
import { generate } from './generate.js';
// Dynamic import for discover module to avoid heavy dependencies at startup
import { startServer } from './server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json version
const getPackageVersion = async (): Promise<string> => {
  try {
    const packagePath = path.resolve(__dirname, '..', 'package.json');
    const packageContent = await fs.readFile(packagePath, 'utf-8');
    const packageJson = JSON.parse(packageContent);
    return packageJson.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
};

const readConfig = () => {
  const config = {
    strict: process.env.MCP_STRICT === '1',
  };
  logger.info(`Configuration loaded: ${JSON.stringify(config)}`);
  return config;
};

export const run = async (argv: string[]) => {
  // 先に設定ログ
  readConfig();

  const packageVersion = await getPackageVersion();
  const program = new Command();

  program
    .name('mcp')
    .description('Model Context Protocol Bridge for Google Apps Script')
    .version(packageVersion);

  // ---- build ----
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
        process.exitCode = 0;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`Build command failed: ${msg}`);
        process.exitCode = 1;
      }
    });

  // ---- start ----
  program
    .command('start')
    .description('Start the MCP server')
    .option('--config <path>', 'Path to .mcp-gas.json (default: ./.mcp-gas.json)')
    .action(async (opts: { config?: string }) => {
      try {
        logger.info(`Starting gas-mcp-bridge v${packageVersion}`);
        
        // server 側が内部で .mcp-gas.json を読む想定なら特に何もしない
        // もしパスの上書きが必要なら、ここで環境変数に渡すなど調整
        if (opts.config) {
          process.env.MCP_GAS_CONFIG_PATH = opts.config;
          logger.info(`Using MCP GAS config: ${opts.config}`);
        }
        await startServer();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`Start command failed: ${msg}`);
        process.exitCode = 1;
      }
    });

  // ---- discover ----
  program
    .command('discover')
    .description('Discover GAS project settings and save to .mcp-gas.json')
    .option('--file <path>', 'Output file path for .mcp-gas.json (default: ./.mcp-gas.json)')
    .option('--token-key <key>', 'Script Properties token key (default: MCP_API_TOKEN)')
    .option('--include-dev-token', 'Embed current OAuth access token for development (do NOT commit)', false)
    .action(async (opts: { file?: string; tokenKey?: string; includeDevToken?: boolean }) => {
      logger.info('Discovering GAS project settings...');
      try {
        // Dynamically import discover module to avoid heavy dependencies at startup
        const discover = await import('./discover.js');
        
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

        // include-dev-token の指定を compose 関数の仕様に合わせて env で渡す
        if (opts.includeDevToken) {
          process.env.MCP_INCLUDE_OAUTH_TOKEN = '1';
        }

        await discover.composeAndSaveMcpConfig({
          scriptId,
          deployment,
          accessToken,
          filePath: opts.file,                 // 省略時は discover 側がデフォルト .mcp-gas.json を使用
          tokenPropertyKey: opts.tokenKey,     // 省略時は 'MCP_API_TOKEN'
        });

        logger.success('Successfully discovered and saved GAS project settings.');
        process.exitCode = 0;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`Discover command failed: ${msg}`);
        process.exitCode = 1;
      } finally {
        // フラグを戻す（副作用低減）
        if (opts.includeDevToken) {
          delete process.env.MCP_INCLUDE_OAUTH_TOKEN;
        }
      }
    });

  // ---- parse ----
  try {
    await program.parseAsync(argv);
  } catch (err) {
    if (err instanceof Error) {
      logger.error(err.stack ?? err.message);
    } else {
      logger.error(String(err));
    }
    process.exit(1); // ここは致命的
  }
};

// CLI実行（モジュールが直接実行される場合）
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('cli.js')) {
  run(process.argv).catch((err) => {
    console.error('CLI execution failed:', err);
    process.exit(1);
  });
}
