// Main implementation file for TypeScript Module Map Generator

import { ModuleMap, OpenAITool } from "./types";
import { createConversation, addUserMessage, callOpenAI, createTool } from "./openai-tools";
import {
  getTypescriptFiles,
  getFileContent,
} from "./utils";

interface ReturnFormat {
  description: string;
  modules: Record<string, string>;
}

/**
 * Creates a module map for a TypeScript project.
 *
 * This function analyzes a TypeScript project and creates a map of module dependencies.
 * It uses OpenAI to determine the purpose of each module and why modules call each other.
 *
 * Usage:
 * 1. Use getTypescriptFiles(directory) to get all TypeScript files in the project
 * 2. Create tools using createGetImportLinesTool(directory)
 * 3. Use OpenAI to analyze module relationships
 * 4. Build the module map structure
 * 5. Save the map using saveMapAsYaml(moduleMap, outputPath)
 *
 * @param directory - The root directory of the TypeScript project
 * @returns A promise that resolves to a ModuleMap object
 */
export async function createModuleMap(directory: string): Promise<ModuleMap> {
  // Get all TypeScript files in the specified directory
  const files = getTypescriptFiles(directory);

  // Create the necessary OpenAI tools
  const tools = [createGetImportLinesTool(directory)];

  const callingReasons: Record<string, string> = {};
  const moduleDescriptions: Record<string, string> = {};

  // Process each file to determine its purpose and relationships
  for (const file of files) {
    // Create a conversation for analyzing this file
    let conversation = createConversation();
    const content = getFileContent(directory, file);

    // Add a user message asking about the file's purpose
    conversation = addUserMessage(
      conversation,
      `I'm going to give you the contents of a TypeScript file. in <content> tags.
      I want you to return in JSON format a description of the file's purpose.
      All the modules that are imported in the file and why they are imported.

      <example>
      {
        "description": "This file exports a function that takes an object and returns a string.",
        "modules": {
          "file.ts": "We use file.ts to read the contents of a file."
          "cats.ts": "cats.ts tells us facts about cats."
          }
        }
      }
      </example>

      Do not include imports for 3rd parties here are the only files you can use:
      <files>
      ${files.map(file => `<file>${file}</file>`).join('\n')}
      </files>

      Very important: the import statements may be relative to the current file.
      So if we are in src/animals/cats.ts and we are importing ../utils/read.ts
      Then the module needs to read src/utils/read.ts. not ../utils/read.ts.

      <filename>${file}</filename>
      <content>
      ${content}
      </content>
      `
    );

    // Call OpenAI to get an analysis of the file
    const {response} = await callOpenAI(
      conversation,
      tools,
      true,
    );
    const {description, modules} = JSON.parse(response) as ReturnFormat;
    console.log('modules', modules);

    moduleDescriptions[file] = description;
    console.log('module paths', Object.keys(modules));
    for (const modulePath of Object.keys(modules)) {
      callingReasons[`${file}->${modulePath}`] = modules[modulePath];
      console.log('calling reasons', `${file}->${modulePath}`, modules[modulePath]);
    }

  }

  const moduleMap: ModuleMap = {
    modules: {},
  };
  for (const file of files) {
    const description = moduleDescriptions[file];
    const calls: Record<string, string> = {};
    const callers: Record<string, string> = {};
    console.log('calling reasons', callingReasons);
    for (const pathPairs of Object.keys(callingReasons)) {
      console.log('path pairs', pathPairs);
      const [module1, module2] = pathPairs.split("->");
      console.log('module1', module1);
      console.log('module2', module2);
      if (module1 === file) {
        calls[module2] = callingReasons[pathPairs];
      } else if (module2 === file) {
        callers[module1] = callingReasons[pathPairs];
      }
    }
    console.log('callers', callers);
    console.log('calls', calls);
    moduleMap.modules[file] = {
      description,
      calling: calls,
      callers: callers,
    };
  }
  return moduleMap;
}

function createGetImportLinesTool(directory: string): OpenAITool {
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

        return importLines.map(line => '<import_line>' + line + '</import_line>').join('\n');
      } catch (error) {
        return `Error getting import lines: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
  );
}