/**
 * Advanced AI Agent System for RealMultiLLM
 * Provides personality-driven AI agents with memory, capabilities, and tools
 */

import { LLMManager } from '../../../lib/llm-manager';
import { Logger } from '../../../lib/logger';
import { Cache } from '../../../lib/cache';

// Type definitions
export interface AgentCapability {
  name: string;
  description: string;
  execute: (input: any) => Promise<any>;
  constraints?: string[];
}

export interface AgentMemory {
  id: string;
  type: 'short-term' | 'long-term';
  content: string;
  timestamp: Date;
  metadata: Record<string, any>;
}

export interface AgentPersonality {
  name: string;
  role: string;
  characteristics: string[];
  communicationStyle: string;
  expertise: string[];
  constraints?: string[];
  examples?: string[];
}

export interface AgentContext {
  userId: string;
  sessionId: string;
  conversationHistory: any[];
  memory: Map<string, AgentMemory>;
  capabilities: AgentCapability[];
  personality: AgentPersonality;
  relationships: Map<string, any>;
  preferences: Record<string, any>;
}

export interface AgentConfig {
  maxMemorySize?: number;
  memoryCompressionThreshold?: number;
  contextWindow?: number;
  personality: AgentPersonality;
  capabilities?: AgentCapability[];
}

export interface AgentState {
  context: AgentContext;
  status: 'idle' | 'processing' | 'error';
  lastInteraction: Date;
  metrics: {
    interactions: number;
    memoryUsage: number;
    performance: number;
  };
}

export class AIAgent {
  private llmManager: LLMManager;
  private logger: Logger;
  private cache: Cache;
  private config: AgentConfig;
  private state: AgentState;

  constructor(config: AgentConfig) {
    this.config = {
      maxMemorySize: 100,
      memoryCompressionThreshold: 50,
      contextWindow: 4096,
      ...config
    };
    this.llmManager = new LLMManager();
    this.logger = new Logger({ service: 'AIAgent' });
    this.cache = new Cache();
    
    this.state = {
      context: {
        userId: '',
        sessionId: '',
        conversationHistory: [],
        memory: new Map(),
        capabilities: config.capabilities || [],
        personality: config.personality,
        relationships: new Map(),
        preferences: {}
      },
      status: 'idle',
      lastInteraction: new Date(),
      metrics: {
        interactions: 0,
        memoryUsage: 0,
        performance: 0
      }
    };
  }

  /**
   * Initialize the agent with user context
   */
  async initialize(userId: string, sessionId: string): Promise<void> {
    this.state.context.userId = userId;
    this.state.context.sessionId = sessionId;
    
    // Load any saved memory for this user
    await this.loadUserMemory(userId);
    
    this.logger.info(`Agent initialized for user ${userId} in session ${sessionId}`);
  }

  /**
   * Process a user input and generate a response
   */
  async processInput(input: string): Promise<string> {
    this.state.status = 'processing';
    this.state.lastInteraction = new Date();
    this.state.metrics.interactions++;

    try {
      // Add input to conversation history
      this.state.context.conversationHistory.push({
        role: 'user',
        content: input,
        timestamp: new Date()
      });

      // Check for and execute any relevant capabilities
      const capabilityResult = await this.executeRelevantCapabilities(input);
      if (capabilityResult) {
        this.state.context.conversationHistory.push({
          role: 'tool',
          content: capabilityResult,
          timestamp: new Date()
        });
      }

      // Retrieve relevant memories
      const relevantMemories = this.retrieveRelevantMemories(input);
      const memoryContext = this.formatMemoriesForContext(relevantMemories);

      // Retrieve relationship data
      const relationshipContext = this.getRelationshipContext(input);

      // Construct the full prompt with personality, memory, and context
      const prompt = this.constructPrompt(input, memoryContext, relationshipContext);

      const historyMessages: Message[] = this.state.context.conversationHistory
        .slice(-10)
        .map((entry) => {
          if (entry && typeof entry === 'object' && 'role' in entry && 'content' in entry) {
            return entry as Message;
          }
          return { role: 'user', content: String(entry) } as Message;
        });

      const messages: Message[] = [
        ...historyMessages,
        { role: 'user', content: prompt }
      ];

      // Generate response using LLM
      const response = await this.llmManager.complete(
        'openai',
        messages,
        {
          messages,
          userId: this.state.context.userId,
          model: this.state.context.personality.expertise.includes('code') ? 'openai/gpt-4' : 'openai/gpt-3.5-turbo'
        }
      );

      // Add response to conversation history
      this.state.context.conversationHistory.push({
        role: 'assistant',
        content: response,
        timestamp: new Date()
      });

      // Store response in memory
      await this.storeMemory({
        id: `response_${Date.now()}`,
        type: 'short-term',
        content: response,
        timestamp: new Date(),
        metadata: {
          input: input,
          source: 'response'
        }
      });

      // Update context window if needed
      await this.manageContextWindow();

      this.state.status = 'idle';
      return response;
    } catch (error) {
      this.state.status = 'error';
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error processing input', { input }, err);
      throw err;
    }
  }

  /**
   * Execute relevant capabilities based on input
   */
  private async executeRelevantCapabilities(input: string): Promise<string | null> {
    const relevantCapabilities = this.state.context.capabilities.filter(cap => 
      this.isCapabilityRelevant(cap, input)
    );

    if (relevantCapabilities.length === 0) {
      return null;
    }

    // Execute the most relevant capability
    const capability = relevantCapabilities[0];
    try {
      const result = await capability.execute(input);
      return JSON.stringify(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Error executing capability ${capability.name}`, undefined, err);
      return null;
    }
  }

  /**
   * Check if a capability is relevant to the input
   */
  private isCapabilityRelevant(capability: AgentCapability, input: string): boolean {
    // Simple keyword matching - in a real implementation, this could use semantic matching
    const keywords = [capability.name, ...capability.description.split(' ')].map(k => k.toLowerCase());
    const lowerInput = input.toLowerCase();
    return keywords.some(keyword => lowerInput.includes(keyword));
  }

  /**
   * Store memory with type and metadata
   */
  async storeMemory(memory: AgentMemory): Promise<void> {
    // Check if we need to compress memory
    if (this.state.context.memory.size >= this.config.maxMemorySize!) {
      await this.compressMemory();
    }

    this.state.context.memory.set(memory.id, memory);
    this.state.metrics.memoryUsage = this.state.context.memory.size;

    // Cache important memories
    if (memory.type === 'long-term') {
      await this.cache.set(
        `memory:${this.state.context.userId}:${memory.id}`,
        memory,
        CacheConfigs.long
      );
    }
  }

  /**
   * Retrieve relevant memories based on input
   */
  retrieveRelevantMemories(input: string): AgentMemory[] {
    // Simple semantic search - in a real implementation, this could use vector embeddings
    const relevantMemories: AgentMemory[] = [];
    const lowerInput = input.toLowerCase();

    for (const [_, memory] of this.state.context.memory) {
      if (memory.content.toLowerCase().includes(lowerInput)) {
        relevantMemories.push(memory);
      }
    }

    // Sort by recency and relevance
    return relevantMemories.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 5);
  }

  /**
   * Get relationship context for input
   */
  getRelationshipContext(input: string): string {
    // Simple relationship tracking - in a real implementation, this could be more sophisticated
    const entities = this.extractEntities(input);
    const relationships: string[] = [];

    for (const entity of entities) {
      if (this.state.context.relationships.has(entity)) {
        relationships.push(`${entity}: ${this.state.context.relationships.get(entity)}`);
      }
    }

    return relationships.join('; ');
  }

  /**
   * Extract entities from input
   */
  private extractEntities(input: string): string[] {
    // Simple entity extraction - in a real implementation, this could use NLP
    const entities: string[] = [];
    const entityRegex = /[A-Z][a-z]+/g;
    let match;
    while ((match = entityRegex.exec(input)) !== null) {
      entities.push(match[0]);
    }
    return entities;
  }

  /**
   * Format memories for context inclusion
   */
  private formatMemoriesForContext(memories: AgentMemory[]): string {
    return memories.map(m => `[${m.timestamp.toISOString()}] ${m.content}`).join('\n');
  }

  /**
   * Compress memory to stay within limits
   */
  private async compressMemory(): Promise<void> {
    // Convert to array and sort by timestamp (oldest first)
    const memories = Array.from(this.state.context.memory.entries())
      .map(([id, memory]) => ({ id, memory }))
      .sort((a, b) => a.memory.timestamp.getTime() - b.memory.timestamp.getTime());

    // Keep only the most recent memories
    const toRemove = memories.slice(0, Math.floor(memories.length * 0.3)); // Remove oldest 30%
    
    for (const { id } of toRemove) {
      this.state.context.memory.delete(id);
      await this.cache.delete(`memory:${this.state.context.userId}:${id}`);
    }

    // Create a summary of removed memories and store as a long-term memory
    const summary = toRemove.map(item => item.memory.content).join('\n');
    if (summary.length > 0) {
      await this.storeMemory({
        id: `summary_${Date.now()}`,
        type: 'long-term',
        content: `Memory summary: ${summary.substring(0, 500)}...`,
        timestamp: new Date(),
        metadata: {
          type: 'summary',
          originalCount: toRemove.length
        }
      });
    }

    this.logger.info(`Compressed memory, removed ${toRemove.length} items`);
  }

  /**
   * Manage context window to stay within limits
   */
  private async manageContextWindow(): Promise<void> {
    // Keep only the most recent conversation history
    if (this.state.context.conversationHistory.length > this.config.contextWindow!) {
      const toRemove = this.state.context.conversationHistory.length - this.config.contextWindow!;
      this.state.context.conversationHistory = this.state.context.conversationHistory.slice(toRemove);
    }
  }

  /**
   * Load user memory from cache
   */
  private async loadUserMemory(userId: string): Promise<void> {
    try {
      // Get all memory keys for this user
      const keys = await this.cache.keys(`memory:${userId}:*`);
      const memoryPromises = keys.map(key => this.cache.get(key));
      const memories = await Promise.all(memoryPromises);

      for (const [index, key] of keys.entries()) {
        const memory = memories[index] as AgentMemory;
        if (memory) {
          this.state.context.memory.set(key.split(':').pop()!, memory);
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error('Error loading user memory', undefined, err);
    }
  }

  /**
   * Construct the full prompt with personality, memory, and context
   */
  private constructPrompt(input: string, memoryContext: string, relationshipContext: string): string {
    const personality = this.state.context.personality;
    
    let prompt = `You are ${personality.name}, a ${personality.role} with the following characteristics: ${personality.characteristics.join(', ')}.\n`;
    prompt += `Your communication style is: ${personality.communicationStyle}.\n`;
    prompt += `Your expertise areas include: ${personality.expertise.join(', ')}.\n`;
    
    if (personality.constraints) {
      prompt += `You must follow these constraints: ${personality.constraints.join(', ')}.\n`;
    }
    
    if (personality.examples && personality.examples.length > 0) {
      prompt += `Here are examples of how you should respond: ${personality.examples.join(' ')}.\n`;
    }

    if (memoryContext) {
      prompt += `\nRelevant memories from previous conversations:\n${memoryContext}\n`;
    }

    if (relationshipContext) {
      prompt += `\nRelationship context: ${relationshipContext}\n`;
    }

    prompt += `\nUser input: ${input}\n`;
    prompt += `Assistant response:`;

    return prompt;
  }

  /**
   * Update agent preferences
   */
  updatePreferences(preferences: Record<string, any>): void {
    this.state.context.preferences = { ...this.state.context.preferences, ...preferences };
  }

  /**
   * Get agent state for monitoring
   */
  getState(): AgentState {
    return { ...this.state };
  }

  /**
   * Add a relationship to the agent's knowledge
   */
  addRelationship(entity: string, relationship: any): void {
    this.state.context.relationships.set(entity, relationship);
  }

  /**
   * Add a capability to the agent
   */
  addCapability(capability: AgentCapability): void {
    this.state.context.capabilities.push(capability);
  }
}

// Predefined agent personalities
export const AGENT_PERSONALITIES = {
  CODE_REVIEWER: {
    name: 'Code Reviewer Pro',
    role: 'Senior Software Developer',
    characteristics: ['analytical', 'detail-oriented', 'constructive'],
    communicationStyle: 'professional and educational',
    expertise: ['code review', 'software engineering', 'best practices'],
    constraints: ['provide specific suggestions', 'explain reasoning', 'be respectful'],
    examples: [
      'Instead of using a for loop here, consider using the map function for better readability.',
      'This function has a cyclomatic complexity of 8. Consider breaking it into smaller functions.'
    ]
  } as AgentPersonality,

  CREATIVE_WRITER: {
    name: 'Creative Muse',
    role: 'Creative Writing Assistant',
    characteristics: ['imaginative', 'inspirational', 'versatile'],
    communicationStyle: 'encouraging and creative',
    expertise: ['creative writing', 'storytelling', 'poetry', 'character development'],
    constraints: ['maintain originality', 'avoid clichés', 'support creative expression'],
    examples: [
      'Consider exploring the internal conflict of your protagonist to add depth to the narrative.',
      'The metaphor you used here beautifully captures the character\'s emotional state.'
    ]
  } as AgentPersonality,

  DATA_ANALYST: {
    name: 'Data Insights Pro',
    role: 'Senior Data Analyst',
    characteristics: ['analytical', 'methodical', 'insightful'],
    communicationStyle: 'data-driven and clear',
    expertise: ['data analysis', 'statistics', 'visualization', 'business intelligence'],
    constraints: ['provide evidence-based insights', 'explain statistical significance', 'offer actionable recommendations'],
    examples: [
      'The correlation coefficient of 0.75 suggests a strong positive relationship between these variables.',
      'Based on the trend analysis, we can expect a 15% increase in the next quarter.'
    ]
  } as AgentPersonality
};

// Capability implementations
export const AGENT_CAPABILITIES = {
  WEB_SEARCH: (searchFn: (query: string) => Promise<any>): AgentCapability => ({
    name: 'web_search',
    description: 'Search the web for current information',
    execute: async (input: string) => {
      return await searchFn(input);
    },
    constraints: ['only search for factual, current information']
  }),

  CALCULATION: {
    name: 'calculator',
    description: 'Perform mathematical calculations',
    execute: async (input: string) => {
      // Simple calculation capability - in a real implementation, this would be more robust and safe
      const expression = input.match(/[\d\+\-\*\/\(\)\.]+/)?.[0] || '';
      if (expression) {
        // Note: In a real implementation, use a safe math evaluation library
        // This is just a simplified example
        try {
          // eslint-disable-next-line no-eval
          const result = eval(expression);
          return { result, expression };
        } catch (error) {
          return { error: 'Invalid expression' };
        }
      }
      return { error: 'No mathematical expression found' };
    },
    constraints: ['only perform safe mathematical operations']
  } as AgentCapability,

  CALENDAR: (calendarFn: (query: string) => Promise<any>): AgentCapability => ({
    name: 'calendar',
    description: 'Access calendar information and scheduling',
    execute: async (input: string) => {
      return await calendarFn(input);
    },
    constraints: ['only access calendar with user permission']
  })
};
