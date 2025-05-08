// Utility functions for TypeScript Module Map Generator

import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import { ModuleMap } from './types';

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
                !entry.name.endsWith('.d.ts') && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.config.ts')) {
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

