/**
 * 🎛️ ADVANCED FEATURE 4: Adaptive Context Window Manager
 * 
 * Intelligent system that dynamically manages context windows across conversations
 * for optimal performance and cost efficiency.
 */

interface ContextChunk {
  id: string;
  content: string;
  timestamp: Date;
  type: 'user_message' | 'assistant_response' | 'system_message' | 'context_injection';
  importance: number; // 0-1 score
  tokenCount: number;
  metadata: {
    messageId?: string;
    userId?: string;
    providerId?: string;
    embedding?: number[]; // For semantic similarity
    keywords?: string[];
    sentiment?: 'positive' | 'negative' | 'neutral';
  };
}

interface ContextWindow {
  id: string;
  providerId: string;
  maxTokens: number;
  currentTokens: number;
  chunks: ContextChunk[];
  lastUpdated: Date;
  optimizationStrategy: 'recency' | 'importance' | 'semantic' | 'hybrid';
}

interface ContextOptimizationResult {
  originalTokens: number;
  optimizedTokens: number;
  compressionRatio: number;
  removedChunks: ContextChunk[];
  retainedChunks: ContextChunk[];
  strategy: string;
  reasoning: string;
}

interface ConversationSummary {
  id: string;
  summary: string;
  keyPoints: string[];
  tokenCount: number;
  originalChunkIds: string[];
  createdAt: Date;
  importance: number;
}

class AdaptiveContextManager {
  private contexts: Map<string, ContextWindow> = new Map();
  private summaries: Map<string, ConversationSummary> = new Map();
  private providerLimits: Map<string, number> = new Map();
  private embeddingCache: Map<string, number[]> = new Map();
  private keywordExtractor: KeywordExtractor;

  constructor() {
    this.initializeProviderLimits();
    this.keywordExtractor = new KeywordExtractor();
  }

  /**
   * Create a new context window for a provider
   */
  createContextWindow(
    conversationId: string,
    providerId: string,
    strategy: ContextWindow['optimizationStrategy'] = 'hybrid'
  ): string {
    const contextId = `ctx_${conversationId}_${providerId}`;
    const maxTokens = this.getProviderLimit(providerId);

    const context: ContextWindow = {
      id: contextId,
      providerId,
      maxTokens,
      currentTokens: 0,
      chunks: [],
      lastUpdated: new Date(),
      optimizationStrategy: strategy
    };

    this.contexts.set(contextId, context);
    return contextId;
  }

  /**
   * Add content to a context window with intelligent management
   */
  async addToContext(
    contextId: string,
    content: string,
    type: ContextChunk['type'],
    metadata: Partial<ContextChunk['metadata']> = {}
  ): Promise<ContextOptimizationResult | null> {
    const context = this.contexts.get(contextId);
    if (!context) return null;

    // Create new chunk
    const chunk: ContextChunk = {
      id: this.generateChunkId(),
      content,
      timestamp: new Date(),
      type,
      importance: await this.calculateImportance(content, type, context),
      tokenCount: this.estimateTokens(content),
      metadata: {
        ...metadata,
        embedding: await this.getEmbedding(content),
        keywords: this.keywordExtractor.extract(content),
        sentiment: this.analyzeSentiment(content)
      }
    };

    // Add chunk to context
    context.chunks.push(chunk);
    context.currentTokens += chunk.tokenCount;
    context.lastUpdated = new Date();

    // Check if optimization is needed
    if (context.currentTokens > context.maxTokens * 0.8) {
      return await this.optimizeContext(contextId);
    }

    this.contexts.set(contextId, context);
    return null;
  }

  /**
   * Optimize context window when approaching limits
   */
  async optimizeContext(contextId: string): Promise<ContextOptimizationResult> {
    const context = this.contexts.get(contextId);
    if (!context) throw new Error('Context not found');

    const originalTokens = context.currentTokens;
    const targetTokens = Math.floor(context.maxTokens * 0.6); // Aim for 60% capacity

    let optimizedChunks: ContextChunk[];
    let strategy: string;

    switch (context.optimizationStrategy) {
      case 'recency':
        optimizedChunks = this.optimizeByRecency(context.chunks, targetTokens);
        strategy = 'Retained most recent messages';
        break;
      
      case 'importance':
        optimizedChunks = this.optimizeByImportance(context.chunks, targetTokens);
        strategy = 'Retained highest importance messages';
        break;
      
      case 'semantic':
        optimizedChunks = await this.optimizeBySemantic(context.chunks, targetTokens);
        strategy = 'Retained semantically relevant messages';
        break;
      
      case 'hybrid':
      default:
        optimizedChunks = await this.optimizeHybrid(context.chunks, targetTokens);
        strategy = 'Applied hybrid optimization (recency + importance + semantic)';
        break;
    }

    // Create summaries for removed chunks if beneficial
    const removedChunks = context.chunks.filter(chunk => 
      !optimizedChunks.find(opt => opt.id === chunk.id)
    );

    if (removedChunks.length > 3) {
      await this.createSummaryForChunks(contextId, removedChunks);
    }

    // Update context
    context.chunks = optimizedChunks;
    context.currentTokens = optimizedChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
    context.lastUpdated = new Date();

    this.contexts.set(contextId, context);

    return {
      originalTokens,
      optimizedTokens: context.currentTokens,
      compressionRatio: context.currentTokens / originalTokens,
      removedChunks,
      retainedChunks: optimizedChunks,
      strategy,
      reasoning: this.generateOptimizationReasoning(originalTokens, context.currentTokens, strategy)
    };
  }

  /**
   * Get optimized context for LLM request
   */
  getOptimizedContext(
    contextId: string,
    maxTokensForRequest?: number
  ): { content: string; tokenCount: number; usedSummaries: ConversationSummary[] } {
    const context = this.contexts.get(contextId);
    if (!context) return { content: '', tokenCount: 0, usedSummaries: [] };

    const availableTokens = maxTokensForRequest || Math.floor(context.maxTokens * 0.9);
    let currentTokens = 0;
    let content = '';
    const usedSummaries: ConversationSummary[] = [];

    // First, include any relevant summaries
    const relevantSummaries = Array.from(this.summaries.values())
      .filter(summary => summary.id.startsWith(contextId.split('_')[1])) // Same conversation
      .sort((a, b) => b.importance - a.importance);

    for (const summary of relevantSummaries) {
      if (currentTokens + summary.tokenCount <= availableTokens * 0.2) { // Max 20% for summaries
        content += `[SUMMARY] ${summary.summary}\n\n`;
        currentTokens += summary.tokenCount;
        usedSummaries.push(summary);
      }
    }

    // Then include chunks in order of importance/recency
    const sortedChunks = this.sortChunksForContext(context.chunks, context.optimizationStrategy);
    
    for (const chunk of sortedChunks) {
      if (currentTokens + chunk.tokenCount <= availableTokens) {
        content += this.formatChunkForContext(chunk) + '\n\n';
        currentTokens += chunk.tokenCount;
      } else {
        break;
      }
    }

    return { content: content.trim(), tokenCount: currentTokens, usedSummaries };
  }

  /**
   * Analyze context efficiency and provide insights
   */
  analyzeContextEfficiency(contextId: string): {
    efficiency: number;
    insights: string[];
    recommendations: string[];
    stats: {
      totalChunks: number;
      averageImportance: number;
      tokenUtilization: number;
      oldestChunk: Date;
      newestChunk: Date;
    };
  } {
    const context = this.contexts.get(contextId);
    if (!context) throw new Error('Context not found');

    const insights: string[] = [];
    const recommendations: string[] = [];

    // Calculate statistics
    const totalChunks = context.chunks.length;
    const averageImportance = totalChunks > 0 ? 
      context.chunks.reduce((sum, chunk) => sum + chunk.importance, 0) / totalChunks : 0;
    const tokenUtilization = context.currentTokens / context.maxTokens;
    
    const timestamps = context.chunks.map(chunk => chunk.timestamp);
    const oldestChunk = timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : new Date();
    const newestChunk = timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : new Date();

    // Calculate efficiency score
    let efficiency = 0.5; // Base score
    
    // Factor in token utilization (sweet spot around 60-80%)
    if (tokenUtilization >= 0.6 && tokenUtilization <= 0.8) {
      efficiency += 0.2;
    } else if (tokenUtilization > 0.8) {
      efficiency -= 0.1;
      insights.push('Context is nearly full, may need frequent optimization');
      recommendations.push('Consider more aggressive optimization strategy');
    }

    // Factor in average importance
    efficiency += averageImportance * 0.3;
    
    if (averageImportance < 0.5) {
      insights.push('Many low-importance chunks in context');
      recommendations.push('Consider raising importance threshold for chunk retention');
    }

    // Factor in chunk distribution
    const typeDistribution = this.calculateTypeDistribution(context.chunks);
    if (typeDistribution.user_message < 0.3) {
      insights.push('Low ratio of user messages to other content');
      recommendations.push('Ensure user messages are prioritized in optimization');
    }

    // Factor in age distribution
    const averageAge = this.calculateAverageAge(context.chunks);
    if (averageAge > 24 * 60 * 60 * 1000) { // 24 hours
      insights.push('Context contains old chunks that may be less relevant');
      recommendations.push('Consider implementing time-based decay for chunk importance');
    }

    return {
      efficiency: Math.max(0, Math.min(1, efficiency)),
      insights,
      recommendations,
      stats: {
        totalChunks,
        averageImportance,
        tokenUtilization,
        oldestChunk,
        newestChunk
      }
    };
  }

  /**
   * Predict context usage patterns and optimize proactively
   */
  predictAndOptimize(contextId: string): {
    prediction: 'low' | 'medium' | 'high';
    recommendedStrategy: ContextWindow['optimizationStrategy'];
    reasoning: string;
  } {
    const context = this.contexts.get(contextId);
    if (!context) throw new Error('Context not found');

    // Analyze usage patterns
    const recentActivity = this.analyzeRecentActivity(context);
    const contextGrowthRate = this.calculateGrowthRate(context);
    const messageTypes = this.analyzeMessageTypes(context);

    let prediction: 'low' | 'medium' | 'high';
    let recommendedStrategy: ContextWindow['optimizationStrategy'];
    let reasoning: string;

    // Predict usage based on patterns
    if (recentActivity.messagesPerHour > 10 && contextGrowthRate > 0.1) {
      prediction = 'high';
      recommendedStrategy = 'hybrid';
      reasoning = 'High activity detected, hybrid strategy recommended for balanced optimization';
    } else if (recentActivity.messagesPerHour > 3 || contextGrowthRate > 0.05) {
      prediction = 'medium';
      recommendedStrategy = messageTypes.technicalRatio > 0.7 ? 'importance' : 'semantic';
      reasoning = messageTypes.technicalRatio > 0.7 ? 
        'Technical conversation detected, importance-based optimization recommended' :
        'Regular conversation, semantic optimization recommended';
    } else {
      prediction = 'low';
      recommendedStrategy = 'recency';
      reasoning = 'Low activity, recency-based optimization sufficient';
    }

    // Update strategy if different from current
    if (context.optimizationStrategy !== recommendedStrategy) {
      context.optimizationStrategy = recommendedStrategy;
      this.contexts.set(contextId, context);
    }

    return { prediction, recommendedStrategy, reasoning };
  }

  // Private optimization methods
  private optimizeByRecency(chunks: ContextChunk[], targetTokens: number): ContextChunk[] {
    const sorted = [...chunks].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    let totalTokens = 0;
    const retained: ContextChunk[] = [];

    for (const chunk of sorted) {
      if (totalTokens + chunk.tokenCount <= targetTokens) {
        retained.push(chunk);
        totalTokens += chunk.tokenCount;
      } else {
        break;
      }
    }

    return retained;
  }

  private optimizeByImportance(chunks: ContextChunk[], targetTokens: number): ContextChunk[] {
    const sorted = [...chunks].sort((a, b) => b.importance - a.importance);
    
    let totalTokens = 0;
    const retained: ContextChunk[] = [];

    for (const chunk of sorted) {
      if (totalTokens + chunk.tokenCount <= targetTokens) {
        retained.push(chunk);
        totalTokens += chunk.tokenCount;
      } else {
        break;
      }
    }

    return retained;
  }

  private async optimizeBySemantic(chunks: ContextChunk[], targetTokens: number): Promise<ContextChunk[]> {
    // Get the most recent user message as context for relevance
    const recentUserMessage = chunks
      .filter(chunk => chunk.type === 'user_message')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    if (!recentUserMessage || !recentUserMessage.metadata.embedding) {
      return this.optimizeByRecency(chunks, targetTokens);
    }

    // Calculate semantic similarity to recent message
    const chunksWithSimilarity = chunks.map(chunk => ({
      chunk,
      similarity: chunk.metadata.embedding ? 
        this.calculateCosineSimilarity(recentUserMessage.metadata.embedding, chunk.metadata.embedding) : 0
    }));

    // Sort by semantic similarity
    chunksWithSimilarity.sort((a, b) => b.similarity - a.similarity);

    let totalTokens = 0;
    const retained: ContextChunk[] = [];

    for (const { chunk } of chunksWithSimilarity) {
      if (totalTokens + chunk.tokenCount <= targetTokens) {
        retained.push(chunk);
        totalTokens += chunk.tokenCount;
      } else {
        break;
      }
    }

    return retained;
  }

  private async optimizeHybrid(chunks: ContextChunk[], targetTokens: number): Promise<ContextChunk[]> {
    // Calculate composite scores combining recency, importance, and semantic relevance
    const now = Date.now();
    const maxAge = Math.max(...chunks.map(chunk => now - chunk.timestamp.getTime()));

    const recentUserMessage = chunks
      .filter(chunk => chunk.type === 'user_message')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    const chunksWithScores = chunks.map(chunk => {
      // Recency score (0-1, newer = higher)
      const age = now - chunk.timestamp.getTime();
      const recencyScore = maxAge > 0 ? 1 - (age / maxAge) : 1;

      // Importance score (already 0-1)
      const importanceScore = chunk.importance;

      // Semantic similarity score
      let semanticScore = 0.5; // Default
      if (recentUserMessage?.metadata.embedding && chunk.metadata.embedding) {
        semanticScore = this.calculateCosineSimilarity(
          recentUserMessage.metadata.embedding,
          chunk.metadata.embedding
        );
      }

      // Weighted composite score
      const compositeScore = (
        recencyScore * 0.3 +
        importanceScore * 0.4 +
        semanticScore * 0.3
      );

      return { chunk, score: compositeScore };
    });

    // Sort by composite score
    chunksWithScores.sort((a, b) => b.score - a.score);

    let totalTokens = 0;
    const retained: ContextChunk[] = [];

    for (const { chunk } of chunksWithScores) {
      if (totalTokens + chunk.tokenCount <= targetTokens) {
        retained.push(chunk);
        totalTokens += chunk.tokenCount;
      } else {
        break;
      }
    }

    return retained;
  }

  private async createSummaryForChunks(contextId: string, chunks: ContextChunk[]): Promise<void> {
    if (chunks.length === 0) return;

    // Group chunks by time periods for better summarization
    const sortedChunks = chunks.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const content = sortedChunks.map(chunk => this.formatChunkForContext(chunk)).join('\n\n');

    // Generate summary (this would use an LLM in practice)
    const summary = await this.generateSummary(content);
    const keyPoints = this.extractKeyPoints(content);

    const conversationSummary: ConversationSummary = {
      id: `summary_${contextId}_${Date.now()}`,
      summary,
      keyPoints,
      tokenCount: this.estimateTokens(summary),
      originalChunkIds: chunks.map(chunk => chunk.id),
      createdAt: new Date(),
      importance: this.calculateSummaryImportance(chunks)
    };

    this.summaries.set(conversationSummary.id, conversationSummary);
  }

  // Helper methods
  private async calculateImportance(
    content: string, 
    type: ContextChunk['type'], 
    context: ContextWindow
  ): Promise<number> {
    let importance = 0.5; // Base importance

    // Type-based importance
    switch (type) {
      case 'user_message':
        importance += 0.2;
        break;
      case 'assistant_response':
        importance += 0.1;
        break;
      case 'system_message':
        importance += 0.3;
        break;
      case 'context_injection':
        importance += 0.15;
        break;
    }

    // Content-based importance
    if (this.hasImportantKeywords(content)) importance += 0.2;
    if (this.hasQuestions(content)) importance += 0.15;
    if (this.hasCodeOrTechnical(content)) importance += 0.1;
    if (content.length > 500) importance += 0.05;

    // Context-based importance
    const sentiment = this.analyzeSentiment(content);
    if (sentiment === 'positive') importance += 0.05;
    else if (sentiment === 'negative') importance -= 0.05;

    return Math.max(0, Math.min(1, importance));
  }

  private async getEmbedding(content: string): Promise<number[]> {
    // In a real implementation, this would call an embedding service
    // For now, return a mock embedding based on content hash
    const hash = this.simpleHash(content);
    return Array.from({length: 384}, (_, i) => Math.sin(hash + i) * 0.5 + 0.5);
  }

  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0;

    const dotProduct = vec1.reduce((sum, a, i) => sum + a * vec2[i], 0);
    const magnitude1 = Math.sqrt(vec1.reduce((sum, a) => sum + a * a, 0));
    const magnitude2 = Math.sqrt(vec2.reduce((sum, a) => sum + a * a, 0));

    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    return dotProduct / (magnitude1 * magnitude2);
  }

  private estimateTokens(content: string): number {
    // Rough estimation: 1 token ≈ 0.75 words
    const wordCount = content.split(/\s+/).length;
    return Math.ceil(wordCount / 0.75);
  }

  private analyzeSentiment(content: string): 'positive' | 'negative' | 'neutral' {
    // Simple sentiment analysis
    const positiveWords = ['good', 'great', 'excellent', 'perfect', 'amazing', 'love', 'like'];
    const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'dislike', 'problem', 'error'];

    const words = content.toLowerCase().split(/\s+/);
    const positiveCount = words.filter(word => positiveWords.includes(word)).length;
    const negativeCount = words.filter(word => negativeWords.includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private formatChunkForContext(chunk: ContextChunk): string {
    const timestamp = chunk.timestamp.toISOString();
    const typePrefix = chunk.type === 'user_message' ? 'User:' :
                      chunk.type === 'assistant_response' ? 'Assistant:' :
                      chunk.type === 'system_message' ? 'System:' : 'Context:';
    
    return `[${timestamp}] ${typePrefix} ${chunk.content}`;
  }

  private sortChunksForContext(
    chunks: ContextChunk[], 
    strategy: ContextWindow['optimizationStrategy']
  ): ContextChunk[] {
    switch (strategy) {
      case 'recency':
        return chunks.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      case 'importance':
        return chunks.sort((a, b) => b.importance - a.importance);
      case 'semantic':
      case 'hybrid':
      default:
        // For semantic and hybrid, maintain chronological order but prioritize important chunks
        return chunks.sort((a, b) => {
          const importanceDiff = b.importance - a.importance;
          if (Math.abs(importanceDiff) > 0.2) return importanceDiff;
          return a.timestamp.getTime() - b.timestamp.getTime();
        });
    }
  }

  private generateOptimizationReasoning(
    originalTokens: number, 
    optimizedTokens: number, 
    strategy: string
  ): string {
    const reduction = originalTokens - optimizedTokens;
    const percentage = Math.round((reduction / originalTokens) * 100);
    
    return `${strategy}. Reduced context from ${originalTokens} to ${optimizedTokens} tokens (${percentage}% reduction), improving efficiency while preserving important information.`;
  }

  // Analysis methods
  private analyzeRecentActivity(context: ContextWindow): {
    messagesPerHour: number;
    lastMessageTime: Date;
  } {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentChunks = context.chunks.filter(chunk => chunk.timestamp > oneHourAgo);
    
    const lastMessage = context.chunks.length > 0 ? 
      context.chunks.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0] : null;

    return {
      messagesPerHour: recentChunks.length,
      lastMessageTime: lastMessage?.timestamp || new Date(0)
    };
  }

  private calculateGrowthRate(context: ContextWindow): number {
    if (context.chunks.length < 2) return 0;

    const sorted = context.chunks.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const timeSpan = sorted[sorted.length - 1].timestamp.getTime() - sorted[0].timestamp.getTime();
    
    if (timeSpan === 0) return 0;
    
    // Calculate tokens per hour
    const hoursSpan = timeSpan / (1000 * 60 * 60);
    return context.currentTokens / hoursSpan / context.maxTokens; // Normalized growth rate
  }

  private analyzeMessageTypes(context: ContextWindow): {
    technicalRatio: number;
    questionRatio: number;
    userRatio: number;
  } {
    const total = context.chunks.length;
    if (total === 0) return { technicalRatio: 0, questionRatio: 0, userRatio: 0 };

    const technical = context.chunks.filter(chunk => this.hasCodeOrTechnical(chunk.content)).length;
    const questions = context.chunks.filter(chunk => this.hasQuestions(chunk.content)).length;
    const userMessages = context.chunks.filter(chunk => chunk.type === 'user_message').length;

    return {
      technicalRatio: technical / total,
      questionRatio: questions / total,
      userRatio: userMessages / total
    };
  }

  private calculateTypeDistribution(chunks: ContextChunk[]): Record<string, number> {
    const total = chunks.length;
    if (total === 0) return {};

    const distribution: Record<string, number> = {};
    chunks.forEach(chunk => {
      distribution[chunk.type] = (distribution[chunk.type] || 0) + 1;
    });

    // Convert to ratios
    Object.keys(distribution).forEach(type => {
      distribution[type] /= total;
    });

    return distribution;
  }

  private calculateAverageAge(chunks: ContextChunk[]): number {
    if (chunks.length === 0) return 0;
    
    const now = Date.now();
    const totalAge = chunks.reduce((sum, chunk) => sum + (now - chunk.timestamp.getTime()), 0);
    return totalAge / chunks.length;
  }

  private hasImportantKeywords(content: string): boolean {
    const keywords = ['important', 'critical', 'urgent', 'required', 'must', 'need', 'error', 'problem'];
    return keywords.some(keyword => content.toLowerCase().includes(keyword));
  }

  private hasQuestions(content: string): boolean {
    return /[?]/.test(content) || /^(what|how|when|where|why|which|who)\b/i.test(content);
  }

  private hasCodeOrTechnical(content: string): boolean {
    return /```|`|function|class|def |import |const |let |var |<\/?\w+>/.test(content);
  }

  private initializeProviderLimits(): void {
    this.providerLimits.set('openai', 4000);
    this.providerLimits.set('claude', 8000);
    this.providerLimits.set('google', 4000);
    this.providerLimits.set('llama', 2000);
    this.providerLimits.set('github', 4000);
    this.providerLimits.set('grok', 4000);
  }

  private getProviderLimit(providerId: string): number {
    return this.providerLimits.get(providerId) || 4000;
  }

  private generateChunkId(): string {
    return `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  private async generateSummary(content: string): Promise<string> {
    // Mock summary generation - in practice, this would use an LLM
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const importantSentences = sentences.slice(0, Math.min(3, sentences.length));
    return `Summary: ${importantSentences.join('. ')}.`;
  }

  private extractKeyPoints(content: string): string[] {
    // Mock key point extraction
    const keywords = this.keywordExtractor.extract(content);
    return keywords.slice(0, 5);
  }

  private calculateSummaryImportance(chunks: ContextChunk[]): number {
    return chunks.reduce((sum, chunk) => sum + chunk.importance, 0) / chunks.length;
  }
}

// Simple keyword extractor
class KeywordExtractor {
  private stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'was', 'are', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'
  ]);

  extract(text: string): string[] {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !this.stopWords.has(word));

    // Count frequency
    const frequency: Record<string, number> = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    // Return top keywords
    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }
}

// Export singleton instance
export const contextManager = new AdaptiveContextManager();
export type { ContextChunk, ContextWindow, ContextOptimizationResult, ConversationSummary };