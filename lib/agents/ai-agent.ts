import { ILLMProvider } from '../../services/llm-providers/base-provider'
import { z } from 'zod'

export interface AgentCapability {
  name: string
  description: string
  inputSchema: z.ZodSchema
  outputSchema: z.ZodSchema
  execute: (input: any, context: AgentContext) => Promise<any>
}

export interface AgentContext {
  provider: ILLMProvider
  model: string
  conversationHistory: Array<{ role: string; content: string }>
  userId: string
  sessionId: string
}

export interface AgentConfig {
  id: string
  name: string
  description: string
  systemPrompt: string
  capabilities: AgentCapability[]
  tools: AgentTool[]
  memory: AgentMemory
  personality: AgentPersonality
}

export interface AgentTool {
  name: string
  description: string
  parameters: Record<string, any>
  execute: (params: any, context: AgentContext) => Promise<any>
}

export interface AgentMemory {
  shortTerm: Array<{ key: string; value: any; timestamp: Date }>
  longTerm: Array<{ key: string; value: any; importance: number; timestamp: Date }>
  episodic: Array<{ event: string; context: any; timestamp: Date }>
}

export interface AgentPersonality {
  traits: string[]
  communicationStyle: 'formal' | 'casual' | 'technical' | 'creative'
  responseLength: 'concise' | 'detailed' | 'comprehensive'
  expertise: string[]
  confidence: number // 0-1
}

export class AIAgent {
  private config: AgentConfig
  private context: AgentContext

  constructor(config: AgentConfig, context: AgentContext) {
    this.config = config
    this.context = context
  }

  async processMessage(message: string): Promise<string> {
    // Add to conversation history
    this.context.conversationHistory.push({
      role: 'user',
      content: message
    })

    // Check if any capabilities should be triggered
    const triggeredCapability = await this.detectCapability(message)
    
    let response: string
    if (triggeredCapability) {
      response = await this.executeCapability(triggeredCapability, message)
    } else {
      response = await this.generateResponse(message)
    }

    // Add to conversation history
    this.context.conversationHistory.push({
      role: 'assistant',
      content: response
    })

    // Update memory
    await this.updateMemory(message, response)

    return response
  }

  private async detectCapability(message: string): Promise<AgentCapability | null> {
    for (const capability of this.config.capabilities) {
      try {
        // Try to parse the message according to the capability's input schema
        const parsed = capability.inputSchema.parse(message)
        return capability
      } catch {
        continue
      }
    }
    return null
  }

  private async executeCapability(capability: AgentCapability, message: string): Promise<string> {
    try {
      const input = capability.inputSchema.parse(message)
      const result = await capability.execute(input, this.context)
      
      // Validate output
      const validatedOutput = capability.outputSchema.parse(result)
      
      return this.formatCapabilityResponse(validatedOutput, capability)
    } catch (error) {
      return `Error executing ${capability.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }

  private async generateResponse(message: string): Promise<string> {
    const messages = [
      {
        role: 'system',
        content: this.buildSystemPrompt()
      },
      ...this.context.conversationHistory
    ]

    const response = await this.context.provider.generateResponse(
      messages,
      this.context.model,
      {
        temperature: 0.7,
        maxTokens: 2000
      }
    )

    return response.content
  }

  private buildSystemPrompt(): string {
    const personality = this.config.personality
    const capabilities = this.config.capabilities.map(cap => `- ${cap.name}: ${cap.description}`).join('\n')
    const tools = this.config.tools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n')

    return `${this.config.systemPrompt}

Personality:
- Traits: ${personality.traits.join(', ')}
- Communication Style: ${personality.communicationStyle}
- Response Length: ${personality.responseLength}
- Expertise: ${personality.expertise.join(', ')}
- Confidence Level: ${personality.confidence}

Available Capabilities:
${capabilities}

Available Tools:
${tools}

Memory Context:
${this.getMemoryContext()}

Instructions:
1. Use your personality traits to shape your responses
2. Leverage your expertise in ${personality.expertise.join(', ')}
3. Use available capabilities and tools when appropriate
4. Maintain conversation context and memory
5. Respond with ${personality.responseLength} answers in a ${personality.communicationStyle} style`
  }

  private getMemoryContext(): string {
    const recentMemories = this.config.memory.shortTerm
      .slice(-5)
      .map(mem => `- ${mem.key}: ${JSON.stringify(mem.value)}`)
      .join('\n')
    
    return `Recent memories:\n${recentMemories}`
  }

  private formatCapabilityResponse(result: any, capability: AgentCapability): string {
    return `Capability "${capability.name}" executed successfully. Result: ${JSON.stringify(result, null, 2)}`
  }

  private async updateMemory(userMessage: string, assistantResponse: string): Promise<void> {
    // Add to short-term memory
    this.config.memory.shortTerm.push({
      key: 'last_interaction',
      value: {
        userMessage,
        assistantResponse,
        timestamp: new Date()
      },
      timestamp: new Date()
    })

    // Keep only last 10 short-term memories
    if (this.config.memory.shortTerm.length > 10) {
      this.config.memory.shortTerm = this.config.memory.shortTerm.slice(-10)
    }

    // Add to episodic memory
    this.config.memory.episodic.push({
      event: 'conversation',
      context: {
        userMessage,
        assistantResponse,
        sessionId: this.context.sessionId
      },
      timestamp: new Date()
    })

    // Keep only last 50 episodic memories
    if (this.config.memory.episodic.length > 50) {
      this.config.memory.episodic = this.config.memory.episodic.slice(-50)
    }
  }

  // Tool execution
  async useTool(toolName: string, parameters: any): Promise<any> {
    const tool = this.config.tools.find(t => t.name === toolName)
    if (!tool) {
      throw new Error(`Tool "${toolName}" not found`)
    }

    return await tool.execute(parameters, this.context)
  }

  // Memory management
  addToMemory(key: string, value: any, type: 'short' | 'long' = 'short'): void {
    const memory = type === 'short' ? this.config.memory.shortTerm : this.config.memory.longTerm
    
    memory.push({
      key,
      value,
      timestamp: new Date(),
      ...(type === 'long' ? { importance: 0.5 } : {})
    })
  }

  getMemory(key: string): any {
    const shortMemory = this.config.memory.shortTerm.find(mem => mem.key === key)
    if (shortMemory) return shortMemory.value

    const longMemory = this.config.memory.longTerm.find(mem => mem.key === key)
    if (longMemory) return longMemory.value

    return null
  }

  // Agent state export/import
  exportState(): AgentConfig {
    return JSON.parse(JSON.stringify(this.config))
  }

  static importState(state: AgentConfig): AIAgent {
    return new AIAgent(state, {} as AgentContext)
  }
}

// Predefined agent types
export const AGENT_TEMPLATES = {
  CODE_REVIEWER: {
    name: 'Code Reviewer',
    description: 'Expert in code analysis, optimization, and best practices',
    systemPrompt: 'You are an expert code reviewer with deep knowledge of multiple programming languages, frameworks, and best practices. You provide constructive feedback, suggest improvements, and help developers write better code.',
    personality: {
      traits: ['analytical', 'detail-oriented', 'constructive', 'knowledgeable'],
      communicationStyle: 'technical' as const,
      responseLength: 'detailed' as const,
      expertise: ['software engineering', 'code review', 'performance optimization', 'security'],
      confidence: 0.9
    }
  },
  CREATIVE_WRITER: {
    name: 'Creative Writer',
    description: 'Specializes in creative content generation and storytelling',
    systemPrompt: 'You are a creative writer with expertise in various forms of content creation, from technical documentation to creative storytelling. You help users craft compelling content tailored to their needs.',
    personality: {
      traits: ['imaginative', 'articulate', 'versatile', 'inspiring'],
      communicationStyle: 'creative' as const,
      responseLength: 'comprehensive' as const,
      expertise: ['writing', 'storytelling', 'content strategy', 'editing'],
      confidence: 0.8
    }
  },
  DATA_ANALYST: {
    name: 'Data Analyst',
    description: 'Expert in data analysis, visualization, and insights',
    systemPrompt: 'You are a data analyst with expertise in statistical analysis, data visualization, and deriving actionable insights from complex datasets. You help users understand their data and make data-driven decisions.',
    personality: {
      traits: ['analytical', 'methodical', 'insightful', 'precise'],
      communicationStyle: 'technical' as const,
      responseLength: 'detailed' as const,
      expertise: ['data analysis', 'statistics', 'visualization', 'machine learning'],
      confidence: 0.85
    }
  }
} as const