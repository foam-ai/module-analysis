# TypeScript Module Map Generator

This project is designed to generate a module map from TypeScript files, providing a structured representation of module dependencies and relationships. Interviewers will be implementing the `createModuleMap` functionality as part of the assessment.

## Getting Started

### Prerequisites

- Node.js (version specified in `.nvmrc`)
- Git
- Yarn package manager
- OpenAI API key

### Initialization

Run the initialization script to clone the necessary repositories:

```bash
./initialize.sh
```

This script will:
1. Clone the `demoapp` repository from GitHub (`git@github.com:foam-ai/demoapp.git`)
2. Confirm successful cloning

After cloning, you'll have a sample TypeScript project to analyze.

### Environment Setup

Set your OpenAI API key as an environment variable:

```bash
export OPENAI_API_KEY=your_api_key_here
```

If the API key is not provided, the application will throw an error when attempting to use OpenAI functionality.

### Running the Project

The project can be run using:

```bash
yarn start
```

This will execute the main script that generates a module map for the cloned repository.

## Project Structure

### Data Types (`src/types.ts`)

The project uses several key data structures:

- **Message**: Represents a message in an OpenAI conversation
- **Conversation**: Contains a sequence of messages for maintaining context
- **OpenAITool**: Defines a tool that can be used in OpenAI conversations
- **ModuleMap**: The overall structure containing module information
- **Module**: Information about a specific module, including:
  - `description`: Purpose of the module
  - `calling`: Modules this module calls, with reasons
  - `callers`: Modules that call this module, with reasons

### TypeScript Utilities (`src/utils.ts`)

The `utils.ts` file provides several helper functions for working with TypeScript files:

#### `getTypescriptFiles(directory: string): string[]`

Recursively finds all TypeScript files in a directory, excluding:
- Hidden directories
- `node_modules` directory
- Declaration files (`.d.ts`)
- Test files (`.test.ts`)
- Config files (`.config.ts`)

```typescript
// Example usage
const tsFiles = getTypescriptFiles('./demoapp');
console.log(tsFiles); // ['src/index.ts', 'src/components/App.tsx', ...]
```

#### `getFileContent(directory: string, filePath: string): string`

Retrieves the content of a file as a string.

```typescript
// Example usage
const content = getFileContent('./demoapp', 'src/index.ts');
```

### OpenAI Tools (`src/openai-tools.ts`)

The `openai-tools.ts` file provides integration with OpenAI's API for generating the module map:

#### `createTool(name: string, description: string, parameters: Record<string, any>, executeFn: Function): OpenAITool`

Creates a new OpenAI tool with specified name, description, parameters, and execution function.

```typescript
// Example usage
const analyzeCodeTool = createTool(
  'analyzeCode',
  'Analyzes TypeScript code to extract imports and exports',
  {
    code: { type: 'string', description: 'The TypeScript code to analyze' }
  },
  async (args) => {
    // Implementation
    return JSON.stringify(result);
  }
);
```

#### `createConversation(systemPrompt?: string): Conversation`

Creates a new conversation with an optional system prompt.

```typescript
// Example usage
const conversation = createConversation('You are a TypeScript code analyzer.');
```

#### `addUserMessage(conversation: Conversation, content: string): Conversation`

Adds a user message to the conversation.

```typescript
// Example usage
const updatedConversation = addUserMessage(conversation, 'Analyze this code: ' + code);
```

#### `callOpenAI(conversation: Conversation, tools: OpenAITool[], forceJSON?: boolean): Promise<{ response: string; updatedConversation: Conversation }>`

Calls the OpenAI API with the provided conversation history and tools, handling tool calls in the response.

```typescript
// Example usage
const { response, updatedConversation } = await callOpenAI(conversation, [analyzeCodeTool]);
```

## Implementing `createModuleMap`

Your task is to implement the `createModuleMap` function in `src/module-map.ts`. This function:

1. Takes a directory path as input
2. Analyzes all TypeScript files in that directory
3. Uses OpenAI to determine the purpose of each module and the relationships between modules
4. Constructs a `ModuleMap` object representing the module structure
5. Returns the completed module map

### Implementation Steps

The `createModuleMap` function should:

1. Use `getTypescriptFiles(directory)` to get all TypeScript files in the project
2. Create a tool to help with this project.
3. Build the module map structure with:
   - Module descriptions
   - Calling relationships (which modules this module calls)
   - Caller relationships (which modules call this module)
4. Return the completed `ModuleMap` object

### Example Output

The final module map will be structured like this:

```yaml
modules:
  "src/index.ts":
    description: "Entry point that initializes the application"
    calling:
      "src/app.ts": "Imports the main App component to render it"
    callers: {}
  "src/app.ts":
    description: "Defines the main App component"
    calling:
      "src/components/Button.tsx": "Uses the Button component for user interaction"
    callers:
      "src/index.ts": "Called by index.ts to render the main application"
```

This YAML representation shows the relationships between modules, making it easy to understand the project structure.

## Running

```bash
yarn run start
```

This will execute the code to verify your implementation.