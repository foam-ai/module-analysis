// Type definitions for TypeScript Module Map Generator

/**
 * Represents a message in an OpenAI conversation.
 * Messages can be from different roles: system, user, assistant, or tool.
 */
export interface Message {
  /** The role of the message sender (system, user, assistant, or tool) */
  role: 'system' | 'user' | 'assistant' | 'tool';
  /** The content of the message */
  content: string;
  /** Optional name identifier for the message sender, particularly useful for tools */
  name?: string;
}

/**
 * Represents a conversation history containing a sequence of messages.
 * Used to maintain context in OpenAI API interactions.
 */
export interface Conversation {
  /** Array of messages in the conversation */
  messages: Message[];
}

/**
 * Defines an OpenAI tool that can be used in conversations.
 * Tools have a name, description, parameters, and an execution function.
 */
export interface OpenAITool {
  /** The name of the tool */
  name: string;
  /** A description of what the tool does */
  description: string;
  /** The parameters the tool accepts, defined as a record of parameter names to their specifications */
  parameters: Record<string, any>;
  /** Function to execute the tool with the given arguments */
  execute: (args: Record<string, any>) => Promise<string>;
}

/**
 * Represents the overall structure of a module map.
 * Contains a record of module names to their corresponding module information.
 */
export interface ModuleMap {
  /** Record of module names to their module information */
  modules: Record<string, Module>;
}

/**
 * Contains information about a specific module.
 * Includes a description and records of modules it calls and modules that call it.
 */
export interface Module {
  /** Description of the module's purpose and functionality */
  description: string;
  /** Record of module names this module calls, with descriptions of how they're used */
  calling: Record<string, string>;
  /** Record of module names that call this module, with descriptions of how it's used */
  callers: Record<string, string>;
}