/**
 * 🧠 ADVANCED FEATURE 1: Intelligent LLM Router with ML-Based Optimization
 * 
 * This system uses machine learning to automatically route requests to the best LLM
 * based on query type, performance history, and user preferences.
 */

interface QueryAnalysis {
  complexity: number;
  domain: 'technical' | 'creative' | 'analytical' | 'conversational';
  urgency: 'low' | 'medium' | 'high';
  expectedLength: 'short' | 'medium' | 'long';
  language: string;
}

interface ProviderPerformance {
  providerId: string;
  avgResponseTime: number;
  avgTokensPerSecond: number;
  qualityScore: number;
  successRate: number;
  domainExpertise: Record<string, number>;
  costPerToken: number;
}

interface RoutingDecision {
  primaryProvider: string;
  fallbackProvider: string;
  confidence: number;
  reasoning: string;
  estimatedCost: number;
  estimatedTime: number;
}

class IntelligentLLMRouter {
  private performanceHistory: Map<string, ProviderPerformance[]> = new Map();
  private queryPatterns: Map<string, QueryAnalysis[]> = new Map();
  private userPreferences: Map<string, any> = new Map();

  constructor() {
    this.initializeDefaultMetrics();
  }

  /**
   * Analyze query characteristics using lightweight NLP techniques
   */
  private analyzeQuery(prompt: string, context?: string): QueryAnalysis {
    const wordCount = prompt.split(' ').length;
    const hasCodePatterns = /```|`|function|class|def |import |const |let |var /.test(prompt);
    const hasCreativePatterns = /story|poem|creative|imagine|write about|describe/.test(prompt.toLowerCase());
    const hasAnalyticalPatterns = /analyze|compare|evaluate|explain|reason|logic/.test(prompt.toLowerCase());
    const hasUrgentPatterns = /urgent|asap|quickly|immediately|fast/.test(prompt.toLowerCase());

    // Determine domain
    let domain: QueryAnalysis['domain'] = 'conversational';
    if (hasCodePatterns) domain = 'technical';
    else if (hasCreativePatterns) domain = 'creative';
    else if (hasAnalyticalPatterns) domain = 'analytical';

    // Calculate complexity based on various factors
    const complexity = Math.min(1.0, 
      (wordCount / 100) * 0.3 + 
      (hasCodePatterns ? 0.4 : 0) + 
      (hasAnalyticalPatterns ? 0.3 : 0)
    );

    return {
      complexity,
      domain,
      urgency: hasUrgentPatterns ? 'high' : wordCount > 200 ? 'low' : 'medium',
      expectedLength: wordCount < 50 ? 'short' : wordCount < 200 ? 'medium' : 'long',
      language: this.detectLanguage(prompt)
    };
  }

  /**
   * Simple language detection based on character patterns
   */
  private detectLanguage(text: string): string {
    const hasNonLatin = /[^\x00-\x7F]/.test(text);
    const hasChinese = /[\u4e00-\u9fff]/.test(text);
    const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff]/.test(text);
    const hasKorean = /[\uac00-\ud7af]/.test(text);
    const hasArabic = /[\u0600-\u06ff]/.test(text);

    if (hasChinese) return 'zh';
    if (hasJapanese) return 'ja';
    if (hasKorean) return 'ko';
    if (hasArabic) return 'ar';
    if (hasNonLatin) return 'other';
    return 'en';
  }

  /**
   * Machine learning-inspired scoring function for provider selection
   */
  private calculateProviderScore(
    provider: ProviderPerformance, 
    analysis: QueryAnalysis,
    userPrefs: any = {}
  ): number {
    let score = 0;

    // Base performance metrics (40% weight)
    score += provider.qualityScore * 0.2;
    score += provider.successRate * 0.1;
    score += (1 / Math.max(provider.avgResponseTime, 0.1)) * 0.1;

    // Domain expertise (30% weight)
    const domainScore = provider.domainExpertise[analysis.domain] || 0.5;
    score += domainScore * 0.3;

    // Complexity handling (20% weight)
    const complexityFit = analysis.complexity < 0.5 ? 
      1 - Math.abs(0.3 - analysis.complexity) : 
      1 - Math.abs(0.8 - analysis.complexity);
    score += complexityFit * 0.2;

    // User preferences (10% weight)
    if (userPrefs.preferredProviders?.includes(provider.providerId)) {
      score += 0.1;
    }
    if (userPrefs.prioritizeCost && provider.costPerToken < 0.001) {
      score += 0.05;
    }
    if (userPrefs.prioritizeSpeed && provider.avgResponseTime < 2000) {
      score += 0.05;
    }

    return Math.min(1.0, score);
  }

  /**
   * Main routing function that selects the optimal LLM provider
   */
  async routeQuery(
    prompt: string, 
    availableProviders: string[],
    userId?: string,
    context?: string
  ): Promise<RoutingDecision> {
    const analysis = this.analyzeQuery(prompt, context);
    const userPrefs = userId ? this.userPreferences.get(userId) || {} : {};
    
    // Get performance data for available providers
    const providerScores: Array<{provider: string, score: number, performance: ProviderPerformance}> = [];

    for (const providerId of availableProviders) {
      const performance = this.getProviderPerformance(providerId);
      const score = this.calculateProviderScore(performance, analysis, userPrefs);
      providerScores.push({ provider: providerId, score, performance });
    }

    // Sort by score (descending)
    providerScores.sort((a, b) => b.score - a.score);

    const primaryChoice = providerScores[0];
    const fallbackChoice = providerScores[1] || providerScores[0];

    return {
      primaryProvider: primaryChoice.provider,
      fallbackProvider: fallbackChoice.provider,
      confidence: primaryChoice.score,
      reasoning: this.generateReasoning(analysis, primaryChoice),
      estimatedCost: this.estimateCost(analysis, primaryChoice.performance),
      estimatedTime: primaryChoice.performance.avgResponseTime
    };
  }

  /**
   * Update provider performance based on actual results
   */
  updateProviderPerformance(
    providerId: string,
    responseTime: number,
    tokensGenerated: number,
    qualityFeedback: number,
    success: boolean
  ): void {
    const history = this.performanceHistory.get(providerId) || [];
    const current = this.getProviderPerformance(providerId);

    // Update with exponential moving average
    const alpha = 0.1; // Learning rate
    const newPerformance: ProviderPerformance = {
      ...current,
      avgResponseTime: current.avgResponseTime * (1 - alpha) + responseTime * alpha,
      avgTokensPerSecond: current.avgTokensPerSecond * (1 - alpha) + 
        (tokensGenerated / (responseTime / 1000)) * alpha,
      qualityScore: current.qualityScore * (1 - alpha) + qualityFeedback * alpha,
      successRate: current.successRate * (1 - alpha) + (success ? 1 : 0) * alpha
    };

    history.push(newPerformance);
    this.performanceHistory.set(providerId, history.slice(-100)); // Keep last 100 entries
  }

  /**
   * Learn from user feedback to improve routing decisions
   */
  learnFromFeedback(
    providerId: string,
    queryAnalysis: QueryAnalysis,
    userSatisfaction: number,
    actualCost: number,
    actualTime: number
  ): void {
    // Update domain expertise based on satisfaction
    const current = this.getProviderPerformance(providerId);
    const domainKey = queryAnalysis.domain;
    const currentExpertise = current.domainExpertise[domainKey] || 0.5;
    
    // Adjust expertise based on satisfaction (scale: 0-1)
    const learningRate = 0.05;
    const newExpertise = currentExpertise + (userSatisfaction - 0.5) * learningRate;
    current.domainExpertise[domainKey] = Math.max(0, Math.min(1, newExpertise));

    // Update cost accuracy
    current.costPerToken = current.costPerToken * 0.9 + (actualCost / 1000) * 0.1;
  }

  private getProviderPerformance(providerId: string): ProviderPerformance {
    const history = this.performanceHistory.get(providerId);
    if (history && history.length > 0) {
      return history[history.length - 1];
    }
    
    // Return default metrics for new providers
    return this.getDefaultProviderMetrics(providerId);
  }

  private getDefaultProviderMetrics(providerId: string): ProviderPerformance {
    const defaults: Record<string, Partial<ProviderPerformance>> = {
      'openai': {
        avgResponseTime: 2000,
        avgTokensPerSecond: 50,
        qualityScore: 0.85,
        successRate: 0.95,
        costPerToken: 0.0001,
        domainExpertise: { technical: 0.9, creative: 0.8, analytical: 0.85, conversational: 0.8 }
      },
      'claude': {
        avgResponseTime: 2500,
        avgTokensPerSecond: 45,
        qualityScore: 0.88,
        successRate: 0.93,
        costPerToken: 0.00015,
        domainExpertise: { technical: 0.85, creative: 0.9, analytical: 0.9, conversational: 0.85 }
      },
      'google': {
        avgResponseTime: 1800,
        avgTokensPerSecond: 55,
        qualityScore: 0.82,
        successRate: 0.92,
        costPerToken: 0.00008,
        domainExpertise: { technical: 0.88, creative: 0.75, analytical: 0.88, conversational: 0.8 }
      }
    };

    const base = defaults[providerId] || {};
    return {
      providerId,
      avgResponseTime: 2000,
      avgTokensPerSecond: 50,
      qualityScore: 0.8,
      successRate: 0.9,
      costPerToken: 0.0001,
      domainExpertise: { technical: 0.7, creative: 0.7, analytical: 0.7, conversational: 0.8 },
      ...base
    };
  }

  private generateReasoning(analysis: QueryAnalysis, choice: any): string {
    const reasons = [];
    
    if (choice.score > 0.8) {
      reasons.push(`High confidence match (${(choice.score * 100).toFixed(1)}%)`);
    }
    
    reasons.push(`Optimized for ${analysis.domain} queries`);
    
    if (analysis.urgency === 'high') {
      reasons.push('Prioritized for fast response time');
    }
    
    if (analysis.complexity > 0.7) {
      reasons.push('Selected for complex query handling');
    }

    return reasons.join(', ');
  }

  private estimateCost(analysis: QueryAnalysis, performance: ProviderPerformance): number {
    const baseTokens = analysis.expectedLength === 'short' ? 100 : 
                     analysis.expectedLength === 'medium' ? 300 : 600;
    const complexityMultiplier = 1 + analysis.complexity;
    const estimatedTokens = baseTokens * complexityMultiplier;
    
    return estimatedTokens * performance.costPerToken;
  }

  private initializeDefaultMetrics(): void {
    // Initialize with some baseline data for common providers
    const providers = ['openai', 'claude', 'google', 'llama', 'github', 'grok'];
    providers.forEach(provider => {
      this.performanceHistory.set(provider, [this.getDefaultProviderMetrics(provider)]);
    });
  }

  /**
   * Get analytics about routing decisions
   */
  getRoutingAnalytics(): any {
    const totalRequests = Array.from(this.performanceHistory.values())
      .reduce((sum, history) => sum + history.length, 0);
    
    const providerUsage = Array.from(this.performanceHistory.entries())
      .map(([provider, history]) => ({
        provider,
        requests: history.length,
        avgScore: history.reduce((sum, p) => sum + p.qualityScore, 0) / history.length,
        successRate: history.reduce((sum, p) => sum + p.successRate, 0) / history.length
      }));

    return {
      totalRequests,
      providerUsage,
      optimizationLevel: this.calculateOptimizationLevel()
    };
  }

  private calculateOptimizationLevel(): number {
    // Calculate how well the system is learning (0-1 scale)
    const histories = Array.from(this.performanceHistory.values());
    if (histories.length === 0) return 0;

    const avgHistoryLength = histories.reduce((sum, h) => sum + h.length, 0) / histories.length;
    return Math.min(1, avgHistoryLength / 50); // Fully optimized after 50 data points per provider
  }
}

// Export singleton instance
export const intelligentRouter = new IntelligentLLMRouter();
export type { QueryAnalysis, ProviderPerformance, RoutingDecision };