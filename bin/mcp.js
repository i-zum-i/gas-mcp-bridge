#!/usr/bin/env node

// This is the CLI entry point.
// It imports the compiled TypeScript code from the dist directory.
import { run } from '../dist/cli.js';

run(process.argv).catch((error) => {
  console.error(error);
  process.exit(1);
});
