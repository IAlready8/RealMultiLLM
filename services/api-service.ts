import { callLLM, LLMRequestOptions, LLMResponse } from "./api-client";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export async function sendChatMessage(
  provider: string,
  messages: ChatMessage[],
  options: LLMRequestOptions = {}
): Promise<ChatMessage> {
  try {
    // Format messages for the API
    const formattedPrompt = messages.map(msg => msg.content);
    
    // Add system prompt if present
    const systemMessage = messages.find(msg => msg.role === "system");
    if (systemMessage) {
      options.systemPrompt = systemMessage.content;
    }
    
    // Call the API
    const response = await callLLM(provider, formattedPrompt, '', options);
    
    // Return formatted response
    return {
      role: "assistant",
      content: response.content,
      timestamp: Date.now(),
      metadata: {
        ...response.metadata
      }
    };
  } catch (error) {
    console.error(`Error calling ${provider} API:`, error);
    throw error; // Re-throw the error for the calling component to handle
  }
}

export async function streamChatMessage(
  provider: string,
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  options: LLMRequestOptions = {}
): Promise<void> {
  try {
    // Format messages for the API
    const formattedPrompt = messages.map(msg => msg.content);
    
    // Add system prompt if present
    const systemMessage = messages.find(msg => msg.role === "system");
    if (systemMessage) {
      options.systemPrompt = systemMessage.content;
    }
    
    // Set streaming options
    options.stream = true;
    options.onChunk = onChunk;
    
    // Call the API
    await callLLM(provider, formattedPrompt, '', options);
  } catch (error) {
    console.error(`Error streaming from ${provider} API:`, error);
    onChunk(`Error: ${error instanceof Error ? error.message : "Failed to get response"}`);
    throw error; // Re-throw the error for the calling component to handle
  }
}