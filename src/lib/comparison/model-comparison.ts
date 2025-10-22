/**
 * Advanced Model Comparison Engine for RealMultiLLM
 * Provides statistical analysis of model performance with significance testing
 */

import { Logger } from '../../lib/logger';
import { LLMManager } from '../../lib/llm-manager';
import { Cache } from '../../lib/cache';

// Type definitions
export interface ComparisonTest {
  id: string;
  name: string;
  description: string;
  models: string[]; // List of model identifiers to compare
  testCases: TestCase[];
  metrics: EvaluationMetric[];
  statisticalTest?: StatisticalTest;
  baselineModel: string; // Model to compare against
  createdAt: Date;
  createdBy: string;
  status: 'draft' | 'running' | 'completed' | 'cancelled';
}

export interface TestCase {
  id: string;
  input: string;
  expectedOutput?: string;
  context?: any;
  category: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  priority?: number;
}

export interface ModelResult {
  modelId: string;
  testCaseId: string;
  output: string;
  latency: number; // in milliseconds
  tokenUsage: {
    input: number;
    output: number;
    total: number;
  };
  cost: number; // in USD
  metrics: Record<string, number>; // metric name to score
  timestamp: Date;
  errors?: string[];
}

export interface EvaluationCriteria {
  name: string;
  description: string;
  weight: number; // 0-1, weights should sum to 1
  evaluator: (output: string, expected?: string, input?: string) => number; // Returns score 0-1
}

export interface StatisticalSignificance {
  pValue: number; // p-value for significance test
  confidenceInterval: [number, number];
  isSignificant: boolean; // True if p-value < 0.05
  effectSize: number; // Effect size measure
  testType: string; // Type of statistical test used
}

export interface EvaluationMetric {
  name: string;
  displayName: string;
  description: string;
  calculate: (result: ModelResult) => number;
  compare: (a: number, b: number) => number; // Returns 1 if a>b, 0 if a=b, -1 if a<b
  lowerIsBetter?: boolean;
}

export interface ComparisonResult {
  testId: string;
  results: ModelResult[];
  statisticalAnalysis: Record<string, StatisticalSignificance>;
  rankings: {
    modelId: string;
    rank: number;
    score: number;
    metrics: Record<string, number>;
  }[];
  summary: {
    winner: string;
    bestMetrics: Record<string, { modelId: string; value: number }>;
    statisticalSignificance: boolean;
    confidence: number; // Overall confidence in results 0-1
  };
  createdAt: Date;
}

export interface StatisticalTest {
  type: 't-test' | 'anova' | 'chi-square' | 'wilcoxon' | 'mann-whitney';
  significanceLevel: number; // Default 0.05
  power: number; // Default 0.8
}

export class ModelComparisonEngine {
  private tests: Map<string, ComparisonTest>;
  private results: Map<string, ComparisonResult>;
  private logger: Logger;
  private cache: Cache;
  private llmManager: LLMManager;
  private evaluationCriteria: Map<string, EvaluationCriteria>;
  private evaluationMetrics: Map<string, EvaluationMetric>;

  constructor() {
    this.tests = new Map();
    this.results = new Map();
    this.evaluationCriteria = new Map();
    this.evaluationMetrics = new Map();
    this.logger = new Logger('ModelComparisonEngine');
    this.cache = new Cache();
    this.llmManager = new LLMManager();
    
    this.initializeDefaultCriteria();
    this.initializeDefaultMetrics();
  }

  /**
   * Initialize default evaluation criteria
   */
  private initializeDefaultCriteria(): void {
    // Accuracy - compares output to expected output
    this.evaluationCriteria.set('accuracy', {
      name: 'accuracy',
      description: 'How accurately the model produces the expected output',
      weight: 0.3,
      evaluator: (output: string, expected?: string) => {
        if (!expected) return 0.5; // Neutral score if no expected output
        
        // Simple string similarity (in real implementation, use more sophisticated methods)
        const similarity = this.calculateSimilarity(output.toLowerCase(), expected.toLowerCase());
        return similarity;
      }
    });

    // Coherence - how coherent and logical the response is
    this.evaluationCriteria.set('coherence', {
      name: 'coherence',
      description: 'How coherent and logically consistent the response is',
      weight: 0.25,
      evaluator: (output: string) => {
        // In real implementation, this would use NLP to analyze coherence
        // For now, we'll use a simple heuristic
        const sentences = output.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const avgLength = sentences.reduce((sum, s) => sum + s.trim().split(' ').length, 0) / sentences.length;
        return Math.min(1, avgLength / 20); // Normalize to 0-1
      }
    });

    // Relevance - how relevant the response is to the input
    this.evaluationCriteria.set('relevance', {
      name: 'relevance',
      description: 'How relevant the response is to the given input',
      weight: 0.25,
      evaluator: (output: string, expected: string, input: string) => {
        // In real implementation, this would use semantic similarity
        // For now, we'll use simple keyword overlap
        const inputWords = new Set(input.toLowerCase().split(/\W+/));
        const outputWords = new Set(output.toLowerCase().split(/\W+/));
        const intersection = [...inputWords].filter(x => outputWords.has(x));
        return intersection.length / Math.max(inputWords.size, outputWords.size, 1);
      }
    });

    // Creativity - how creative or diverse the response is
    this.evaluationCriteria.set('creativity', {
      name: 'creativity',
      description: 'How creative or novel the response is',
      weight: 0.2,
      evaluator: (output: string) => {
        // Simple creativity measure based on diverse vocabulary
        const words = output.toLowerCase().split(/\W+/).filter(w => w.length > 0);
        const uniqueWords = new Set(words);
        return uniqueWords.size / words.length;
      }
    });
  }

  /**
   * Initialize default evaluation metrics
   */
  private initializeDefaultMetrics(): void {
    // Latency - response time in milliseconds
    this.evaluationMetrics.set('latency', {
      name: 'latency',
      displayName: 'Response Time',
      description: 'Time taken to generate the response in milliseconds',
      calculate: (result: ModelResult) => result.latency,
      compare: (a: number, b: number) => a < b ? 1 : a > b ? -1 : 0, // Lower is better
      lowerIsBetter: true
    });

    // Cost - cost per response
    this.evaluationMetrics.set('cost', {
      name: 'cost',
      displayName: 'Cost per Response',
      description: 'Cost per response in USD',
      calculate: (result: ModelResult) => result.cost,
      compare: (a: number, b: number) => a < b ? 1 : a > b ? -1 : 0, // Lower is better
      lowerIsBetter: true
    });

    // Token efficiency - tokens per second
    this.evaluationMetrics.set('tokenEfficiency', {
      name: 'tokenEfficiency',
      displayName: 'Token Efficiency',
      description: 'Tokens generated per second',
      calculate: (result: ModelResult) => {
        if (result.latency === 0) return 0;
        return result.tokenUsage.output / (result.latency / 1000);
      },
      compare: (a: number, b: number) => a > b ? 1 : a < b ? -1 : 0 // Higher is better
    });

    // Quality score - weighted average of evaluation criteria
    this.evaluationMetrics.set('qualityScore', {
      name: 'qualityScore',
      displayName: 'Quality Score',
      description: 'Weighted average of evaluation criteria',
      calculate: (result: ModelResult) => {
        let totalScore = 0;
        let totalWeight = 0;
        
        for (const [name, value] of Object.entries(result.metrics)) {
          const criteria = this.evaluationCriteria.get(name);
          if (criteria) {
            totalScore += value * criteria.weight;
            totalWeight += criteria.weight;
          }
        }
        
        return totalWeight > 0 ? totalScore / totalWeight : 0;
      },
      compare: (a: number, b: number) => a > b ? 1 : a < b ? -1 : 0 // Higher is better
    });
  }

  /**
   * Register a new comparison test
   */
  registerTest(test: ComparisonTest): void {
    this.tests.set(test.id, test);
    this.logger.info(`Comparison test registered: ${test.name}`);
  }

  /**
   * Run a comparison test
   */
  async runTest(testId: string): Promise<ComparisonResult> {
    const test = this.tests.get(testId);
    if (!test) {
      throw new Error(`Test not found: ${testId}`);
    }

    test.status = 'running';
    const startTime = Date.now();
    this.logger.info(`Running comparison test: ${test.name}`);

    try {
      const results: ModelResult[] = [];

      // Run each test case against each model
      for (const testCase of test.testCases) {
        for (const modelId of test.models) {
          try {
            const startTime = Date.now();
            const response = await this.llmManager.generateResponse({
              prompt: testCase.input,
              model: modelId,
              context: testCase.context
            });

            const endTime = Date.now();
            const latency = endTime - startTime;

            // Calculate token usage (estimation based on character count)
            const tokenUsage = {
              input: Math.ceil(testCase.input.length / 4),
              output: Math.ceil(response.length / 4),
              total: Math.ceil((testCase.input.length + response.length) / 4)
            };

            // Calculate cost based on model pricing (simplified)
            const cost = this.calculateCost(modelId, tokenUsage);

            // Evaluate using criteria
            const metrics: Record<string, number> = {};
            for (const [name, criteria] of this.evaluationCriteria) {
              metrics[name] = criteria.evaluator(response, testCase.expectedOutput, testCase.input);
            }

            const result: ModelResult = {
              modelId,
              testCaseId: testCase.id,
              output: response,
              latency,
              tokenUsage,
              cost,
              metrics,
              timestamp: new Date()
            };

            results.push(result);
          } catch (error) {
            this.logger.error(`Error running test case ${testCase.id} on model ${modelId}:`, error);
            
            // Add error result
            results.push({
              modelId,
              testCaseId: testCase.id,
              output: '',
              latency: 0,
              tokenUsage: { input: 0, output: 0, total: 0 },
              cost: 0,
              metrics: {},
              timestamp: new Date(),
              errors: [error.message]
            });
          }
        }
      }

      // Perform statistical analysis
      const statisticalAnalysis = this.performStatisticalAnalysis(results, test);

      // Calculate rankings
      const rankings = this.calculateRankings(results, test);

      // Create summary
      const summary = this.createSummary(results, rankings, statisticalAnalysis);

      const comparisonResult: ComparisonResult = {
        testId,
        results,
        statisticalAnalysis,
        rankings,
        summary,
        createdAt: new Date()
      };

      this.results.set(testId, comparisonResult);
      test.status = 'completed';

      const executionTime = Date.now() - startTime;
      this.logger.info(`Comparison test completed in ${executionTime}ms: ${test.name}`);

      // Cache the results
      await this.cache.set(`comparison:result:${testId}`, comparisonResult, 60 * 60 * 24 * 7); // 1 week

      return comparisonResult;
    } catch (error) {
      test.status = 'cancelled';
      this.logger.error(`Error running comparison test ${testId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate cost based on model and token usage
   */
  private calculateCost(modelId: string, tokenUsage: { input: number; output: number; total: number }): number {
    // Simplified cost calculation - in real implementation, use actual pricing
    // These are example prices per 1000 tokens
    const modelPricing: Record<string, { input: number; output: number }> = {
      'openai/gpt-3.5-turbo': { input: 0.001, output: 0.002 },
      'openai/gpt-4': { input: 0.03, output: 0.06 },
      'anthropic/claude-2': { input: 0.008, output: 0.024 },
      'google/palm-2': { input: 0.0005, output: 0.0005 }
    };

    const pricing = modelPricing[modelId] || { input: 0.01, output: 0.02 }; // Default pricing
    return (tokenUsage.input * pricing.input / 1000) + (tokenUsage.output * pricing.output / 1000);
  }

  /**
   * Perform statistical analysis on results
   */
  private performStatisticalAnalysis(results: ModelResult[], test: ComparisonTest): Record<string, StatisticalSignificance> {
    const analysis: Record<string, StatisticalSignificance> = {};
    
    // For each metric, compare each model to the baseline
    for (const metricName of this.evaluationMetrics.keys()) {
      for (const modelId of test.models) {
        if (modelId === test.baselineModel) continue; // Skip baseline model

        const baselineResults = results.filter(r => 
          r.modelId === test.baselineModel && r.metrics[metricName] !== undefined
        );
        const comparisonResults = results.filter(r => 
          r.modelId === modelId && r.metrics[metricName] !== undefined
        );

        if (baselineResults.length > 0 && comparisonResults.length > 0) {
          const baselineValues = baselineResults.map(r => r.metrics[metricName]);
          const comparisonValues = comparisonResults.map(r => r.metrics[metricName]);

          const statisticalResult = this.performTwoSampleTest(baselineValues, comparisonValues);
          analysis[`${modelId}-${metricName}`] = statisticalResult;
        }
      }
    }

    return analysis;
  }

  /**
   * Perform two-sample statistical test
   */
  private performTwoSampleTest(sampleA: number[], sampleB: number[]): StatisticalSignificance {
    // Calculate means
    const meanA = sampleA.reduce((sum, val) => sum + val, 0) / sampleA.length;
    const meanB = sampleB.reduce((sum, val) => sum + val, 0) / sampleB.length;
    
    // Calculate variances
    const varA = sampleA.reduce((sum, val) => sum + Math.pow(val - meanA, 2), 0) / (sampleA.length - 1);
    const varB = sampleB.reduce((sum, val) => sum + Math.pow(val - meanB, 2), 0) / (sampleB.length - 1);
    
    // Calculate pooled standard error
    const se = Math.sqrt((varA / sampleA.length) + (varB / sampleB.length));
    
    // Calculate t-statistic
    const tStat = (meanB - meanA) / se;
    
    // Calculate p-value (using normal approximation for large samples)
    // For simplicity, using a normal approximation here
    // In practice, you'd use a proper t-distribution calculation
    const pValue = 2 * (1 - this.normalCDF(Math.abs(tStat)));
    
    // Calculate 95% confidence interval for the difference
    const criticalValue = 1.96; // For 95% CI
    const marginOfError = criticalValue * se;
    const difference = meanB - meanA;
    const confidenceInterval: [number, number] = [
      difference - marginOfError,
      difference + marginOfError
    ];
    
    return {
      pValue,
      confidenceInterval,
      isSignificant: pValue < 0.05,
      effectSize: this.calculateEffectSize(meanA, meanB, varA, varB),
      testType: 't-test-approximation'
    };
  }

  /**
   * Calculate effect size (Cohen's d)
   */
  private calculateEffectSize(meanA: number, meanB: number, varA: number, varB: number): number {
    const pooledStdDev = Math.sqrt(((varA + varB) / 2));
    return pooledStdDev !== 0 ? Math.abs(meanB - meanA) / pooledStdDev : 0;
  }

  /**
   * Calculate normal CDF approximation
   */
  private normalCDF(x: number): number {
    // Using approximation from Abramowitz and Stegun
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    
    if (x > 0) {
      prob = 1 - prob;
    }
    
    return prob;
  }

  /**
   * Calculate rankings based on metrics
   */
  private calculateRankings(results: ModelResult[], test: ComparisonTest): ComparisonResult['rankings'] {
    // Group results by model
    const modelResults: Record<string, ModelResult[]> = {};
    
    for (const result of results) {
      if (!modelResults[result.modelId]) {
        modelResults[result.modelId] = [];
      }
      modelResults[result.modelId].push(result);
    }

    const rankings = Object.entries(modelResults).map(([modelId, modelResultsArray]) => {
      const metrics: Record<string, number> = {};
      
      for (const [metricName, metric] of this.evaluationMetrics) {
        const values = modelResultsArray
          .map(r => metric.calculate(r))
          .filter(v => !isNaN(v) && v !== undefined);
        
        if (values.length > 0) {
          // Calculate average of the metric across all test cases
          metrics[metricName] = values.reduce((sum, val) => sum + val, 0) / values.length;
        }
      }

      // Calculate overall score based on key metrics
      const qualityScore = metrics['qualityScore'] || 0;
      const latency = metrics['latency'] || 0;
      const cost = metrics['cost'] || 0;
      const tokenEfficiency = metrics['tokenEfficiency'] || 0;
      
      // Create a composite score (this is one approach - could be modified)
      let score = qualityScore * 0.5; // Quality is most important
      if (latency > 0) score += (1 / latency) * 1000 * 0.2; // Faster is better
      if (cost > 0) score += (1 / cost) * 0.1; // Lower cost is better
      if (tokenEfficiency > 0) score += tokenEfficiency * 0.2; // More efficient is better
      
      return {
        modelId,
        rank: 0, // Will be set after sorting
        score,
        metrics
      };
    });

    // Sort by score (descending) and assign ranks
    rankings.sort((a, b) => b.score - a.score);
    rankings.forEach((r, index) => {
      r.rank = index + 1;
    });

    return rankings;
  }

  /**
   * Create summary of comparison results
   */
  private createSummary(
    results: ModelResult[],
    rankings: ComparisonResult['rankings'],
    statisticalAnalysis: Record<string, StatisticalSignificance>
  ): ComparisonResult['summary'] {
    if (rankings.length === 0) {
      return {
        winner: '',
        bestMetrics: {},
        statisticalSignificance: false,
        confidence: 0
      };
    }

    // Winner is the model with rank 1
    const winner = rankings[0].modelId;

    // Find best metrics for each metric type
    const bestMetrics: Record<string, { modelId: string; value: number }> = {};
    
    for (const [metricName, metric] of this.evaluationMetrics) {
      let bestModelId = '';
      let bestValue = metric.lowerIsBetter ? Infinity : -Infinity;
      let isBetter = (a: number, b: number) => metric.lowerIsBetter ? a < b : a > b;
      
      for (const ranking of rankings) {
        const value = ranking.metrics[metricName];
        if (value !== undefined && isBetter(value, bestValue)) {
          bestValue = value;
          bestModelId = ranking.modelId;
        }
      }
      
      if (bestModelId) {
        bestMetrics[metricName] = { modelId: bestModelId, value: bestValue };
      }
    }

    // Determine if there's overall statistical significance
    const significantResults = Object.values(statisticalAnalysis).filter(s => s.isSignificant);
    const statisticalSignificance = significantResults.length > 0;

    // Calculate overall confidence based on number of significant results
    const confidence = significantResults.length / Object.keys(statisticalAnalysis).length;

    return {
      winner,
      bestMetrics,
      statisticalSignificance,
      confidence
    };
  }

  /**
   * Calculate similarity between two strings using a simple algorithm
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;

    // Using a simplified version of the Levenshtein distance
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const longerLength = longer.length;
    
    // For simplicity, just return character overlap ratio
    const commonChars = Math.min(str1.length, str2.length);
    let matches = 0;
    
    for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
      if (str1[i] === str2[i]) matches++;
    }
    
    return matches / longerLength;
  }

  /**
   * Get a comparison test by ID
   */
  getTest(testId: string): ComparisonTest | undefined {
    return this.tests.get(testId);
  }

  /**
   * Get comparison results by test ID
   */
  getResults(testId: string): ComparisonResult | undefined {
    return this.results.get(testId);
  }

  /**
   * Get all comparison tests
   */
  getTests(): ComparisonTest[] {
    return Array.from(this.tests.values());
  }

  /**
   * Get all comparison results
   */
  getComparisonResults(): ComparisonResult[] {
    return Array.from(this.results.values());
  }

  /**
   * Add a custom evaluation criteria
   */
  addEvaluationCriteria(criteria: EvaluationCriteria): void {
    this.evaluationCriteria.set(criteria.name, criteria);
  }

  /**
   * Add a custom evaluation metric
   */
  addEvaluationMetric(metric: EvaluationMetric): void {
    this.evaluationMetrics.set(metric.name, metric);
  }

  /**
   * Compare two models directly with a simple interface
   */
  async quickCompare(
    model1: string,
    model2: string,
    input: string,
    expectedOutput?: string,
    context?: any
  ): Promise<ComparisonResult> {
    const test: ComparisonTest = {
      id: `quick-compare-${Date.now()}`,
      name: `Quick Compare: ${model1} vs ${model2}`,
      description: `Quick comparison between ${model1} and ${model2}`,
      models: [model1, model2],
      testCases: [{
        id: 'single-test',
        input,
        expectedOutput,
        context,
        category: 'quick'
      }],
      metrics: Array.from(this.evaluationMetrics.values()),
      baselineModel: model1,
      createdAt: new Date(),
      createdBy: 'system',
      status: 'draft'
    };

    this.registerTest(test);
    return await this.runTest(test.id);
  }
}

// Predefined comparison templates
export const COMPARISON_TEMPLATES = {
  MODEL_SELECTION: {
    id: 'model-selection-v1',
    name: 'Model Selection Comparison',
    description: 'Compare models across multiple dimensions to select the best one',
    models: ['openai/gpt-3.5-turbo', 'openai/gpt-4', 'anthropic/claude-2'],
    testCases: [
      {
        id: 'creativity',
        input: 'Write a creative story about a robot learning to paint',
        category: 'creativity',
        difficulty: 'medium'
      },
      {
        id: 'analysis',
        input: 'Analyze the pros and cons of renewable energy',
        category: 'analysis',
        difficulty: 'medium'
      },
      {
        id: 'coding',
        input: 'Write a Python function to calculate factorial using recursion',
        category: 'coding',
        difficulty: 'easy'
      },
      {
        id: 'complex-reasoning',
        input: 'Explain the implications of quantum computing on current encryption methods',
        category: 'reasoning',
        difficulty: 'hard'
      }
    ],
    metrics: [],
    baselineModel: 'openai/gpt-3.5-turbo',
    createdAt: new Date(),
    createdBy: 'system',
    status: 'draft'
  } as ComparisonTest,

  COST_EFFICIENCY: {
    id: 'cost-efficiency-v1',
    name: 'Cost Efficiency Analysis',
    description: 'Compare models based on cost effectiveness and performance',
    models: ['openai/gpt-3.5-turbo', 'openai/gpt-4', 'anthropic/claude-2', 'google/palm-2'],
    testCases: Array.from({ length: 10 }, (_, i) => ({
      id: `cost-test-${i}`,
      input: `Summarize this text in 3 sentences: The quick brown fox jumps over the lazy dog. This is a random sentence ${i}.`,
      category: 'summarization',
      difficulty: 'easy',
      priority: 1
    })),
    metrics: [],
    baselineModel: 'openai/gpt-3.5-turbo',
    createdAt: new Date(),
    createdBy: 'system',
    status: 'draft'
  } as ComparisonTest
};