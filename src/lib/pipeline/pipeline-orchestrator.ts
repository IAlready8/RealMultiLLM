/**
 * Advanced Pipeline Orchestrator for RealMultiLLM
 * Provides complex workflow automation with conditional logic and parallel execution
 */

import { Logger } from '../../lib/logger';
import { Cache } from '../../lib/cache';
import { LLMManager } from '../../lib/llm-manager';

// Type definitions
export interface PipelineStep {
  id: string;
  name: string;
  type: 'llm' | 'transform' | 'filter' | 'merge' | 'custom';
  config: Record<string, any>;
  dependencies?: string[]; // IDs of steps this step depends on
  condition?: (context: PipelineContext) => boolean; // Conditional execution
  parallel?: boolean; // Whether this step can run in parallel
  timeout?: number; // Timeout in milliseconds
}

export interface PipelineExecution {
  id: string;
  pipelineId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  context: PipelineContext;
  startTime: Date;
  endTime?: Date;
  results: Record<string, any>;
  errors: Record<string, any>;
  metrics: {
    stepsExecuted: number;
    stepsFailed: number;
    executionTime: number;
    dataProcessed: number;
  };
}

export interface PipelineContext {
  data: any;
  variables: Record<string, any>;
  metadata: Record<string, any>;
  executionId: string;
}

export interface PipelineMetrics {
  executionTime: number;
  successRate: number;
  throughput: number;
  errorRate: number;
  resourceUsage: {
    memory: number;
    cpu: number;
  };
}

export interface ContextStrategy {
  name: string;
  compress: (context: PipelineContext) => PipelineContext;
  expand: (compressedContext: any) => PipelineContext;
  validate: (context: PipelineContext) => boolean;
}

export interface PipelineDefinition {
  id: string;
  name: string;
  description: string;
  steps: PipelineStep[];
  contextStrategy?: ContextStrategy;
  errorHandling?: 'stop-on-error' | 'continue-on-error' | 'retry-on-error';
  parallelism?: number; // Max number of parallel steps
  retryAttempts?: number;
  timeout?: number;
}

export class PipelineOrchestrator {
  private pipelines: Map<string, PipelineDefinition>;
  private executions: Map<string, PipelineExecution>;
  private logger: Logger;
  private cache: Cache;
  private llmManager: LLMManager;
  private activeExecutions: Set<string>;

  constructor() {
    this.pipelines = new Map();
    this.executions = new Map();
    this.activeExecutions = new Set();
    this.logger = new Logger('PipelineOrchestrator');
    this.cache = new Cache();
    this.llmManager = new LLMManager();
  }

  /**
   * Register a new pipeline
   */
  registerPipeline(definition: PipelineDefinition): void {
    this.pipelines.set(definition.id, definition);
    this.logger.info(`Pipeline registered: ${definition.name}`);
  }

  /**
   * Execute a pipeline
   */
  async executePipeline(
    pipelineId: string,
    inputData: any,
    options?: { userId?: string; metadata?: Record<string, any> }
  ): Promise<PipelineExecution> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline not found: ${pipelineId}`);
    }

    const executionId = `${pipelineId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const execution: PipelineExecution = {
      id: executionId,
      pipelineId,
      status: 'running',
      context: {
        data: inputData,
        variables: {},
        metadata: { ...options?.metadata, userId: options?.userId },
        executionId
      },
      startTime: new Date(),
      results: {},
      errors: {},
      metrics: {
        stepsExecuted: 0,
        stepsFailed: 0,
        executionTime: 0,
        dataProcessed: 0
      }
    };

    this.executions.set(executionId, execution);
    this.activeExecutions.add(executionId);

    try {
      // Apply context strategy if defined
      if (pipeline.contextStrategy) {
        execution.context = pipeline.contextStrategy.compress(execution.context);
      }

      // Execute pipeline steps
      await this.executeSteps(pipeline, execution);

      execution.status = 'completed';
      execution.endTime = new Date();
      execution.metrics.executionTime = execution.endTime.getTime() - execution.startTime.getTime();

      this.logger.info(`Pipeline ${pipelineId} completed in ${execution.metrics.executionTime}ms`);
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.metrics.executionTime = execution.endTime.getTime() - execution.startTime.getTime();
      
      this.logger.error(`Pipeline ${pipelineId} failed:`, error);
    } finally {
      this.activeExecutions.delete(executionId);
      
      // Cache execution results
      await this.cache.set(`pipeline:execution:${executionId}`, execution, 60 * 60 * 24); // 24 hours
    }

    return execution;
  }

  /**
   * Execute pipeline steps with dependencies, conditions, and parallelism
   */
  private async executeSteps(pipeline: PipelineDefinition, execution: PipelineExecution): Promise<void> {
    const stepQueue = [...pipeline.steps];
    const completedSteps: Set<string> = new Set();
    const maxParallelism = pipeline.parallelism || 1;

    while (stepQueue.length > 0) {
      // Find steps ready to execute (dependencies met and condition satisfied)
      const readySteps = stepQueue.filter(step => {
        // Check if all dependencies are completed
        const dependenciesMet = step.dependencies?.every(depId => completedSteps.has(depId)) ?? true;
        
        // Check condition if present
        const conditionMet = step.condition ? step.condition(execution.context) : true;
        
        return dependenciesMet && conditionMet;
      }).slice(0, maxParallelism); // Limit by parallelism

      if (readySteps.length === 0) {
        // Check for circular dependencies or missing dependencies
        const remaining = stepQueue.map(s => s.id).join(', ');
        throw new Error(`Unable to execute pipeline steps. Remaining: ${remaining}. Check dependencies.`);
      }

      // Execute ready steps in parallel
      const executionPromises = readySteps.map(async (step) => {
        try {
          const result = await this.executeStep(step, execution);
          execution.results[step.id] = result;
          execution.metrics.stepsExecuted++;
        } catch (error) {
          execution.errors[step.id] = error.message;
          execution.metrics.stepsFailed++;
          
          if (pipeline.errorHandling === 'stop-on-error') {
            throw error;
          }
        }
      });

      await Promise.all(executionPromises);

      // Remove completed steps from queue
      for (const step of readySteps) {
        stepQueue.splice(stepQueue.findIndex(s => s.id === step.id), 1);
        completedSteps.add(step.id);
      }
    }
  }

  /**
   * Execute a single pipeline step
   */
  private async executeStep(step: PipelineStep, execution: PipelineExecution): Promise<any> {
    const startTime = Date.now();
    
    try {
      let result: any;
      
      // Apply timeout if specified
      if (step.timeout) {
        result = await this.executeWithTimeout(
          this.executeStepLogic.bind(this, step, execution),
          step.timeout
        );
      } else {
        result = await this.executeStepLogic(step, execution);
      }

      // Update execution metrics
      const executionTime = Date.now() - startTime;
      execution.metrics.dataProcessed += this.calculateDataSize(result);

      return result;
    } catch (error) {
      if (step.config.retryAttempts && step.config.retryAttempts > 0) {
        // Retry logic
        for (let i = 0; i < step.config.retryAttempts; i++) {
          try {
            await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
            return await this.executeStepLogic(step, execution);
          } catch (retryError) {
            if (i === step.config.retryAttempts - 1) {
              throw retryError;
            }
          }
        }
      }
      throw error;
    }
  }

  /**
   * Execute the logic of a single step based on its type
   */
  private async executeStepLogic(step: PipelineStep, execution: PipelineExecution): Promise<any> {
    switch (step.type) {
      case 'llm':
        return await this.executeLlmStep(step, execution);
      case 'transform':
        return await this.executeTransformStep(step, execution);
      case 'filter':
        return await this.executeFilterStep(step, execution);
      case 'merge':
        return await this.executeMergeStep(step, execution);
      case 'custom':
        return await this.executeCustomStep(step, execution);
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  /**
   * Execute an LLM step
   */
  private async executeLlmStep(step: PipelineStep, execution: PipelineExecution): Promise<any> {
    const { prompt, model, context } = step.config;
    
    // Replace variables in prompt
    const processedPrompt = this.replaceVariables(prompt, execution.context.variables);
    
    return await this.llmManager.generateResponse({
      prompt: processedPrompt,
      model: model || 'openai/gpt-3.5-turbo',
      context: context || execution.context.data
    });
  }

  /**
   * Execute a transform step
   */
  private async executeTransformStep(step: PipelineStep, execution: PipelineExecution): Promise<any> {
    const { transformFunction } = step.config;
    
    if (typeof transformFunction === 'function') {
      return transformFunction(execution.context.data);
    }
    
    // If transformFunction is a string, assume it's a mapping function
    return this.transformData(execution.context.data, transformFunction);
  }

  /**
   * Execute a filter step
   */
  private async executeFilterStep(step: PipelineStep, execution: PipelineExecution): Promise<any> {
    const { filterFunction } = step.config;
    
    if (typeof filterFunction === 'function') {
      return execution.context.data.filter(filterFunction);
    }
    
    // If filterFunction is a string, assume it's a condition
    return execution.context.data.filter((item: any) => this.evaluateCondition(item, filterFunction));
  }

  /**
   * Execute a merge step
   */
  private async executeMergeStep(step: PipelineStep, execution: PipelineExecution): Promise<any> {
    const { sources, strategy } = step.config;
    
    const sourceData = await Promise.all(
      sources.map(async (sourceId: string) => {
        if (execution.results[sourceId]) {
          return execution.results[sourceId];
        } else if (execution.context.data[sourceId]) {
          return execution.context.data[sourceId];
        } else {
          throw new Error(`Source ${sourceId} not found for merge step`);
        }
      })
    );
    
    return this.mergeData(sourceData, strategy || 'concat');
  }

  /**
   * Execute a custom step
   */
  private async executeCustomStep(step: PipelineStep, execution: PipelineExecution): Promise<any> {
    const { customFunction } = step.config;
    
    if (typeof customFunction === 'function') {
      return customFunction(execution.context, step.config);
    }
    
    throw new Error(`Custom function not defined for step: ${step.id}`);
  }

  /**
   * Execute a function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Step timed out after ${timeoutMs}ms`)), timeoutMs)
      )
    ]);
  }

  /**
   * Replace variables in a string
   */
  private replaceVariables(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, variableName) => {
      return variables[variableName] || match;
    });
  }

  /**
   * Transform data based on a mapping
   */
  private transformData(data: any, mapping: Record<string, string>): any {
    if (Array.isArray(data)) {
      return data.map(item => this.transformObject(item, mapping));
    }
    return this.transformObject(data, mapping);
  }

  /**
   * Transform a single object based on mapping
   */
  private transformObject(obj: any, mapping: Record<string, string>): any {
    const result: any = {};
    for (const [newKey, oldKey] of Object.entries(mapping)) {
      result[newKey] = obj[oldKey];
    }
    return result;
  }

  /**
   * Evaluate a condition against data
   */
  private evaluateCondition(data: any, condition: string): boolean {
    // This is a simplified condition evaluator
    // In a real implementation, you might use a more sophisticated expression evaluator
    try {
      // For example, evaluate "value > 10" against data.value
      const match = condition.match(/(\w+)\s*(==|!=|<|>|<=|>=)\s*(.+)/);
      if (match) {
        const [, property, operator, value] = match;
        const actualValue = data[property];
        const compareValue = isNaN(Number(value)) ? value : Number(value);
        
        switch (operator) {
          case '==': return actualValue == compareValue;
          case '!=': return actualValue != compareValue;
          case '<': return actualValue < compareValue;
          case '>': return actualValue > compareValue;
          case '<=': return actualValue <= compareValue;
          case '>=': return actualValue >= compareValue;
          default: return false;
        }
      }
      return false;
    } catch (error) {
      this.logger.error('Error evaluating condition:', error);
      return false;
    }
  }

  /**
   * Merge data based on strategy
   */
  private mergeData(sources: any[], strategy: string): any {
    switch (strategy) {
      case 'concat':
        return sources.flat();
      case 'deep-merge':
        return this.deepMergeObjects(...sources);
      case 'zip':
        return this.zipArrays(...sources);
      default:
        return sources.flat(); // Default to concat
    }
  }

  /**
   * Deep merge objects
   */
  private deepMergeObjects(...objects: any[]): any {
    return objects.reduce((target, source) => {
      for (const key in source) {
        if (source.hasOwnProperty(key)) {
          if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
            target[key] = this.deepMergeObjects(target[key] || {}, source[key]);
          } else {
            target[key] = source[key];
          }
        }
      }
      return target;
    }, {});
  }

  /**
   * Zip arrays together
   */
  private zipArrays(...arrays: any[][]): any[] {
    const minLength = Math.min(...arrays.map(arr => arr.length));
    const result = [];
    
    for (let i = 0; i < minLength; i++) {
      result.push(arrays.map(arr => arr[i]));
    }
    
    return result;
  }

  /**
   * Calculate approximate data size
   */
  private calculateDataSize(data: any): number {
    return JSON.stringify(data).length;
  }

  /**
   * Cancel a running pipeline execution
   */
  cancelExecution(executionId: string): void {
    const execution = this.executions.get(executionId);
    if (execution && execution.status === 'running') {
      execution.status = 'cancelled';
      execution.endTime = new Date();
      this.activeExecutions.delete(executionId);
      
      this.logger.info(`Pipeline execution cancelled: ${executionId}`);
    }
  }

  /**
   * Get execution metrics
   */
  getExecutionMetrics(executionId: string): PipelineMetrics | null {
    const execution = this.executions.get(executionId);
    if (!execution) return null;

    const totalSteps = execution.metrics.stepsExecuted + execution.metrics.stepsFailed;
    return {
      executionTime: execution.metrics.executionTime,
      successRate: totalSteps > 0 ? (execution.metrics.stepsExecuted / totalSteps) * 100 : 100,
      throughput: execution.metrics.dataProcessed / (execution.metrics.executionTime / 1000 || 1),
      errorRate: totalSteps > 0 ? (execution.metrics.stepsFailed / totalSteps) * 100 : 0,
      resourceUsage: {
        memory: 0, // Would need system integration to get actual memory
        cpu: 0 // Would need system integration to get actual CPU
      }
    };
  }

  /**
   * Get pipeline execution by ID
   */
  getExecution(executionId: string): PipelineExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get all active executions
   */
  getActiveExecutions(): PipelineExecution[] {
    return Array.from(this.activeExecutions).map(id => this.executions.get(id)!);
  }

  /**
   * Get all pipeline definitions
   */
  getPipelines(): PipelineDefinition[] {
    return Array.from(this.pipelines.values());
  }
}

// Predefined pipeline templates
export const PIPELINE_TEMPLATES = {
  CONTENT_GENERATION: {
    id: 'content-generation-v1',
    name: 'Content Generation Pipeline',
    description: 'Generates high-quality content with review steps',
    steps: [
      {
        id: 'research',
        name: 'Research Topic',
        type: 'llm',
        config: {
          prompt: 'Research and provide key points about: {{topic}}',
          model: 'openai/gpt-4'
        },
        parallel: true
      },
      {
        id: 'draft',
        name: 'Draft Content',
        type: 'llm',
        config: {
          prompt: 'Create a draft article based on these points: {{research.result}}',
          model: 'openai/gpt-4'
        },
        dependencies: ['research'],
        parallel: true
      },
      {
        id: 'review',
        name: 'Review Content',
        type: 'llm',
        config: {
          prompt: 'Review this content and suggest improvements: {{draft.result}}',
          model: 'openai/gpt-4'
        },
        dependencies: ['draft'],
        parallel: true
      },
      {
        id: 'revise',
        name: 'Revise Content',
        type: 'llm',
        config: {
          prompt: 'Revise the content based on review: {{review.result}}\nOriginal content: {{draft.result}}',
          model: 'openai/gpt-4'
        },
        dependencies: ['review']
      }
    ],
    errorHandling: 'continue-on-error',
    parallelism: 2,
    retryAttempts: 2
  } as PipelineDefinition,

  CODE_REVIEW: {
    id: 'code-review-v1',
    name: 'Code Review Pipeline',
    description: 'Reviews code changes and provides feedback',
    steps: [
      {
        id: 'analyze',
        name: 'Analyze Code',
        type: 'llm',
        config: {
          prompt: 'Analyze the following code for potential issues: {{code}}',
          model: 'openai/gpt-4'
        }
      },
      {
        id: 'suggest',
        name: 'Suggest Improvements',
        type: 'llm',
        config: {
          prompt: 'Suggest improvements for this code: {{code}}\nIssues found: {{analyze.result}}',
          model: 'openai/gpt-4'
        },
        dependencies: ['analyze']
      },
      {
        id: 'summarize',
        name: 'Summarize Review',
        type: 'llm',
        config: {
          prompt: 'Create a concise summary of the code review:\nAnalysis: {{analyze.result}}\nSuggestions: {{suggest.result}}',
          model: 'openai/gpt-3.5-turbo'
        },
        dependencies: ['analyze', 'suggest']
      }
    ],
    errorHandling: 'stop-on-error',
    retryAttempts: 3
  } as PipelineDefinition,

  DATA_ANALYSIS: {
    id: 'data-analysis-v1',
    name: 'Data Analysis Pipeline',
    description: 'Analyzes data and generates insights',
    steps: [
      {
        id: 'clean',
        name: 'Clean Data',
        type: 'transform',
        config: {
          transformFunction: (data: any[]) => {
            // Remove null/undefined values
            return data.filter(item => item != null);
          }
        }
      },
      {
        id: 'analyze',
        name: 'Analyze Data',
        type: 'llm',
        config: {
          prompt: 'Analyze this dataset and identify patterns, trends, and anomalies: {{clean.result}}',
          model: 'openai/gpt-4'
        },
        dependencies: ['clean']
      },
      {
        id: 'visualize-plan',
        name: 'Plan Visualization',
        type: 'llm',
        config: {
          prompt: 'Based on the analysis, recommend the best visualization types for this data: {{analyze.result}}',
          model: 'openai/gpt-3.5-turbo'
        },
        dependencies: ['analyze']
      }
    ],
    errorHandling: 'continue-on-error',
    parallelism: 2
  } as PipelineDefinition
};