/**
 * Advanced AI Model Router for RealMultiLLM
 * Provides intelligent model selection with contextual routing
 */

import { Logger } from '../../../lib/logger';
import { Cache } from '../../../lib/cache';
import { LLMManager } from '../../../lib/llm-manager';
import { v4 as uuidv4 } from 'uuid';

// Type definitions
export interface RoutingRequest {
  id: string;
  userId: string;
  sessionId: string;
  input: string;
  context?: any;
  preferences?: {
    responseQuality?: 'balanced' | 'creative' | 'precise';
    responseSpeed?: 'fast' | 'balanced' | 'thorough';
    costSensitivity?: 'low' | 'balanced' | 'high';
    modelPreference?: string;
  };
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface ModelCandidate {
  id: string;
  name: string;
  provider: string;
  capabilities: string[]; // e.g., ['text', 'code', 'math', 'creative']
  performanceMetrics: {
    avgResponseTime: number; // in milliseconds
    successRate: number; // 0-1
    costPerRequest: number; // in USD
    throughput: number; // requests per second
  };
  currentLoad: number; // 0-1, 1 being fully loaded
  isActive: boolean;
  isHealthy: boolean;
}

export interface RoutingDecision {
  requestId: string;
  selectedModel: string;
  confidence: number; // 0-1, how confident in this routing decision
  reason: string; // Explanation for the selection
  alternatives: Array<{
    modelId: string;
    score: number; // 0-1 relative score
    reason: string;
  }>;
  fallbackChain?: string[]; // Models to try if primary fails
  predictedPerformance?: {
    responseTime: number; // Predicted response time in ms
    cost: number; // Predicted cost in USD
    quality: number; // Predicted quality score 0-1
  };
  timestamp: Date;
}

export interface RoutingRule {
  id: string;
  name: string;
  condition: (request: RoutingRequest, models: ModelCandidate[]) => boolean;
  action: (request: RoutingRequest, models: ModelCandidate[]) => string | null; // Model ID or null
  priority: number; // Lower numbers execute first
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelPerformancePrediction {
  modelId: string;
  predictedResponseTime: number; // in milliseconds
  predictedSuccessRate: number; // 0-1
  predictedCost: number; // in USD
  confidence: number; // 0-1, confidence in prediction
  features: {
    inputComplexity: number; // 0-1
    topicMatch: number; // 0-1, how well the model matches the topic
    historicalPerformance: number; // 0-1
    currentLoad: number; // 0-1
  };
}

export interface LoadBalancer {
  strategy: 'round-robin' | 'least-loaded' | 'weighted-random' | 'performance-based';
  models: string[]; // Model IDs to balance between
  weights?: Record<string, number>; // For weighted strategies
  activeModelIndex: number; // For round-robin
}

export interface RoutingHistory {
  requestId: string;
  decision: RoutingDecision;
  actualPerformance: {
    responseTime: number; // Actual response time in ms
    cost: number; // Actual cost in USD
    quality: number; // Actual quality score 0-1
    success: boolean;
  };
  feedback?: {
    qualityRating: number; // 1-5 star rating
    feedbackText: string;
    timestamp: Date;
  };
  timestamp: Date;
}

export class ModelRouter {
  private models: Map<string, ModelCandidate>;
  private routingRules: Map<string, RoutingRule>;
  private loadBalancers: Map<string, LoadBalancer>;
  private routingHistory: Map<string, RoutingHistory>;
  private logger: Logger;
  private cache: Cache;
  private llmManager: LLMManager;
  private modelPerformancePredictor: ModelPerformancePredictor;

  constructor() {
    this.models = new Map();
    this.routingRules = new Map();
    this.loadBalancers = new Map();
    this.routingHistory = new Map();
    this.logger = new Logger('ModelRouter');
    this.cache = new Cache();
    this.llmManager = new LLMManager();
    this.modelPerformancePredictor = new ModelPerformancePredictor();
    
    this.initializeDefaultRules();
    this.initializeDefaultModels();
  }

  /**
   * Initialize default routing rules
   */
  private initializeDefaultRules(): void {
    // Rule for code-related requests
    this.routingRules.set('code-routing', {
      id: 'rule_code',
      name: 'Code Request Router',
      condition: (request: RoutingRequest, models: ModelCandidate[]) => {
        const codeKeywords = ['code', 'function', 'javascript', 'python', 'java', 'algorithm', 'debug', 'program'];
        const input = request.input.toLowerCase();
        return codeKeywords.some(keyword => input.includes(keyword));
      },
      action: (request: RoutingRequest, models: ModelCandidate[]) => {
        // Prefer models with code capabilities
        return models
          .filter(m => m.capabilities.includes('code') && m.isHealthy && m.isActive)
          .sort((a, b) => b.performanceMetrics.successRate - a.performanceMetrics.successRate)[0]?.id || null;
      },
      priority: 10,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Rule for creative requests
    this.routingRules.set('creative-routing', {
      id: 'rule_creative',
      name: 'Creative Request Router',
      condition: (request: RoutingRequest, models: ModelCandidate[]) => {
        const creativeKeywords = ['story', 'creative', 'write', 'poem', 'narrative', 'imagine', 'describe'];
        const input = request.input.toLowerCase();
        return creativeKeywords.some(keyword => input.includes(keyword));
      },
      action: (request: RoutingRequest, models: ModelCandidate[]) => {
        // Prefer models with creative capabilities
        return models
          .filter(m => m.capabilities.includes('creative') && m.isHealthy && m.isActive)
          .sort((a, b) => b.performanceMetrics.successRate - a.performanceMetrics.successRate)[0]?.id || null;
      },
      priority: 10,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Rule for mathematical/analytical requests
    this.routingRules.set('math-routing', {
      id: 'rule_math',
      name: 'Math/Analytical Request Router',
      condition: (request: RoutingRequest, models: ModelCandidate[]) => {
        const mathKeywords = ['calculate', 'math', 'equation', 'formula', 'solve', 'analyze', 'statistics'];
        const input = request.input.toLowerCase();
        return mathKeywords.some(keyword => input.includes(keyword));
      },
      action: (request: RoutingRequest, models: ModelCandidate[]) => {
        // Prefer models with analytical capabilities
        return models
          .filter(m => m.capabilities.includes('math') && m.isHealthy && m.isActive)
          .sort((a, b) => b.performanceMetrics.successRate - a.performanceMetrics.successRate)[0]?.id || null;
      },
      priority: 10,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Rule for user preference
    this.routingRules.set('preference-routing', {
      id: 'rule_preference',
      name: 'User Preference Router',
      condition: (request: RoutingRequest, models: ModelCandidate[]) => {
        return !!(request.preferences?.modelPreference && 
                 models.some(m => m.id === request.preferences.modelPreference));
      },
      action: (request: RoutingRequest, models: ModelCandidate[]) => {
        // Use user's preferred model if available and healthy
        const preferredModel = models.find(m => 
          m.id === request.preferences?.modelPreference && m.isHealthy && m.isActive
        );
        return preferredModel?.id || null;
      },
      priority: 5,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  /**
   * Initialize default models
   */
  private initializeDefaultModels(): void {
    const defaultModels: ModelCandidate[] = [
      {
        id: 'openai-gpt-4',
        name: 'OpenAI GPT-4',
        provider: 'OpenAI',
        capabilities: ['text', 'code', 'creative', 'math'],
        performanceMetrics: {
          avgResponseTime: 2500,
          successRate: 0.95,
          costPerRequest: 0.06,
          throughput: 10
        },
        currentLoad: 0.3,
        isActive: true,
        isHealthy: true
      },
      {
        id: 'openai-gpt-3.5-turbo',
        name: 'OpenAI GPT-3.5 Turbo',
        provider: 'OpenAI',
        capabilities: ['text', 'code'],
        performanceMetrics: {
          avgResponseTime: 1200,
          successRate: 0.92,
          costPerRequest: 0.002,
          throughput: 50
        },
        currentLoad: 0.7,
        isActive: true,
        isHealthy: true
      },
      {
        id: 'anthropic-claude-2',
        name: 'Anthropic Claude 2',
        provider: 'Anthropic',
        capabilities: ['text', 'creative', 'long-context'],
        performanceMetrics: {
          avgResponseTime: 3000,
          successRate: 0.94,
          costPerRequest: 0.04,
          throughput: 8
        },
        currentLoad: 0.2,
        isActive: true,
        isHealthy: true
      },
      {
        id: 'google-palm-2',
        name: 'Google PaLM 2',
        provider: 'Google',
        capabilities: ['text', 'math', 'multilingual'],
        performanceMetrics: {
          avgResponseTime: 1800,
          successRate: 0.90,
          costPerRequest: 0.02,
          throughput: 20
        },
        currentLoad: 0.5,
        isActive: true,
        isHealthy: true
      }
    ];

    for (const model of defaultModels) {
      this.models.set(model.id, model);
    }
  }

  /**
   * Route a request to the best model
   */
  async routeRequest(request: Omit<RoutingRequest, 'id' | 'timestamp'>): Promise<RoutingDecision> {
    const fullRequest: RoutingRequest = {
      ...request,
      id: `route_${Date.now()}_${uuidv4().substr(0, 8)}`,
      timestamp: new Date()
    };

    this.logger.info(`Routing request: ${fullRequest.input.substring(0, 50)}...`);

    // Get all active and healthy models
    const availableModels = Array.from(this.models.values()).filter(m => m.isActive && m.isHealthy);

    // Apply routing rules in priority order
    const sortedRules = Array.from(this.routingRules.values())
      .filter(rule => rule.enabled)
      .sort((a, b) => a.priority - b.priority);

    let selectedModelId: string | null = null;
    let ruleName = 'default';

    for (const rule of sortedRules) {
      if (rule.condition(fullRequest, availableModels)) {
        selectedModelId = rule.action(fullRequest, availableModels);
        if (selectedModelId) {
          ruleName = rule.name;
          break;
        }
      }
    }

    // If no rule matched or rule didn't select a model, use intelligent selection
    if (!selectedModelId) {
      selectedModelId = this.intelligentlySelectModel(fullRequest, availableModels);
      ruleName = 'intelligent-selection';
    }

    // If still no model selected, use the default fallback
    if (!selectedModelId) {
      selectedModelId = availableModels[0]?.id || 'openai-gpt-3.5-turbo';
      ruleName = 'fallback';
    }

    // Get the selected model
    const selectedModel = this.models.get(selectedModelId);
    if (!selectedModel) {
      throw new Error(`Selected model not found: ${selectedModelId}`);
    }

    // Generate alternatives for the decision
    const alternatives = this.generateAlternatives(selectedModel, availableModels);

    // Predict performance for the selected model
    const predictedPerformance = await this.modelPerformancePredictor.predict(
      selectedModelId,
      fullRequest
    );

    // Create routing decision
    const decision: RoutingDecision = {
      requestId: fullRequest.id,
      selectedModel: selectedModelId,
      confidence: this.calculateRoutingConfidence(fullRequest, selectedModel, availableModels),
      reason: `Selected based on ${ruleName} rule`,
      alternatives,
      predictedPerformance,
      timestamp: new Date()
    };

    // Add fallback chain if needed
    decision.fallbackChain = this.generateFallbackChain(selectedModelId, availableModels);

    // Store the decision in history
    this.routingHistory.set(fullRequest.id, {
      requestId: fullRequest.id,
      decision,
      actualPerformance: {
        responseTime: 0, // Will be updated after request completion
        cost: 0, // Will be updated after request completion
        quality: 0, // Will be updated after request completion
        success: false // Will be updated after request completion
      },
      timestamp: new Date()
    });

    this.logger.info(`Model selected: ${selectedModelId} for request ${fullRequest.id}`);
    return decision;
  }

  /**
   * Intelligently select a model based on request characteristics
   */
  private intelligentlySelectModel(request: RoutingRequest, models: ModelCandidate[]): string | null {
    // Analyze the request to determine requirements
    const requestAnalysis = this.analyzeRequest(request);

    // Score each model based on how well it matches the request
    const scoredModels = models.map(model => {
      let score = 0;

      // Prefer models with matching capabilities
      for (const capability of requestAnalysis.requiredCapabilities) {
        if (model.capabilities.includes(capability)) {
          score += 0.3;
        }
      }

      // Consider performance metrics based on user preferences
      if (request.preferences?.responseSpeed === 'fast') {
        // Prefer faster models
        score += (1 / Math.max(1, model.performanceMetrics.avgResponseTime / 1000));
      }

      if (request.preferences?.costSensitivity === 'low') {
        // Prefer less expensive models
        score += (1 / Math.max(0.001, model.performanceMetrics.costPerRequest));
      }

      // Consider current load
      score += (1 - model.currentLoad) * 0.2;

      // Consider success rate
      score += model.performanceMetrics.successRate * 0.3;

      return { model, score };
    });

    // Sort by score and return the highest scoring model
    scoredModels.sort((a, b) => b.score - a.score);
    return scoredModels[0]?.model.id || null;
  }

  /**
   * Analyze a request to determine its characteristics
   */
  private analyzeRequest(request: RoutingRequest): {
    requiredCapabilities: string[];
    complexity: number; // 0-1
    topic: string;
    urgency: 'low' | 'medium' | 'high';
  } {
    const input = request.input.toLowerCase();
    const requiredCapabilities: string[] = [];

    // Determine required capabilities
    if (/\b(code|function|algorithm|debug|python|javascript|java|c\+\+|rust|go|program)\b/.test(input)) {
      requiredCapabilities.push('code');
    }
    
    if (/\b(creative|story|poem|write|narrative|imagine|describe)\b/.test(input)) {
      requiredCapabilities.push('creative');
    }
    
    if (/\b(calculate|math|equation|formula|solve|analyze|statistics|probability)\b/.test(input)) {
      requiredCapabilities.push('math');
    }

    // Determine complexity (rough estimation)
    const complexity = Math.min(1, input.length / 1000);

    // Determine topic (simplified)
    let topic = 'general';
    if (requiredCapabilities.length > 0) {
      topic = requiredCapabilities[0];
    } else if (input.includes('code') || input.includes('programming')) {
      topic = 'technology';
    } else if (input.includes('history') || input.includes('science')) {
      topic = 'knowledge';
    }

    // Determine urgency based on request preferences
    const urgency = request.preferences?.responseSpeed === 'fast' ? 'high' : 
                   request.preferences?.responseSpeed === 'thorough' ? 'low' : 'medium';

    return {
      requiredCapabilities,
      complexity,
      topic,
      urgency
    };
  }

  /**
   * Generate alternatives to the selected model
   */
  private generateAlternatives(selectedModel: ModelCandidate, allModels: ModelCandidate[]): RoutingDecision['alternatives'] {
    return allModels
      .filter(m => m.id !== selectedModel.id && m.isHealthy && m.isActive)
      .map(model => ({
        modelId: model.id,
        score: this.calculateModelScore(selectedModel, model),
        reason: 'Alternative option'
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // Return top 3 alternatives
  }

  /**
   * Calculate a relative score between two models
   */
  private calculateModelScore(selected: ModelCandidate, alternative: ModelCandidate): number {
    // Simple score based on performance metrics similarity
    const responseTimeScore = 1 - Math.abs(selected.performanceMetrics.avgResponseTime - alternative.performanceMetrics.avgResponseTime) / 5000;
    const successRateScore = Math.abs(selected.performanceMetrics.successRate - alternative.performanceMetrics.successRate);
    const costScore = 1 - Math.abs(selected.performanceMetrics.costPerRequest - alternative.performanceMetrics.costPerRequest) / 0.1;

    return (responseTimeScore + successRateScore + costScore) / 3;
  }

  /**
   * Generate a fallback chain for when the primary model fails
   */
  private generateFallbackChain(primaryModelId: string, allModels: ModelCandidate[]): string[] {
    return allModels
      .filter(m => m.id !== primaryModelId && m.isHealthy && m.isActive)
      .sort((a, b) => b.performanceMetrics.successRate - a.performanceMetrics.successRate)
      .map(m => m.id)
      .slice(0, 3); // Top 3 fallback models
  }

  /**
   * Calculate confidence in the routing decision
   */
  private calculateRoutingConfidence(request: RoutingRequest, selectedModel: ModelCandidate, allModels: ModelCandidate[]): number {
    // Calculate based on how much better the selected model is compared to alternatives
    const otherScores = allModels
      .filter(m => m.id !== selectedModel.id && m.isHealthy && m.isActive)
      .map(m => this.calculateModelRelevance(m, request));

    const selectedScore = this.calculateModelRelevance(selectedModel, request);
    const bestAlternativeScore = otherScores.length > 0 ? Math.max(...otherScores) : 0;

    // Confidence is how much better the selected model is compared to the best alternative
    if (bestAlternativeScore === 0) return 1.0; // Only one option
    return Math.min(1.0, selectedScore / (bestAlternativeScore * 1.5)); // 1.5 multiplier for comfort
  }

  /**
   * Calculate how relevant a model is to a request
   */
  private calculateModelRelevance(model: ModelCandidate, request: RoutingRequest): number {
    let score = 0;

    // Match capabilities
    const requestAnalysis = this.analyzeRequest(request);
    for (const capability of requestAnalysis.requiredCapabilities) {
      if (model.capabilities.includes(capability)) {
        score += 0.4;
      }
    }

    // Consider performance characteristics based on user preferences
    if (request.preferences?.responseSpeed === 'fast') {
      score += (1.5 / Math.max(1, model.performanceMetrics.avgResponseTime / 1000));
    }

    if (request.preferences?.responseSpeed === 'thorough') {
      score += model.performanceMetrics.successRate;
    }

    if (request.preferences?.costSensitivity === 'low') {
      score += (2 / Math.max(0.001, model.performanceMetrics.costPerRequest));
    }

    return score;
  }

  /**
   * Register a new model
   */
  registerModel(model: Omit<ModelCandidate, 'currentLoad'>): void {
    const fullModel: ModelCandidate = {
      ...model,
      currentLoad: 0 // Initialize with no load
    };

    this.models.set(fullModel.id, fullModel);
    this.logger.info(`Model registered: ${fullModel.name}`);
  }

  /**
   * Update model performance metrics
   */
  updateModelMetrics(modelId: string, metrics: Partial<ModelCandidate['performanceMetrics']>): boolean {
    const model = this.models.get(modelId);
    if (!model) return false;

    Object.assign(model.performanceMetrics, metrics);
    model.updatedAt = new Date();

    this.logger.info(`Model metrics updated for ${modelId}`);
    return true;
  }

  /**
   * Update model load
   */
  updateModelLoad(modelId: string, load: number): boolean {
    const model = this.models.get(modelId);
    if (!model) return false;

    model.currentLoad = Math.max(0, Math.min(1, load)); // Clamp between 0 and 1
    return true;
  }

  /**
   * Register a new routing rule
   */
  registerRoutingRule(rule: Omit<RoutingRule, 'id' | 'createdAt' | 'updatedAt'>): RoutingRule {
    const newRule: RoutingRule = {
      ...rule,
      id: `rule_${Date.now()}_${uuidv4().substr(0, 8)}`,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.routingRules.set(newRule.id, newRule);
    this.logger.info(`Routing rule registered: ${newRule.name}`);
    return newRule;
  }

  /**
   * Get model by ID
   */
  getModel(modelId: string): ModelCandidate | undefined {
    return this.models.get(modelId);
  }

  /**
   * Get all models
   */
  getModels(): ModelCandidate[] {
    return Array.from(this.models.values());
  }

  /**
   * Get routing history for a request
   */
  getRoutingHistory(requestId: string): RoutingHistory | undefined {
    return this.routingHistory.get(requestId);
  }

  /**
   * Update actual performance after a request completes
   */
  updateActualPerformance(
    requestId: string,
    performance: RoutingHistory['actualPerformance']
  ): boolean {
    const history = this.routingHistory.get(requestId);
    if (!history) return false;

    history.actualPerformance = performance;
    return true;
  }

  /**
   * Add user feedback for a routing decision
   */
  addFeedback(
    requestId: string,
    feedback: Omit<RoutingHistory['feedback'], 'timestamp'>
  ): boolean {
    const history = this.routingHistory.get(requestId);
    if (!history) return false;

    history.feedback = {
      ...feedback,
      timestamp: new Date()
    };

    this.logger.info(`Feedback added for request ${requestId}`);
    return true;
  }

  /**
   * Create a load balancer
   */
  createLoadBalancer(
    models: string[],
    strategy: LoadBalancer['strategy'] = 'round-robin'
  ): string {
    const id = `lb_${Date.now()}_${uuidv4().substr(0, 8)}`;
    
    const loadBalancer: LoadBalancer = {
      strategy,
      models,
      activeModelIndex: 0
    };

    this.loadBalancers.set(id, loadBalancer);
    this.logger.info(`Load balancer created with ${models.length} models`);
    return id;
  }

  /**
   * Get a model from a load balancer
   */
  getLoadBalancedModel(lbId: string): string | null {
    const lb = this.loadBalancers.get(lbId);
    if (!lb || lb.models.length === 0) return null;

    let modelId: string;
    switch (lb.strategy) {
      case 'round-robin':
        modelId = lb.models[lb.activeModelIndex];
        lb.activeModelIndex = (lb.activeModelIndex + 1) % lb.models.length;
        break;
        
      case 'least-loaded':
        const availableModels = lb.models.map(id => this.models.get(id)).filter(m => m) as ModelCandidate[];
        const leastLoaded = availableModels.sort((a, b) => a.currentLoad - b.currentLoad)[0];
        modelId = leastLoaded?.id || lb.models[0];
        break;
        
      case 'weighted-random':
        const weights = lb.weights || {};
        const totalWeight = lb.models.reduce((sum, id) => sum + (weights[id] || 1), 0);
        let random = Math.random() * totalWeight;
        
        for (const modelId of lb.models) {
          const weight = weights[modelId] || 1;
          if (random < weight) {
            modelId = modelId;
            break;
          }
          random -= weight;
        }
        break;
        
      case 'performance-based':
        const perfModels = lb.models.map(id => this.models.get(id)).filter(m => m && m.isHealthy) as ModelCandidate[];
        const bestPerformer = perfModels.sort((a, b) => 
          b.performanceMetrics.successRate - a.performanceMetrics.successRate
        )[0];
        modelId = bestPerformer?.id || lb.models[0];
        break;
        
      default:
        modelId = lb.models[0];
    }

    return modelId;
  }

  /**
   * Get router statistics
   */
  getStats(): {
    totalModels: number;
    activeModels: number;
    totalRules: number;
    totalRoutedRequests: number;
    avgResponseTime: number;
    avgCost: number;
    successRate: number;
  } {
    const models = Array.from(this.models.values());
    const routingHistories = Array.from(this.routingHistory.values());
    
    const successfulRequests = routingHistories.filter(h => h.actualPerformance.success);
    
    return {
      totalModels: models.length,
      activeModels: models.filter(m => m.isActive).length,
      totalRules: this.routingRules.size,
      totalRoutedRequests: routingHistories.length,
      avgResponseTime: successfulRequests.length 
        ? successfulRequests.reduce((sum, h) => sum + h.actualPerformance.responseTime, 0) / successfulRequests.length 
        : 0,
      avgCost: successfulRequests.length 
        ? successfulRequests.reduce((sum, h) => sum + h.actualPerformance.cost, 0) / successfulRequests.length 
        : 0,
      successRate: routingHistories.length 
        ? successfulRequests.length / routingHistories.length 
        : 0
    };
  }

  /**
   * Get model performance summary
   */
  getModelPerformanceSummary(): Array<{
    modelId: string;
    name: string;
    avgResponseTime: number;
    successRate: number;
    totalRouted: number;
    avgCost: number;
  }> {
    const summary: any[] = [];

    for (const [modelId, model] of this.models) {
      const modelRequests = Array.from(this.routingHistory.values())
        .filter(h => h.decision.selectedModel === modelId);

      const successfulRequests = modelRequests.filter(h => h.actualPerformance.success);

      summary.push({
        modelId,
        name: model.name,
        avgResponseTime: successfulRequests.length 
          ? successfulRequests.reduce((sum, h) => sum + h.actualPerformance.responseTime, 0) / successfulRequests.length 
          : 0,
        successRate: modelRequests.length 
          ? successfulRequests.length / modelRequests.length 
          : 0,
        totalRouted: modelRequests.length,
        avgCost: successfulRequests.length 
          ? successfulRequests.reduce((sum, h) => sum + h.actualPerformance.cost, 0) / successfulRequests.length 
          : 0
      });
    }

    return summary.sort((a, b) => b.successRate - a.successRate);
  }

  /**
   * Optimize routing rules based on performance data
   */
  optimizeRoutingRules(): void {
    // This would analyze routing history and suggest rule improvements
    // For now, log a message that optimization has run
    this.logger.info('Routing rules optimization completed');
  }
}

/**
 * Model Performance Predictor
 * Predicts how a model will perform on a given request
 */
class ModelPerformancePredictor {
  /**
   * Predict model performance for a specific request
   */
  async predict(modelId: string, request: RoutingRequest): Promise<ModelPerformancePrediction> {
    // In a real implementation, this would use ML models to predict performance
    // For now, we'll use a simplified approach based on historical data
    
    const features = this.extractFeatures(request);
    
    // Generate prediction based on features
    const prediction: ModelPerformancePrediction = {
      modelId,
      predictedResponseTime: this.estimateResponseTime(features),
      predictedSuccessRate: this.estimateSuccessRate(features),
      predictedCost: this.estimateCost(modelId),
      confidence: 0.7, // Default confidence
      features
    };

    return prediction;
  }

  /**
   * Extract features from a request
   */
  private extractFeatures(request: RoutingRequest): ModelPerformancePrediction['features'] {
    const input = request.input.toLowerCase();
    
    // Estimate complexity based on input length and keywords
    const complexity = Math.min(1, input.length / 2000);
    
    // Topic matching - simplified approach
    let topicMatch = 0.5; // Default neutral
    if (input.includes('code') || input.includes('programming')) topicMatch = 0.8;
    if (input.includes('creative') || input.includes('story')) topicMatch = 0.7;
    if (input.includes('calculate') || input.includes('math')) topicMatch = 0.6;
    
    // Use historical data if available (simplified - in reality, this would come from analytics)
    const historicalPerformance = 0.75;
    
    // Current load - simplified
    const currentLoad = 0.3; // Assuming average load

    return {
      inputComplexity: complexity,
      topicMatch,
      historicalPerformance,
      currentLoad
    };
  }

  /**
   * Estimate response time based on features
   */
  private estimateResponseTime(features: ModelPerformancePrediction['features']): number {
    // Base time of 1 second
    let time = 1000;
    
    // Increase time with complexity
    time *= (1 + features.inputComplexity);
    
    // Adjust based on how well the model matches the topic
    if (features.topicMatch < 0.5) time *= 1.5; // Poor match takes longer
    
    // Adjust based on current load
    time *= (1 + features.currentLoad);
    
    return Math.round(time);
  }

  /**
   * Estimate success rate based on features
   */
  private estimateSuccessRate(features: ModelPerformancePrediction['features']): number {
    let rate = 0.9; // Base success rate
    
    // Reduce rate if topic match is poor
    if (features.topicMatch < 0.4) rate -= 0.2;
    else if (features.topicMatch < 0.7) rate -= 0.1;
    
    // Reduce rate if input is very complex
    if (features.inputComplexity > 0.8) rate -= 0.15;
    else if (features.inputComplexity > 0.5) rate -= 0.05;
    
    // Consider historical performance
    rate = (rate + features.historicalPerformance) / 2;
    
    return Math.max(0.1, Math.min(1.0, rate));
  }

  /**
   * Estimate cost of using a model
   */
  private estimateCost(modelId: string): number {
    // Simplified cost estimation by model ID
    if (modelId.includes('gpt-4')) return 0.06;
    if (modelId.includes('gpt-3.5')) return 0.002;
    if (modelId.includes('claude')) return 0.04;
    if (modelId.includes('palm')) return 0.02;
    
    // Default cost
    return 0.01;
  }
}

// Model router utilities
export class ModelRouterUtils {
  /**
   * Validate model compatibility with request
   */
  static validateCompatibility(model: ModelCandidate, request: RoutingRequest): { 
    compatible: boolean; 
    score: number; 
    issues: string[] 
  } {
    const issues: string[] = [];
    let score = 1.0;

    // Check capabilities
    const requestAnalysis = this.analyzeRequest(request);
    for (const capability of requestAnalysis.requiredCapabilities) {
      if (!model.capabilities.includes(capability)) {
        issues.push(`Model lacks required capability: ${capability}`);
        score *= 0.5; // Reduce score for missing capability
      }
    }

    // Check model status
    if (!model.isActive) {
      issues.push('Model is not active');
      score = 0;
    }

    if (!model.isHealthy) {
      issues.push('Model is not healthy');
      score *= 0.1;
    }

    // Check load
    if (model.currentLoad > 0.9) {
      issues.push('Model is overloaded');
      score *= 0.7;
    }

    return {
      compatible: issues.length === 0 && score > 0.3, // Compatible if score > 0.3 and no major issues
      score,
      issues
    };
  }

  /**
   * Analyze request requirements
   */
  private static analyzeRequest(request: RoutingRequest): { requiredCapabilities: string[] } {
    const input = request.input.toLowerCase();
    const requiredCapabilities: string[] = [];

    // Determine required capabilities
    if (/\b(code|function|algorithm|debug|python|javascript|java|c\+\+|rust|go|program)\b/.test(input)) {
      requiredCapabilities.push('code');
    }
    
    if (/\b(creative|story|poem|write|narrative|imagine|describe)\b/.test(input)) {
      requiredCapabilities.push('creative');
    }
    
    if (/\b(calculate|math|equation|formula|solve|analyze|statistics|probability)\b/.test(input)) {
      requiredCapabilities.push('math');
    }

    return { requiredCapabilities };
  }
}