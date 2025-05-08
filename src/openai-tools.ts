
// OpenAI integration helpers for TypeScript Module Map Generator

import { OpenAI} from 'openai';
import { Conversation, Message, OpenAITool } from './types';

// Initialize the OpenAI client with the API key from environment variables
// If the API key is not available, we'll use a mock implementation
const apiKey = process.env.OPENAI_API_KEY;

// Check if API key is available
const openai = apiKey
  ? new OpenAI({ apiKey })
  : null; // Will be handled with mock implementation when null

/**
 * Creates a new OpenAI tool with the specified name, description, parameters, and execution function.
 *
 * @param name - The name of the tool
 * @param description - A description of what the tool does
 * @param parameters - The parameters the tool accepts, defined as a JSON Schema object
 * @param executeFn - Function to execute the tool with the given arguments
 * @returns An OpenAITool object that can be used with the OpenAI API
 */
export function createTool(
  name: string,
  description: string,
  parameters: Record<string, any>,
  executeFn: (args: Record<string, any>) => Promise<string>
): OpenAITool {
  return {
    name,
    description,
    parameters,
    execute: executeFn,
  };
}

/**
 * Creates a new conversation with the specified system prompt.
 *
 * @param systemPrompt - The system prompt to initialize the conversation with
 * @returns A new Conversation object with the system prompt as the first message
 */
export function createConversation(systemPrompt?: string): Conversation {
  if (!systemPrompt) {
    return {messages: []};
  }
  return {
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
    ],
  };
}

/**
 * Adds a user message to the conversation and returns the updated conversation.
 *
 * @param conversation - The conversation to add the message to
 * @param content - The content of the user message
 * @returns The updated conversation with the new user message
 */
export function addUserMessage(conversation: Conversation, content: string): Conversation {
  return {
    messages: [
      ...conversation.messages,
      {
        role: 'user',
        content,
      },
    ],
  };
}

/**
 * Calls the OpenAI API with the provided conversation history and tools.
 * Handles tool calls in the response and maintains conversation history.
 *
 * @param conversation - The conversation history to send to OpenAI
 * @param tools - Array of tools that OpenAI can use in its response
 * @returns An object containing the response text and the updated conversation
 */
export async function callOpenAI(
  conversation: Conversation,
  tools: OpenAITool[],
  forceJSON?: boolean,
): Promise<{ response: string; updatedConversation: Conversation }> {
  // If OpenAI client is not available, use a mock implementation
  if (!openai) {
    throw new Error('OpenAI API key not found. Please set the OPENAI_API_KEY environment variable.');
  }

  // Convert our tools to the format expected by the OpenAI API
  const openaiTools = tools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties: tool.parameters,
        required: Object.keys(tool.parameters).filter(
          param => !tool.parameters[param].optional
        ),
      },
    },
  }));

  // Create a map of tool names to their execution functions for easy lookup
  const toolMap = new Map<string, (args: Record<string, any>) => Promise<string>>();
  tools.forEach(tool => {
    toolMap.set(tool.name, tool.execute);
  });

  // Call the OpenAI API
  const response = await openai.chat.completions.create({
    model: 'gpt-4.1-mini-2025-04-14',
    messages: conversation.messages.map(msg => {
      // Handle each role type specifically to match OpenAI's expected types
      switch (msg.role) {
        case 'system':
          return {
            role: 'system',
            content: msg.content
          };
        case 'user':
          return {
            role: 'user',
            content: msg.content
          };
        case 'assistant':
          return {
            role: 'assistant',
            content: msg.content
          };
        case 'tool':
          // For tool messages, we need to handle them differently
          // Since we don't have tool_call_id in our Message type,
          // we'll convert tool messages to user messages for now
          return {
            role: 'user',
            content: `Tool ${msg.name || 'unknown'} response: ${msg.content}`
          };
        default:
          // Default fallback
          return {
            role: 'user',
            content: msg.content
          };
      }
    }),
    tools: openaiTools.length > 0 ? openaiTools : undefined,
    tool_choice: openaiTools.length > 0 ? 'auto' : undefined,
    response_format: forceJSON ? { type: "json_object" } : undefined,
  });
  // Get the assistant's message from the response
  const assistantMessage = response.choices[0].message;
  console.log('**input**:\n', conversation.messages[0].content);
  console.log('**output**:\n', assistantMessage.content);

  // Add the assistant's message to the conversation
  let updatedConversation: Conversation = {
    messages: [
      ...conversation.messages,
      {
        role: 'assistant',
        content: assistantMessage.content || '',
        // Add any other properties needed from assistantMessage
      } as Message
    ],
  };

  // Check if the assistant's message contains tool calls
  if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
    // Process each tool call
    for (const toolCall of assistantMessage.tool_calls) {
      const toolName = toolCall.function.name;
      const toolFunction = toolMap.get(toolName);

      if (!toolFunction) {
        throw new Error(`Tool "${toolName}" not found`);
      }

      // Parse the arguments
      const args = JSON.parse(toolCall.function.arguments);

      // Execute the tool
      const toolResult = await toolFunction(args);

      // Add the tool result to the conversation
      updatedConversation = {
        messages: [
          ...updatedConversation.messages,
          {
            role: 'tool',
            content: toolResult,
            name: toolName,
          },
        ],
      };
    }

    // Call OpenAI again with the updated conversation that includes tool results
    return callOpenAI(updatedConversation, tools);
  }

  // If there are no tool calls, return the assistant's response and the updated conversation
  return {
    response: assistantMessage.content || '',
    updatedConversation,
  };
}