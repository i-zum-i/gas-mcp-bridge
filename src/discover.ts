import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { google } from 'googleapis';
import { execa } from 'execa';
import { logger } from './logger.js';

const CLASP_CONFIG_FILE = '.clasp.json';
const CLASP_RC_FILE = '.clasprc.json';

/**
 * Reads the script ID from the .clasp.json file in the specified directory.
 * @param projectRoot The root directory of the clasp project. Defaults to cwd.
 * @returns The script ID.
 * @throws An error if the file is not found or is malformed.
 */
export const getScriptId = async (projectRoot = '.'): Promise<string> => {
  const configPath = path.join(projectRoot, CLASP_CONFIG_FILE);
  logger.info(`Reading script ID from ${configPath}...`);

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);

    if (typeof config.scriptId === 'string' && config.scriptId) {
      logger.success(`Found script ID: ${config.scriptId}`);
      return config.scriptId;
    } else {
      throw new Error(`'scriptId' not found or is invalid in ${configPath}`);
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(
        `Could not find ${CLASP_CONFIG_FILE}. Make sure you are in a 'clasp' project directory or run 'clasp create'.`
      );
    }
    throw new Error(`Failed to read or parse ${configPath}: ${error.message}`);
  }
};

export interface WebAppDeployment {
  deploymentId: string;
  url: string;
}

/**
 * Finds the latest web app deployment for a given script ID.
 * @param scriptId The script ID.
 * @param accessToken The OAuth access token.
 * @returns The deployment ID and URL, or null if not found.
 */
export const getWebAppDeployment = async (
  scriptId: string,
  accessToken: string
): Promise<WebAppDeployment | null> => {
  logger.info(`Fetching deployments for script ID: ${scriptId}...`);

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const script = google.script({ version: 'v1', auth: oauth2Client });

  try {
    const { data } = await script.projects.deployments.list({ scriptId });

    if (!data.deployments || data.deployments.length === 0) {
      logger.warn('No deployments found for this script.');
      return null;
    }

    // Find the latest active web app deployment
    const webAppDeployments = data.deployments
      .filter(d => d.entryPoints?.some(e => e.entryPointType === 'WEB_APP'))
      .sort((a, b) => (b.updateTime?.localeCompare(a.updateTime ?? '') ?? 0));

    if (webAppDeployments.length === 0) {
      logger.warn('No web app deployments found.');
      return null;
    }

    const latestDeployment = webAppDeployments[0];
    const webAppEntryPoint = latestDeployment.entryPoints?.find(e => e.entryPointType === 'WEB_APP');
    const deploymentId = latestDeployment.deploymentId;

    if (!webAppEntryPoint?.webApp?.url || !deploymentId) {
      logger.warn('Latest web app deployment is missing URL or deployment ID.');
      return null;
    }

    logger.success(`Found latest web app deployment: ${deploymentId}`);
    return {
      deploymentId,
      url: webAppEntryPoint.webApp.url,
    };
  } catch (error: any) {
    logger.error(`Failed to fetch deployments: ${error.message}`);
    // Potentially check for 401/403 and suggest re-logging in
    if (error.code === 401 || error.code === 403) {
      logger.warn("Authentication failed. Your credentials may have expired. Please try 'clasp login' again.");
    }
    return null;
  }
};

/**
 * Runs 'npx clasp deploy' to create a new deployment.
 */
export const runClaspDeploy = async (): Promise<void> => {
  logger.info("Attempting to create a new deployment by running 'npx clasp deploy'...");

  try {
    const claspProcess = execa('npx', ['clasp', 'deploy']);
    // Pipe the output to our logger in real-time
    claspProcess.stdout?.pipe(process.stdout);
    claspProcess.stderr?.pipe(process.stderr);

    await claspProcess;
    logger.success("'clasp deploy' completed successfully.");
  } catch (error: any) {
    logger.error("Failed to run 'clasp deploy'.");
    logger.error(error.message);
    throw new Error(
      "Automatic deployment failed. Please try running 'npx clasp deploy' manually and resolve any issues."
    );
  }
};

export interface McpConfig {
  scriptId: string;
  deploymentId: string;
  gasUrl: string;
  apiToken: string;
}

/**
 * Saves the discovered configuration to .mcp-gas.json.
 * @param config The configuration to save.
 */
export const saveMcpConfig = async (config: McpConfig): Promise<void> => {
  const configPath = '.mcp-gas.json';
  logger.info(`Saving configuration to ${configPath}...`);
  try {
    const jsonContent = JSON.stringify(config, null, 2);
    await fs.writeFile(configPath, jsonContent, 'utf-8');
    logger.success(`Configuration saved successfully to ${configPath}.`);
  } catch (error: any) {
    throw new Error(`Failed to save configuration to ${configPath}: ${error.message}`);
  }
};

/**
 * Reads the clasp credentials from the ~/.clasprc.json file.
 * @returns The access token.
 * @throws An error if the file is not found or is malformed.
 */
export const getClaspCredentials = async (): Promise<{ accessToken: string }> => {
  const configPath = path.join(os.homedir(), CLASP_RC_FILE);
  logger.info(`Reading credentials from ${configPath}...`);

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);

    const accessToken = config?.token?.access_token;
    if (typeof accessToken === 'string' && accessToken) {
      logger.success('Successfully read access token.');
      return { accessToken };
    } else {
      throw new Error(`'token.access_token' not found or is invalid in ${configPath}`);
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(
        `Could not find ${CLASP_RC_FILE} in your home directory. Please run 'clasp login'.`
      );
    }
    throw new Error(`Failed to read or parse ${configPath}: ${error.message}`);
  }
};
