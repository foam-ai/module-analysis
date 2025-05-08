// Utility functions for TypeScript Module Map Generator

import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import { OpenAITool, ModuleMap } from './types';
import { createTool } from './openai-tools';

/**
 * Gets all TypeScript files in a directory recursively.
 *
 * @param directory - The directory to search in
 * @returns An array of file paths relative to the directory
 */
export function getTypescriptFiles(directory: string): string[] {
  const files: string[] = [];

  function traverseDirectory(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(directory, fullPath);

      // Skip node_modules and hidden directories
      if (entry.isDirectory() &&
          !entry.name.startsWith('.') &&
          entry.name !== 'node_modules') {
        traverseDirectory(fullPath);
      } else if (entry.isFile() &&
                (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
                !entry.name.endsWith('.d.ts') && !entry.name.endsWith('.test.ts')) {
        // Include .ts and .tsx files, but exclude declaration files
        files.push(relativePath);
      }
    }
  }

  traverseDirectory(directory);
  return files;
}

/**
 * Gets the content of a file.
 *
 * @param directory - The base directory
 * @param filePath - The path to the file relative to the directory
 * @returns The content of the file as a string
 */
export function getFileContent(directory: string, filePath: string): string {
  const fullPath = path.join(directory, filePath);
  return fs.readFileSync(fullPath, 'utf-8');
}

/**
 * Creates a tool to get import lines from a TypeScript file.
 *
 * @param directory - The base directory
 * @returns An OpenAI tool that can extract import lines
 */
export function createGetImportLinesTool(directory: string): OpenAITool {
  return createTool(
    'get_import_lines',
    'Get all import lines from a TypeScript file',
    {
      filePath: {
        type: 'string',
        description: 'Path to the TypeScript file relative to the base directory',
      },
    },
    async (args: Record<string, any>) => {
      const { filePath } = args as { filePath: string };
      try {
        const content = getFileContent(directory, args.filePath);
        const lines = content.split('\n');

        // Filter lines that start with 'import' and aren't commented out
        const importLines = lines.filter(line => {
          const trimmed = line.trim();
          return trimmed.startsWith('import') &&
                 !trimmed.startsWith('//') &&
                 !trimmed.startsWith('/*');
        });

        return importLines.join('\n');
      } catch (error) {
        return `Error getting import lines: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  );
}

/**
 * Extracts a description from an OpenAI response.
 *
 * @param response - The OpenAI response
 * @returns The extracted description
 */
export function extractDescription(response: string): string {
  if (!response) return '';

  // Try to find a description section
  const descriptionMatch = response.match(/description:?\s*(.*?)(?:\n|$)/i);
  if (descriptionMatch && descriptionMatch[1]) {
    return descriptionMatch[1].trim();
  }

  // If no explicit description section, use the first paragraph
  const paragraphs = response.split('\n\n');
  if (paragraphs.length > 0) {
    // Remove markdown formatting and clean up
    return paragraphs[0]
      .replace(/^[#\s*-]+/, '') // Remove markdown headers, list markers
      .replace(/`/g, '')        // Remove code ticks
      .trim();
  }

  // Fallback to first line if no paragraphs
  const lines = response.split('\n');
  return lines[0].trim();
}

/**
 * Extracts called modules from import lines.
 *
 * @param importLines - The import lines from a TypeScript file
 * @param directory - The base directory
 * @param filePath - The path of the file containing the imports
 * @returns An array of module paths
 */
export function extractCalledModules(
  importLines: string,
  directory: string,
  filePath: string = ''
): string[] {
  if (!importLines) return [];

  const modules: string[] = [];
  const lines = importLines.split('\n');

  for (const line of lines) {
    // Match different import patterns
    // 1. import X from 'module'
    // 2. import { X } from 'module'
    // 3. import * as X from 'module'
    const match = line.match(/from\s+['"](.+?)['"]/);

    if (match && match[1]) {
      const importPath = match[1];

      // Skip node_modules imports and absolute imports
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
        continue;
      }

      // Resolve the import path to a file path
      if (filePath) {
        const resolvedPath = resolveImportPath(importPath, filePath, directory);
        if (resolvedPath !== importPath) { // Only add if resolution was successful
          modules.push(resolvedPath);
        }
      } else {
        modules.push(importPath);
      }
    }
  }

  // Remove duplicates
  return [...new Set(modules)];
}

/**
 * Saves a module map as a YAML file.
 *
 * @param moduleMap - The module map to save
 * @param outputPath - The path to save the YAML file to
 */
export function saveMapAsYaml(moduleMap: ModuleMap, outputPath: string): void {
  // Ensure the output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Convert to YAML and save
  const yamlContent = yaml.dump(moduleMap, {
    indent: 2,
    lineWidth: 100,
    noRefs: true,
  });

  fs.writeFileSync(outputPath, yamlContent, 'utf-8');
}

/**
 * Resolves a relative import path to an absolute path.
 *
 * @param importPath - The import path
 * @param importingFilePath - The path of the file doing the importing
 * @param baseDirectory - The base directory
 * @returns The resolved path
 */
export function resolveImportPath(
  importPath: string,
  importingFilePath: string,
  baseDirectory: string
): string {
  // Handle only relative imports
  if (!importPath.startsWith('.')) {
    return importPath;
  }

  const importingDir = path.dirname(importingFilePath);
  let resolvedPath = path.normalize(path.join(importingDir, importPath));

  // Check for different file extensions and index files
  const possiblePaths = [
    resolvedPath,
    `${resolvedPath}.ts`,
    `${resolvedPath}.tsx`,
    path.join(resolvedPath, 'index.ts'),
    path.join(resolvedPath, 'index.tsx')
  ];

  for (const possiblePath of possiblePaths) {
    if (fs.existsSync(path.join(baseDirectory, possiblePath))) {
      // Return the path relative to the base directory
      return possiblePath;
    }
  }

  // If no file is found, return the normalized path with .ts extension as a best guess
  return `${resolvedPath}.ts`;
}

/**
 * Sorts object keys alphabetically.
 *
 * @param obj - The object to sort
 * @returns A new object with sorted keys
 */
export function sortObjectKeys<T>(obj: Record<string, T>): Record<string, T> {
  return Object.keys(obj)
    .sort()
    .reduce((result, key) => {
      result[key] = obj[key];
      return result;
    }, {} as Record<string, T>);
}