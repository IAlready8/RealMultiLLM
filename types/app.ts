
// This file contains centralized type definitions for the application.

/**
 * Represents a single message in any chat-based interface.
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string; // Optional: The model that generated this message
  timestamp: number;
}

// =================================================================
// Data Payloads for different conversation types
// =================================================================

// For multi-chat, persist a flexible payload. Keep permissive to support
// per-provider message maps while not breaking tests that stub simple arrays.
export type MultiChatData = {
  messages?: unknown;
};

// TODO: Define a proper type for GoalHubData
export type GoalHubData = Record<string, unknown>;

// TODO: Define a proper type for ComparisonData
export type ComparisonData = Record<string, unknown>;

// TODO: Define a proper type for PipelineData
export type PipelineData = Record<string, unknown>;

// =================================================================
// Discriminated Union for Conversation Types
// =================================================================

/**
 * A base interface for all conversation types.
 */
interface ConversationBase {
  id: string;
  title: string;
  timestamp: number;
}

/**
 * A conversation specifically for the 'multi-chat' feature.
 */
export interface MultiChatConversation extends ConversationBase {
  type: 'multi-chat';
  data: MultiChatData;
}

/**
 * A conversation specifically for the 'goal-hub' feature.
 */
export interface GoalHubConversation extends ConversationBase {
  type: 'goal-hub';
  data: GoalHubData;
}

/**
 * A conversation specifically for the 'comparison' feature.
 */
export interface ComparisonConversation extends ConversationBase {
  type: 'comparison';
  data: ComparisonData;
}

/**
 * A conversation specifically for the 'pipeline' feature.
 */
export interface PipelineConversation extends ConversationBase {
  type: 'pipeline';
  data: PipelineData;
}

/**
 * A discriminated union of all possible conversation types.
 * This allows TypeScript to infer the `data` type based on the `type` field.
 */
export type Conversation = 
  | MultiChatConversation
  | GoalHubConversation
  | ComparisonConversation
  | PipelineConversation;

/**
 * A generic type to extract the data payload from a conversation type.
 * e.g., ConversationData<'multi-chat'> will resolve to MultiChatData.
 */
export type ConversationData<T extends Conversation['type']> = Extract<Conversation, { type: T }>['data'];
