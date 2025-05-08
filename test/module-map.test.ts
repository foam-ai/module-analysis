// Tests for the TypeScript Module Map Generator implementation

import * as path from 'path';
import * as fs from 'fs';
import {
  getTypescriptFiles,
  getFileContent,
  extractDescription,
  extractCalledModules,
  resolveImportPath,
  sortObjectKeys
} from '../src/utils';
import { createModuleMap } from '../src/module-map';
import { ModuleMap, Conversation } from '../src/types';
import * as openaiTools from '../src/openai-tools';

// Mock the fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
}));

// Mock the OpenAI tools
jest.mock('../src/openai-tools', () => ({
  createConversation: jest.fn(),
  addUserMessage: jest.fn(),
  callOpenAI: jest.fn(),
  createTool: jest.fn(),
}));

describe('Utility Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTypescriptFiles', () => {
    it('should return TypeScript files from a directory', () => {
      // Mock the fs.readdirSync function
      const mockEntries = [
        { name: 'file1.ts', isDirectory: () => false, isFile: () => true },
        { name: 'file2.tsx', isDirectory: () => false, isFile: () => true },
        { name: 'file3.d.ts', isDirectory: () => false, isFile: () => true }, // Should be excluded
        { name: 'file4.js', isDirectory: () => false, isFile: () => true }, // Should be excluded
        { name: 'subdir', isDirectory: () => true, isFile: () => false },
        { name: 'node_modules', isDirectory: () => true, isFile: () => false }, // Should be excluded
        { name: '.git', isDirectory: () => true, isFile: () => false }, // Should be excluded
      ];

      const mockSubdirEntries = [
        { name: 'subfile1.ts', isDirectory: () => false, isFile: () => true },
        { name: 'subfile2.tsx', isDirectory: () => false, isFile: () => true },
      ];

      (fs.readdirSync as jest.Mock).mockImplementation((dir, options) => {
        if (dir === '/test/dir') {
          return mockEntries;
        } else if (dir === '/test/dir/subdir') {
          return mockSubdirEntries;
        }
        return [];
      });

      // Mock path.join and path.relative
      jest.spyOn(path, 'join').mockImplementation((dir, name) => {
        return `${dir}/${name}`;
      });

      jest.spyOn(path, 'relative').mockImplementation((from, to) => {
        return to.replace(`${from}/`, '');
      });

      const result = getTypescriptFiles('/test/dir');

      expect(result).toEqual([
        'file1.ts',
        'file2.tsx',
        'subdir/subfile1.ts',
        'subdir/subfile2.tsx',
      ]);
    });
  });

  describe('getFileContent', () => {
    it('should return the content of a file', () => {
      const mockContent = 'file content';
      (fs.readFileSync as jest.Mock).mockReturnValue(mockContent);

      const result = getFileContent('/test/dir', 'file.ts');

      expect(fs.readFileSync).toHaveBeenCalledWith('/test/dir/file.ts', 'utf-8');
      expect(result).toBe(mockContent);
    });
  });

  describe('extractDescription', () => {
    it('should extract description from a response with a description section', () => {
      const response = 'Some text\nDescription: This is a description\nMore text';
      const result = extractDescription(response);
      expect(result).toBe('This is a description');
    });

    it('should extract the first paragraph if no description section is found', () => {
      const response = 'This is the first paragraph.\n\nThis is the second paragraph.';
      const result = extractDescription(response);
      expect(result).toBe('This is the first paragraph.');
    });

    it('should extract the first line if no paragraphs are found', () => {
      const response = 'This is a single line.';
      const result = extractDescription(response);
      expect(result).toBe('This is a single line.');
    });

    it('should handle empty responses', () => {
      const response = '';
      const result = extractDescription(response);
      expect(result).toBe('');
    });

    it('should clean up markdown formatting', () => {
      const response = '# Module Description\n\nThis module handles authentication.';
      const result = extractDescription(response);
      expect(result).toBe('Module Description');
    });
  });

  describe('extractCalledModules', () => {
    it('should extract called modules from import lines', () => {
      const importLines = `
        import { Component } from './component';
        import * as utils from '../utils';
        import defaultExport from './default';
      `;

      // Mock resolveImportPath to return the input path with .ts extension
      jest.spyOn(require('../src/utils'), 'resolveImportPath').mockImplementation((importPath) => {
        return `${importPath}.ts`;
      });

      const result = extractCalledModules(importLines, '/test/dir', 'src/file.ts');

      expect(result).toEqual([
        './component.ts',
        '../utils.ts',
        './default.ts',
      ]);
    });

    it('should skip node_modules and absolute imports', () => {
      const importLines = `
        import { Component } from './component';
        import React from 'react';
        import path from 'path';
        import config from '/absolute/path';
      `;

      // Mock resolveImportPath to return the input path with .ts extension
      jest.spyOn(require('../src/utils'), 'resolveImportPath').mockImplementation((importPath) => {
        return `${importPath}.ts`;
      });

      const result = extractCalledModules(importLines, '/test/dir', 'src/file.ts');

      expect(result).toEqual([
        './component.ts',
      ]);
    });

    it('should handle empty import lines', () => {
      const importLines = '';
      const result = extractCalledModules(importLines, '/test/dir', 'src/file.ts');
      expect(result).toEqual([]);
    });
  });

  describe('resolveImportPath', () => {
    beforeEach(() => {
      (fs.existsSync as jest.Mock).mockReset();
    });

    it('should resolve a relative import path to a .ts file', () => {
      (fs.existsSync as jest.Mock).mockImplementation((path) => {
        return path === '/test/dir/src/component.ts';
      });

      const result = resolveImportPath('./component', 'src/file.ts', '/test/dir');

      expect(result).toBe('src/component.ts');
    });

    it('should resolve a relative import path to a .tsx file', () => {
      (fs.existsSync as jest.Mock).mockImplementation((path) => {
        return path === '/test/dir/src/component.tsx';
      });

      const result = resolveImportPath('./component', 'src/file.ts', '/test/dir');

      expect(result).toBe('src/component.tsx');
    });

    it('should resolve a relative import path to an index.ts file', () => {
      (fs.existsSync as jest.Mock).mockImplementation((path) => {
        return path === '/test/dir/src/component/index.ts';
      });

      const result = resolveImportPath('./component', 'src/file.ts', '/test/dir');

      expect(result).toBe('src/component/index.ts');
    });

    it('should return the original path for non-relative imports', () => {
      const result = resolveImportPath('react', 'src/file.ts', '/test/dir');
      expect(result).toBe('react');
    });

    it('should return a best guess if no file is found', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = resolveImportPath('./component', 'src/file.ts', '/test/dir');

      expect(result).toBe('src/component.ts');
    });
  });

  describe('sortObjectKeys', () => {
    it('should sort object keys alphabetically', () => {
      const obj = {
        c: 1,
        a: 2,
        b: 3,
      };

      const result = sortObjectKeys(obj);

      expect(Object.keys(result)).toEqual(['a', 'b', 'c']);
      expect(result).toEqual({
        a: 2,
        b: 3,
        c: 1,
      });
    });

    it('should handle empty objects', () => {
      const obj = {};
      const result = sortObjectKeys(obj);
      expect(result).toEqual({});
    });
  });
});

describe('Module Map Generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock getTypescriptFiles
    jest.spyOn(require('../src/utils'), 'getTypescriptFiles').mockReturnValue([
      'src/index.ts',
      'src/component.ts',
    ]);

    // Mock createConversation
    (openaiTools.createConversation as jest.Mock).mockImplementation((prompt) => ({
      messages: [{ role: 'system', content: prompt }],
    }));

    // Mock addUserMessage
    (openaiTools.addUserMessage as jest.Mock).mockImplementation((conversation, message) => ({
      messages: [...conversation.messages, { role: 'user', content: message }],
    }));

    // Mock callOpenAI
    (openaiTools.callOpenAI as jest.Mock).mockImplementation((conversation, tools) => {
      // Return different responses based on the last user message
      const lastMessage = conversation.messages[conversation.messages.length - 1];

      if (lastMessage.content.includes('What is its purpose?')) {
        return {
          response: 'This module serves as the main entry point for the application.',
          updatedConversation: {
            messages: [...conversation.messages, { role: 'assistant', content: 'This module serves as the main entry point for the application.' }],
          },
        };
      } else if (lastMessage.content.includes('Why does the module')) {
        return {
          response: 'It imports this module to use its functionality for rendering UI components.',
          updatedConversation: {
            messages: [...conversation.messages, { role: 'assistant', content: 'It imports this module to use its functionality for rendering UI components.' }],
          },
        };
      }

      return {
        response: 'Default response',
        updatedConversation: {
          messages: [...conversation.messages, { role: 'assistant', content: 'Default response' }],
        },
      };
    });

    // Mock createTool
    (openaiTools.createTool as jest.Mock).mockReturnValue({
      name: 'get_import_lines',
      description: 'Get all import lines from a TypeScript file',
      parameters: {
        filePath: {
          type: 'string',
          description: 'Path to the TypeScript file relative to the base directory',
        },
      },
      execute: async (args: Record<string, any>) => {
        if (args.filePath === 'src/index.ts') {
          return `import { Component } from './component';`;
        }
        return '';
      },
    });
  });

  it('should create a module map for a TypeScript project', async () => {
    const moduleMap = await createModuleMap('/test/dir');

    // Verify the module map structure
    expect(moduleMap).toHaveProperty('modules');
    expect(moduleMap.modules).toHaveProperty('src/index.ts');
    expect(moduleMap.modules).toHaveProperty('src/component.ts');

    // Verify the module descriptions
    expect(moduleMap.modules['src/index.ts'].description).toBe('This module serves as the main entry point for the application.');

    // Verify the calling relationships
    expect(moduleMap.modules['src/index.ts'].calling).toHaveProperty('src/component.ts');
    expect(moduleMap.modules['src/index.ts'].calling['src/component.ts']).toBe('It imports this module to use its functionality for rendering UI components.');

    // Verify the caller relationships
    expect(moduleMap.modules['src/component.ts'].callers).toHaveProperty('src/index.ts');
    expect(moduleMap.modules['src/component.ts'].callers['src/index.ts']).toBe('It imports this module to use its functionality for rendering UI components.');
  });
});