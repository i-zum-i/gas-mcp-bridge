#!/usr/bin/env node

// This is the CLI entry point.
// It imports the compiled TypeScript code from the dist directory.
const { run } = require('../dist/cli');

run(process.argv).catch((error) => {
  console.error(error);
  process.exit(1);
});
