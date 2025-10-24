/**
 * Advanced Context Management System for RealMultiLLM
 * Provides intelligent context windowing with compression and semantic search
 */

import { Logger } from '../../../lib/logger';
import { Cache } from '../../../lib/cache';
import { LLMManager } from '../../../lib/llm-manager';

// Type definitions
export interface ContextMessage {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  tokens?: number; // Number of tokens in this message
  importance?: number; // 0-1 importance score, higher means more important
  category?: string; // Category for semantic organization
  relationships?: string[]; // IDs of related messages
}

export interface ContextWindow {
  id: string;
  userId: string;
  sessionId: string;
  messages: ContextMessage[];
  maxTokens: number;
  currentTokens: number;
  summary?: ContextSummary;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, any>;
}

export interface ContextSummary {
  id: string;
  content: string;
  tokens: number;
  messageIds: string[]; // IDs of messages included in this summary
  timestamp: Date;
  type: 'auto' | 'manual' | 'chunk'; // How the summary was created
  metadata?: Record<string, any>;
}

export interface ContextStrategy {
  name: string;
  description: string;
  compress: (window: ContextWindow, targetTokens: number) => ContextWindow;
  shouldCompress: (window: ContextWindow) => boolean;
  calculateImportance: (message: ContextMessage, context: ContextWindow) => number;
}

export interface SemanticContext {
  query: string;
  context: any;
  similarity: number; // 0-1 similarity score
  timestamp: Date;
}

export interface ContextCompressionResult {
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  summaryAdded: boolean;
  messagesRemoved: number;
  preservationRate: number; // 0-1, how much important content was preserved
}

export class ContextManager {
  private contextWindows: Map<string, ContextWindow>;
  private semanticCache: Map<string, SemanticContext[]>;
  private logger: Logger;
  private cache: Cache;
  private llmManager: LLMManager;
  private strategies: Map<string, ContextStrategy>;
  private defaultStrategy: string;

  constructor(options?: {
    defaultMaxTokens?: number;
    defaultStrategy?: string;
  }) {
    this.contextWindows = new Map();
    this.semanticCache = new Map();
    this.strategies = new Map();
    this.logger = new Logger('ContextManager');
    this.cache = new Cache();
    this.llmManager = new LLMManager();
    this.defaultStrategy = options?.defaultStrategy || 'selective-compression';

    this.initializeDefaultStrategies();
  }

  /**
   * Initialize default context management strategies
   */
  private initializeDefaultStrategies(): void {
    // Selective compression strategy - removes low-importance messages
    this.strategies.set('selective-compression', {
      name: 'Selective Compression',
      description: 'Removes low-importance messages while preserving important ones',
      shouldCompress: (window: ContextWindow) => window.currentTokens > 0.9 * window.maxTokens,
      calculateImportance: this.calculateMessageImportance.bind(this),
      compress: (window: ContextWindow, targetTokens: number): ContextWindow => {
        const newWindow = { ...window, messages: [...window.messages] };
        
        // Sort messages by importance (ascending - least important first)
        const sortedMessages = [...newWindow.messages]
          .map((msg, index) => ({ msg, index }))
          .sort((a, b) => (a.msg.importance || 0) - (b.msg.importance || 0));
        
        let currentTokens = newWindow.currentTokens;
        const toRemove: number[] = [];
        
        for (const { msg, index } of sortedMessages) {
          if (currentTokens <= targetTokens) break;
          
          // Don't remove the last few messages (the most recent interaction)
          if (index >= newWindow.messages.length - 3) continue;
          
          toRemove.push(index);
          currentTokens -= msg.tokens || this.estimateTokens(msg.content);
        }
        
        // Remove messages in reverse order to preserve indices
        toRemove.sort((a, b) => b - a).forEach(index => {
          newWindow.messages.splice(index, 1);
        });
        
        newWindow.currentTokens = currentTokens;
        newWindow.updatedAt = new Date();
        
        return newWindow;
      }
    });

    // Summary-based compression strategy - creates summaries of old messages
    this.strategies.set('summary-compression', {
      name: 'Summary Compression',
      description: 'Creates summaries of old messages to reduce token usage',
      shouldCompress: (window: ContextWindow) => window.currentTokens > 0.85 * window.maxTokens,
      calculateImportance: this.calculateMessageImportance.bind(this),
      compress: (window: ContextWindow, targetTokens: number): ContextWindow => {
        const newWindow = { ...window, messages: [...window.messages] };
        
        // Find older messages that can be summarized
        const messagesToSummarize = newWindow.messages
          .filter((msg, index) => {
            // Don't summarize the last few messages
            return index < newWindow.messages.length - 3 && 
                   (msg.importance || 0) < 0.7; // Only summarize less important messages
          })
          .slice(0, Math.floor(newWindow.messages.length * 0.3)); // Summarize at most 30% of messages
        
        if (messagesToSummarize.length > 0) {
          // Create a summary of these messages
          const contentToSummarize = messagesToSummarize.map(msg => 
            `[${msg.role}] ${msg.content}`
          ).join('\n\n');
          
          // Use LLM to create summary
          const summary = this.summarizeContent(contentToSummarize, 100);
          
          // Calculate how many tokens the summary adds
          const summaryTokens = this.estimateTokens(summary);
          
          // Calculate how many tokens we're removing
          const removedTokens = messagesToSummarize.reduce((sum, msg) => 
            sum + (msg.tokens || this.estimateTokens(msg.content)), 0
          );
          
          // Filter out the messages to be summarized
          newWindow.messages = newWindow.messages.filter(msg => 
            !messagesToSummarize.some(toSum => toSum.id === msg.id)
          );
          
          // Add the summary at the beginning (or after system messages)
          const summaryMessage: ContextMessage = {
            id: `summary_${Date.now()}`,
            role: 'system',
            content: `Previous conversation summary: ${summary}`,
            timestamp: new Date(),
            metadata: { type: 'summary', originalMessageIds: messagesToSummarize.map(m => m.id) },
            tokens: summaryTokens,
            importance: 0.5, // Medium importance
            category: 'summary'
          };
          
          // Insert summary after any existing system messages
          const firstNonSystemIndex = newWindow.messages.findIndex(m => m.role !== 'system');
          if (firstNonSystemIndex === -1) {
            newWindow.messages.push(summaryMessage); // No non-system messages found, append at end
          } else {
            newWindow.messages.splice(firstNonSystemIndex, 0, summaryMessage);
          }
          
          newWindow.currentTokens = newWindow.currentTokens - removedTokens + summaryTokens;
        }
        
        newWindow.updatedAt = new Date();
        return newWindow;
      }
    });

    // Sliding window strategy - keeps only the most recent messages
    this.strategies.set('sliding-window', {
      name: 'Sliding Window',
      description: 'Keeps only the most recent messages within the token limit',
      shouldCompress: (window: ContextWindow) => window.currentTokens > 0.95 * window.maxTokens,
      calculateImportance: (message: ContextMessage, context: ContextWindow) => {
        // Importance is based on recency - more recent messages are more important
        const messageIndex = context.messages.findIndex(m => m.id === message.id);
        const totalMessages = context.messages.length;
        return messageIndex >= 0 ? messageIndex / totalMessages : 0.1;
      },
      compress: (window: ContextWindow, targetTokens: number): ContextWindow => {
        const newWindow = { ...window, messages: [...window.messages] };
        
        // Keep system messages at the beginning
        const systemMessages = newWindow.messages.filter(m => m.role === 'system');
        const nonSystemMessages = newWindow.messages.filter(m => m.role !== 'system');
        
        // Sort non-system messages by importance (descending - most important first)
        const sortedMessages = [...nonSystemMessages].sort((a, b) => 
          (b.importance || 0) - (a.importance || 0)
        );
        
        // Keep removing least important messages until under target
        let currentTokens = newWindow.currentTokens;
        const keptMessages: ContextMessage[] = [...systemMessages];
        
        for (const msg of sortedMessages) {
          if (currentTokens <= targetTokens) break;
          
          keptMessages.push(msg);
          currentTokens = currentTokens - (msg.tokens || this.estimateTokens(msg.content));
        }
        
        newWindow.messages = keptMessages;
        newWindow.currentTokens = currentTokens;
        newWindow.updatedAt = new Date();
        
        return newWindow;
      }
    });
  }

  /**
   * Create a new context window
   */
  createContextWindow(userId: string, sessionId: string, maxTokens: number = 4096): ContextWindow {
    const contextWindow: ContextWindow = {
      id: `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      sessionId,
      messages: [],
      maxTokens,
      currentTokens: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {}
    };

    this.contextWindows.set(contextWindow.id, contextWindow);
    this.logger.info(`Context window created for user ${userId}, session ${sessionId}`);
    
    return contextWindow;
  }

  /**
   * Add a message to a context window
   */
  async addMessage(windowId: string, message: Omit<ContextMessage, 'id' | 'tokens' | 'timestamp'>): Promise<ContextMessage> {
    const window = this.contextWindows.get(windowId);
    if (!window) {
      throw new Error(`Context window not found: ${windowId}`);
    }

    // Estimate tokens if not provided
    const tokens = message.tokens || this.estimateTokens(message.content);
    
    // Calculate importance if not provided
    const importance = message.importance !== undefined ? message.importance : 
                      this.calculateMessageImportance(
                        { ...message, id: 'temp', timestamp: new Date(), tokens } as ContextMessage, 
                        window
                      );

    const newMessage: ContextMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tokens,
      importance,
      timestamp: new Date()
    };

    // Add to window
    window.messages.push(newMessage);
    window.currentTokens += tokens;
    window.updatedAt = new Date();

    // Check if compression is needed
    if (this.shouldCompress(window)) {
      await this.compressContextWindow(windowId);
    }

    // Cache the message
    await this.cache.set(`context:message:${newMessage.id}`, newMessage, 60 * 60 * 24); // 24 hours

    this.logger.info(`Message added to context window ${windowId}, tokens: ${tokens}`);

    return newMessage;
  }

  /**
   * Check if a window should be compressed
   */
  private shouldCompress(window: ContextWindow): boolean {
    const strategy = this.strategies.get(this.defaultStrategy);
    return strategy ? strategy.shouldCompress(window) : false;
  }

  /**
   * Compress a context window using the selected strategy
   */
  async compressContextWindow(windowId: string, strategyName?: string): Promise<ContextCompressionResult> {
    const window = this.contextWindows.get(windowId);
    if (!window) {
      throw new Error(`Context window not found: ${windowId}`);
    }

    const strategy = this.strategies.get(strategyName || this.defaultStrategy);
    if (!strategy) {
      throw new Error(`Context strategy not found: ${strategyName || this.defaultStrategy}`);
    }

    const originalTokens = window.currentTokens;
    const targetTokens = Math.floor(window.maxTokens * 0.7); // Target 70% of max to leave buffer

    // Apply compression strategy
    const compressedWindow = strategy.compress(window, targetTokens);

    // Calculate compression metrics
    const compressionResult: ContextCompressionResult = {
      originalTokens,
      compressedTokens: compressedWindow.currentTokens,
      compressionRatio: 1 - (compressedWindow.currentTokens / originalTokens),
      summaryAdded: originalTokens !== compressedWindow.currentTokens,
      messagesRemoved: window.messages.length - compressedWindow.messages.length,
      preservationRate: this.calculatePreservationRate(window, compressedWindow)
    };

    // Update the window in our store
    this.contextWindows.set(windowId, compressedWindow);

    this.logger.info(`Context window ${windowId} compressed: ${compressionResult.compressionRatio * 100}% reduction`);
    return compressionResult;
  }

  /**
   * Calculate how much important content was preserved during compression
   */
  private calculatePreservationRate(original: ContextWindow, compressed: ContextWindow): number {
    // Calculate total importance scores
    const originalImportance = original.messages.reduce((sum, msg) => sum + (msg.importance || 0), 0);
    const compressedImportance = compressed.messages.reduce((sum, msg) => sum + (msg.importance || 0), 0);
    
    return originalImportance > 0 ? compressedImportance / originalImportance : 1;
  }

  /**
   * Calculate message importance based on various factors
   */
  private calculateMessageImportance(message: ContextMessage, context: ContextWindow): number {
    let importance = 0.1; // Base importance

    // Role-based importance
    switch (message.role) {
      case 'system': importance += 0.3; break; // System messages are important
      case 'assistant': importance += 0.2; break; // Responses are moderately important
      case 'user': importance += 0.25; break; // User inputs are important
      case 'tool': importance += 0.15; break; // Tool responses are somewhat important
    }

    // Length-based importance (longer meaningful messages)
    if (message.content.length > 50) {
      importance += Math.min(0.2, message.content.length / 1000);
    }

    // Category-based importance
    if (message.category === 'critical') importance += 0.3;
    if (message.category === 'important') importance += 0.2;
    if (message.category === 'reference') importance += 0.15;

    // Recency-based importance (more recent messages are more important)
    const ageInHours = (Date.now() - message.timestamp.getTime()) / (1000 * 60 * 60);
    if (ageInHours < 1) importance += 0.2; // Less than 1 hour old
    else if (ageInHours < 6) importance += 0.15; // Less than 6 hours old

    // Metadata-based importance
    if (message.metadata?.sticky) importance += 0.4; // Sticky messages are very important
    if (message.metadata?.summary) importance += 0.3; // Summaries are important
    if (message.metadata?.actionItem) importance += 0.25; // Action items are important

    // Don't exceed 1.0
    return Math.min(1.0, importance);
  }

  /**
   * Get relevant context for a query using semantic search
   */
  async getRelevantContext(query: string, windowId: string, limit: number = 5): Promise<ContextMessage[]> {
    const window = this.contextWindows.get(windowId);
    if (!window) {
      throw new Error(`Context window not found: ${windowId}`);
    }

    // First, check if we have cached semantic results for this query
    const cacheKey = `semantic:${query}:${windowId}:${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached as ContextMessage[];
    }

    // Use LLM to identify relevant messages based on the query
    const relevantMessages = await this.findSemanticallyRelevantMessages(query, window.messages, limit);
    
    // Cache the result
    await this.cache.set(cacheKey, relevantMessages, 60 * 30); // 30 minutes

    return relevantMessages;
  }

  /**
   * Find semantically relevant messages using LLM
   */
  private async findSemanticallyRelevantMessages(query: string, messages: ContextMessage[], limit: number): Promise<ContextMessage[]> {
    // In a production system, this would use vector embeddings and similarity search
    // For now, we'll use a simplified approach with LLM
    
    // Create a prompt to identify relevant messages
    const messagesText = messages.map((msg, index) => 
      `[${index}] [${msg.role}] ${msg.content}`
    ).join('\n\n');

    const prompt = `
      Given the user query: "${query}"
      
      And the following conversation history:
      ${messagesText}
      
      Identify the most relevant messages that would help answer the query.
      Respond with a list of message indices that are most relevant.
      Only return the relevant indices as a simple JSON array.
    `;

    try {
      const response = await this.llmManager.generateResponse({
        prompt,
        model: 'openai/gpt-3.5-turbo',
        context: { query, messageCount: messages.length }
      });

      // Parse the response to get relevant indices
      const indices = this.parseRelevantIndices(response);
      const relevantMessages = indices
        .filter(index => index >= 0 && index < messages.length)
        .map(index => messages[index])
        .slice(0, limit);

      return relevantMessages;
    } catch (error) {
      this.logger.error('Error finding relevant messages:', error);
      
      // Fallback to simple algorithm based on message importance and recency
      return [...messages]
        .sort((a, b) => (b.importance || 0) - (a.importance || 0))
        .slice(0, limit);
    }
  }

  /**
   * Parse relevant message indices from LLM response
   */
  private parseRelevantIndices(response: string): number[] {
    try {
      // Try to parse as JSON array
      const parsed = JSON.parse(response.trim());
      if (Array.isArray(parsed) && parsed.every(item => typeof item === 'number')) {
        return parsed as number[];
      }
    } catch (e) {
      // If JSON parsing fails, try to extract numbers with regex
      const numbers = response.match(/\d+/g);
      if (numbers) {
        return numbers.map(num => parseInt(num, 10)).filter(num => !isNaN(num));
      }
    }
    
    return []; // Return empty if parsing fails
  }

  /**
   * Summarize content using LLM
   */
  private summarizeContent(content: string, maxTokens: number = 100): string {
    // In a real implementation, this would call an LLM to summarize
    // For this example, we'll return a simple truncated version
    // But in practice, you'd want to use an LLM to create meaningful summaries
    if (content.length < maxTokens * 4) { // Rough estimate: 1 token ~ 4 chars
      return content;
    }

    // Use LLM for actual summarization
    const prompt = `
      Please create a concise summary of the following text:
      
      ${content}
      
      The summary should capture the essential points in about ${maxTokens} tokens.
      Summary:
    `;

    try {
      // In a real implementation, this would be an async call
      // For now, returning a placeholder
      return `Summary of: ${content.substring(0, Math.min(200, content.length))}...`;
    } catch (error) {
      this.logger.error('Error creating summary:', error);
      return `Summary of: ${content.substring(0, Math.min(200, content.length))}...`;
    }
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    // In a real implementation, use a proper tokenizer
    return Math.ceil(text.length / 4);
  }

  /**
   * Create a context summary manually
   */
  async createManualSummary(windowId: string, content: string, messageIds?: string[]): Promise<ContextSummary> {
    const window = this.contextWindows.get(windowId);
    if (!window) {
      throw new Error(`Context window not found: ${windowId}`);
    }

    const tokens = this.estimateTokens(content);
    const summary: ContextSummary = {
      id: `summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content,
      tokens,
      messageIds: messageIds || [],
      timestamp: new Date(),
      type: 'manual'
    };

    // Add summary as a message in the context
    await this.addMessage(windowId, {
      role: 'system',
      content: `Context summary: ${content}`,
      metadata: { type: 'summary', summaryId: summary.id },
      tokens,
      importance: 0.4,
      category: 'summary'
    });

    // Update cache
    await this.cache.set(`context:summary:${summary.id}`, summary, 60 * 60 * 24 * 7); // 1 week

    this.logger.info(`Manual summary created for context window ${windowId}`);
    return summary;
  }

  /**
   * Get context window by ID
   */
  getContextWindow(windowId: string): ContextWindow | undefined {
    return this.contextWindows.get(windowId);
  }

  /**
   * Update context window metadata
   */
  updateContextMetadata(windowId: string, metadata: Record<string, any>): ContextWindow | undefined {
    const window = this.contextWindows.get(windowId);
    if (!window) return undefined;

    window.metadata = { ...window.metadata, ...metadata };
    window.updatedAt = new Date();

    return window;
  }

  /**
   * Clear context window (keeping only system messages)
   */
  clearContextWindow(windowId: string): boolean {
    const window = this.contextWindows.get(windowId);
    if (!window) return false;

    // Keep only system messages
    const systemMessages = window.messages.filter(m => m.role === 'system');
    const systemTokens = systemMessages.reduce((sum, msg) => sum + (msg.tokens || this.estimateTokens(msg.content)), 0);

    window.messages = systemMessages;
    window.currentTokens = systemTokens;
    window.updatedAt = new Date();

    this.logger.info(`Context window ${windowId} cleared (system messages preserved)`);
    return true;
  }

  /**
   * Export context window for storage or transfer
   */
  exportContextWindow(windowId: string): ContextWindow | undefined {
    const window = this.contextWindows.get(windowId);
    if (!window) return undefined;

    // Return a copy without internal references
    return { ...window, messages: [...window.messages] };
  }

  /**
   * Import context window from storage
   */
  importContextWindow(window: ContextWindow): void {
    // Validate the window
    if (!window.id || !window.userId || !window.sessionId) {
      throw new Error('Invalid context window format');
    }

    // Recalculate current tokens on import
    window.currentTokens = window.messages.reduce((sum, msg) => 
      sum + (msg.tokens || this.estimateTokens(msg.content)), 0
    );
    
    window.updatedAt = new Date();

    this.contextWindows.set(window.id, window);
    this.logger.info(`Context window imported: ${window.id}`);
  }

  /**
   * Get all context windows for a user
   */
  getUserContextWindows(userId: string): ContextWindow[] {
    return Array.from(this.contextWindows.values()).filter(w => w.userId === userId);
  }

  /**
   * Get strategy by name
   */
  getStrategy(name: string): ContextStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * Set the default compression strategy
   */
  setDefaultStrategy(strategyName: string): boolean {
    if (!this.strategies.has(strategyName)) {
      return false;
    }

    this.defaultStrategy = strategyName;
    return true;
  }

  /**
   * Get statistics about context management
   */
  getStats(): {
    totalWindows: number;
    totalMessages: number;
    averageTokensPerWindow: number;
    compressionCount: number;
    activeSessions: number;
  } {
    const windows = Array.from(this.contextWindows.values());
    const totalMessages = windows.reduce((sum, w) => sum + w.messages.length, 0);
    const activeSessions = new Set(windows.map(w => w.sessionId)).size;

    return {
      totalWindows: windows.length,
      totalMessages,
      averageTokensPerWindow: windows.length ? 
        windows.reduce((sum, w) => sum + w.currentTokens, 0) / windows.length : 0,
      compressionCount: 0, // Would need to track this separately
      activeSessions
    };
  }
}

// Context management utilities
export class ContextUtils {
  /**
   * Calculate the token usage of a conversation
   */
  static calculateTokenUsage(messages: ContextMessage[]): number {
    return messages.reduce((sum, msg) => sum + (msg.tokens || 0), 0);
  }

  /**
   * Find the most recent message of a specific role
   */
  static findLatestByRole(messages: ContextMessage[], role: string): ContextMessage | undefined {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === role) {
        return messages[i];
      }
    }
    return undefined;
  }

  /**
   * Extract action items from context messages
   */
  static extractActionItems(messages: ContextMessage[]): string[] {
    const actionItems: string[] = [];
    
    for (const msg of messages) {
      // Look for phrases that indicate action items
      const actionRegex = /(please\s+\w+|make\s+sure|don't\s+forget|remember\s+to|we\s+should|we\s+need\s+to|let's\s+\w+)/gi;
      const matches = msg.content.match(actionRegex);
      
      if (matches) {
        actionItems.push(...matches.map(m => m.trim()));
      }
    }
    
    return [...new Set(actionItems)]; // Remove duplicates
  }

  /**
   * Identify key topics in a conversation
   */
  static identifyTopics(messages: ContextMessage[], maxTopics: number = 5): string[] {
    // In a real implementation, this would use NLP techniques
    // For now, we'll extract noun phrases or frequently mentioned terms
    const allText = messages.map(m => m.content).join(' ');
    const words = allText.toLowerCase().match(/\b\w{4,}\b/g) || []; // Only words with 4+ chars
    
    // Count word frequency
    const wordCount: Record<string, number> = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
    
    // Sort by frequency and return top N
    return Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxTopics)
      .map(entry => entry[0]);
  }
}