import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { generate, findTools, processTools } from '../../src/generate.js';

describe('generate', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    // Create temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(tmpdir(), 'mcp-test-'));
    process.chdir(tempDir);
  });
  
  afterEach(async () => {
    // Clean up temp directory
    await fs.rmdir(tempDir, { recursive: true });
  });

  describe('findTools', () => {
    it('should find tools with valid @mcp annotations', async () => {
      const testFile = `
/* @mcp
name: test.tool
description: A test tool
schema:
  type: object
  properties:
    message: { type: string }
  required: [message]
*/
function testTool(args) {
  return args;
}
      `;
      
      await fs.writeFile('test.js', testFile.trim());
      
      const tools = await findTools(tempDir);
      
      expect(tools).toHaveLength(1);
      expect(tools[0]).toMatchObject({
        name: 'test.tool',
        description: 'A test tool',
        schema: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          },
          required: ['message']
        }
      });
    });

    it('should handle multiple tools in one file', async () => {
      const testFile = `
/* @mcp
name: tool1
description: First tool
schema:
  type: object
  properties:
    param1: { type: string }
*/
function tool1(args) {}

/* @mcp
name: tool2
description: Second tool  
schema:
  type: object
  properties:
    param2: { type: number }
*/
function tool2(args) {}
      `;
      
      await fs.writeFile('multi-tools.ts', testFile.trim());
      
      const tools = await findTools(tempDir);
      
      expect(tools).toHaveLength(2);
      expect(tools.map(t => t.name)).toContain('tool1');
      expect(tools.map(t => t.name)).toContain('tool2');
    });

    it('should ignore files with invalid YAML', async () => {
      const testFile = `
/* @mcp
name: invalid
invalid: yaml: content
*/
function invalidTool(args) {}
      `;
      
      await fs.writeFile('invalid.js', testFile.trim());
      
      const tools = await findTools(tempDir);
      
      expect(tools).toHaveLength(0);
    });

    it('should handle files without annotations', async () => {
      const testFile = `
function normalFunction() {
  return 'no annotations';
}
      `;
      
      await fs.writeFile('normal.js', testFile.trim());
      
      const tools = await findTools(tempDir);
      
      expect(tools).toHaveLength(0);
    });
  });

  describe('processTools', () => {
    it('should validate and process valid tool definitions', () => {
      const rawTools = [
        {
          name: 'valid.tool',
          description: 'A valid tool',
          path: 'valid.path',
          schema: { type: 'object' },
          filePath: '/test/file.js'
        }
      ];
      
      const processed = processTools(rawTools);
      
      expect(processed.size).toBe(1);
      expect(processed.get('valid.tool')).toMatchObject({
        name: 'valid.tool',
        description: 'A valid tool',
        path: 'valid.path',
        schema: { type: 'object' }
      });
    });

    it('should skip tools with missing name', () => {
      const rawTools = [
        {
          description: 'Tool without name',
          schema: { type: 'object' },
          filePath: '/test/file.js'
        }
      ];
      
      const processed = processTools(rawTools);
      
      expect(processed.size).toBe(0);
    });

    it('should skip tools with invalid schema', () => {
      const rawTools = [
        {
          name: 'invalid.schema',
          description: 'Tool with invalid schema',
          schema: null,
          filePath: '/test/file.js'
        }
      ];
      
      const processed = processTools(rawTools);
      
      expect(processed.size).toBe(0);
    });

    it('should use filename as default path when path is missing', () => {
      const rawTools = [
        {
          name: 'no.path',
          description: 'Tool without explicit path',
          schema: { type: 'object' },
          filePath: '/test/file.js'
        }
      ];
      
      const processed = processTools(rawTools);
      
      expect(processed.get('no.path')?.path).toBe('/test/file.js');
    });

    it('should handle duplicate tool names (last one wins)', () => {
      const rawTools = [
        {
          name: 'duplicate',
          description: 'First tool',
          schema: { type: 'object' },
          filePath: '/test/file1.js'
        },
        {
          name: 'duplicate',
          description: 'Second tool',
          schema: { type: 'string' },
          filePath: '/test/file2.js'
        }
      ];
      
      const processed = processTools(rawTools);
      
      expect(processed.size).toBe(1);
      expect(processed.get('duplicate')?.description).toBe('Second tool');
      expect(processed.get('duplicate')?.schema).toEqual({ type: 'string' });
    });
  });

  describe('generate modes', () => {
    beforeEach(async () => {
      // Ensure no tools are found by default
      await fs.writeFile('empty.js', '// No annotations');
    });

    it('should generate echo tool in default mode', async () => {
      delete process.env.MCP_STRICT;
      delete process.env.MCP_MODE;
      
      const tools = await generate();
      
      expect(tools.size).toBe(1);
      expect(tools.has('echo')).toBe(true);
      
      const echoTool = tools.get('echo');
      expect(echoTool?.name).toBe('echo');
      expect(echoTool?.path).toBe('echo');
    });

    it('should throw error in strict mode when no tools found', async () => {
      process.env.MCP_STRICT = '1';
      
      await expect(generate()).rejects.toThrow(
        'MCP_STRICT mode is enabled and no tool definitions were found.'
      );
      
      delete process.env.MCP_STRICT;
    });

    it('should return empty tools in empty mode', async () => {
      process.env.MCP_MODE = 'empty';
      
      const tools = await generate();
      
      expect(tools.size).toBe(0);
      
      delete process.env.MCP_MODE;
    });

    it('should return actual tools when annotations are found', async () => {
      const testFile = `
/* @mcp
name: real.tool
description: A real tool
schema:
  type: object
  properties:
    param: { type: string }
*/
function realTool(args) {}
      `;
      
      await fs.writeFile('real-tool.js', testFile.trim());
      
      const tools = await generate();
      
      expect(tools.size).toBe(1);
      expect(tools.has('real.tool')).toBe(true);
      expect(tools.has('echo')).toBe(false);
    });
  });
});