# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

**Build & Development:**
- `npm run build` - Compile TypeScript to JavaScript (dist/)
- `npm run lint` - Run ESLint on TypeScript source files
- `npm run format` - Format code with Prettier

**Main CLI Commands:**
- `npx mcp build` - Generate mcp.tools.json from GAS project annotations
- `npx mcp start` - Start the MCP server (currently blocked due to dependency issues)
- `npx mcp discover` - Auto-detect GAS project settings and save to .mcp-gas.json

**Testing:**
- No test runner is currently configured (test script exits with error)

## Architecture Overview

This is a Node.js CLI tool that bridges Google Apps Script (GAS) projects with the Model Context Protocol (MCP). The architecture consists of:

**Core Components:**
- **CLI Interface** (`src/cli.ts`): Commander.js-based CLI with build/start/discover commands
- **Code Generator** (`src/generate.ts`): Parses `/* @mcp ... */` YAML annotations from source files to generate tool definitions
- **Project Discovery** (`src/discover.ts`): Auto-detects GAS project configuration using clasp integration
- **MCP Server** (`src/server.ts`): Currently blocked due to @modelcontextprotocol/sdk dependency issues
- **Logging** (`src/logger.ts`): Centralized logging with picocolors

**Key Dependencies:**
- `@google/clasp` - Google Apps Script CLI integration
- `commander` - CLI framework
- `fast-glob` - File pattern matching for source scanning
- `js-yaml` - YAML parsing for tool annotations
- `googleapis` - Google API access
- `zod` - Runtime type validation

**Tool Definition System:**
The system scans for special YAML comments in source files using regex `/\/\*\*\s*@mcp((?:.|\r|\n)*?)\*\//g`. These annotations define MCP tools with name, description, path, and JSON schema.

**Configuration:**
Environment variables control behavior:
- `GAS_API_TOKEN` - Authentication token for GAS WebApp
- `MCP_STRICT=1` - Fail build if no annotations found
- `MCP_MODE=empty` - Generate empty tools array
- `MCP_TRANSPORT`, `MCP_TCP_PORT`, `MCP_TIMEOUT_MS`, `MCP_RETRY` - Server configuration

**Build Output:**
- TypeScript compiles to `dist/` directory
- CLI generates `mcp.tools.json` with discovered tool definitions
- Discovery command creates `.mcp-gas.json` with project configuration

**Known Issues:**
- MCP server functionality is currently blocked due to dependency installation problems with `@modelcontextprotocol/sdk`
- Test framework is not configured

The codebase follows modern TypeScript practices with ES modules, strict typing, and uses ESLint + Prettier for code quality.