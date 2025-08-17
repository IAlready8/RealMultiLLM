/**
 * ✨ ADVANCED FEATURE 3: Advanced Prompt Engineering Assistant
 * 
 * AI-powered tool that analyzes and optimizes prompts for better results
 * using advanced NLP techniques and pattern recognition.
 */

interface PromptAnalysis {
  clarity: number; // 0-1 score
  specificity: number; // 0-1 score
  structure: number; // 0-1 score
  completeness: number; // 0-1 score
  overall: number; // 0-1 overall score
  issues: PromptIssue[];
  suggestions: PromptSuggestion[];
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedTokens: number;
  readabilityScore: number;
}

interface PromptIssue {
  type: 'ambiguity' | 'vagueness' | 'contradiction' | 'incomplete' | 'bias' | 'complexity';
  severity: 'low' | 'medium' | 'high';
  description: string;
  location?: { start: number; end: number };
  suggestion: string;
}

interface PromptSuggestion {
  type: 'structure' | 'clarity' | 'context' | 'examples' | 'constraints' | 'format';
  priority: 'low' | 'medium' | 'high';
  description: string;
  before: string;
  after: string;
  reasoning: string;
}

interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  template: string;
  variables: string[];
  examples: Array<{input: string; expected: string}>;
  effectiveness: number;
  usageCount: number;
}

interface OptimizationResult {
  original: string;
  optimized: string;
  improvements: string[];
  scoreImprovement: number;
  estimatedPerformanceGain: number;
  reasoning: string;
}

class PromptEngineeringAssistant {
  private templates: Map<string, PromptTemplate> = new Map();
  private optimizationHistory: Map<string, OptimizationResult[]> = new Map();
  private knownPatterns: Map<string, RegExp> = new Map();

  constructor() {
    this.initializePatterns();
    this.loadDefaultTemplates();
  }

  /**
   * Analyze a prompt for quality and potential issues
   */
  analyzePrompt(prompt: string, context?: string): PromptAnalysis {
    const issues: PromptIssue[] = [];
    const suggestions: PromptSuggestion[] = [];

    // Calculate various quality metrics
    const clarity = this.calculateClarity(prompt);
    const specificity = this.calculateSpecificity(prompt);
    const structure = this.calculateStructure(prompt);
    const completeness = this.calculateCompleteness(prompt);
    const readability = this.calculateReadability(prompt);

    // Detect issues
    issues.push(...this.detectAmbiguity(prompt));
    issues.push(...this.detectVagueness(prompt));
    issues.push(...this.detectContradictions(prompt));
    issues.push(...this.detectBias(prompt));
    issues.push(...this.detectComplexity(prompt));

    // Generate suggestions
    suggestions.push(...this.generateStructureSuggestions(prompt));
    suggestions.push(...this.generateClaritySuggestions(prompt));
    suggestions.push(...this.generateContextSuggestions(prompt, context));
    suggestions.push(...this.generateExampleSuggestions(prompt));

    const overall = (clarity + specificity + structure + completeness) / 4;

    return {
      clarity,
      specificity,
      structure,
      completeness,
      overall,
      issues,
      suggestions,
      complexity: this.determineComplexity(prompt),
      estimatedTokens: this.estimateTokens(prompt),
      readabilityScore: readability
    };
  }

  /**
   * Optimize a prompt for better performance
   */
  optimizePrompt(
    prompt: string, 
    targetProvider?: string,
    optimizationGoals: Array<'clarity' | 'conciseness' | 'specificity' | 'creativity'> = ['clarity', 'specificity']
  ): OptimizationResult {
    const original = prompt;
    let optimized = prompt;
    const improvements: string[] = [];

    // Apply various optimization techniques
    if (optimizationGoals.includes('clarity')) {
      const clarityResult = this.improveClarityOptimized(optimized);
      optimized = clarityResult.text;
      improvements.push(...clarityResult.improvements);
    }

    if (optimizationGoals.includes('specificity')) {
      const specificityResult = this.improveSpecificity(optimized);
      optimized = specificityResult.text;
      improvements.push(...specificityResult.improvements);
    }

    if (optimizationGoals.includes('conciseness')) {
      const concisenessResult = this.improveConciseness(optimized);
      optimized = concisenessResult.text;
      improvements.push(...concisenessResult.improvements);
    }

    if (optimizationGoals.includes('creativity')) {
      const creativityResult = this.improveCreativity(optimized);
      optimized = creativityResult.text;
      improvements.push(...creativityResult.improvements);
    }

    // Apply provider-specific optimizations
    if (targetProvider) {
      const providerResult = this.applyProviderOptimizations(optimized, targetProvider);
      optimized = providerResult.text;
      improvements.push(...providerResult.improvements);
    }

    // Calculate improvement metrics
    const originalAnalysis = this.analyzePrompt(original);
    const optimizedAnalysis = this.analyzePrompt(optimized);
    const scoreImprovement = optimizedAnalysis.overall - originalAnalysis.overall;

    const result: OptimizationResult = {
      original,
      optimized,
      improvements,
      scoreImprovement,
      estimatedPerformanceGain: this.estimatePerformanceGain(originalAnalysis, optimizedAnalysis),
      reasoning: this.generateOptimizationReasoning(improvements, scoreImprovement)
    };

    // Store in history
    const userId = 'current'; // This would come from session in real implementation
    const history = this.optimizationHistory.get(userId) || [];
    history.push(result);
    this.optimizationHistory.set(userId, history.slice(-50)); // Keep last 50

    return result;
  }

  /**
   * Suggest prompt templates based on the user's intent
   */
  suggestTemplates(query: string, category?: string): PromptTemplate[] {
    const templates = Array.from(this.templates.values());
    
    // Filter by category if specified
    const filtered = category ? 
      templates.filter(t => t.category === category) : 
      templates;

    // Score templates based on relevance to query
    const scored = filtered.map(template => ({
      template,
      relevance: this.calculateTemplateRelevance(query, template)
    }));

    // Sort by relevance and effectiveness
    scored.sort((a, b) => {
      const scoreA = a.relevance * 0.7 + a.template.effectiveness * 0.3;
      const scoreB = b.relevance * 0.7 + b.template.effectiveness * 0.3;
      return scoreB - scoreA;
    });

    return scored.slice(0, 5).map(s => s.template);
  }

  /**
   * Generate variations of a prompt for A/B testing
   */
  generatePromptVariations(
    basePrompt: string, 
    variationCount: number = 3,
    variationTypes: Array<'rephrased' | 'structured' | 'detailed' | 'concise'> = ['rephrased', 'structured']
  ): Array<{variation: string; type: string; description: string}> {
    const variations: Array<{variation: string; type: string; description: string}> = [];

    variationTypes.forEach(type => {
      for (let i = 0; i < Math.ceil(variationCount / variationTypes.length); i++) {
        let variation: string;
        let description: string;

        switch (type) {
          case 'rephrased':
            variation = this.rephrasePROMPT(basePrompt, i);
            description = 'Rephrased for different linguistic approach';
            break;
          case 'structured':
            variation = this.addStructure(basePrompt);
            description = 'Added clear structure and formatting';
            break;
          case 'detailed':
            variation = this.addDetail(basePrompt);
            description = 'Enhanced with additional context and examples';
            break;
          case 'concise':
            variation = this.makeConcise(basePrompt);
            description = 'Simplified and made more direct';
            break;
          default:
            continue;
        }

        variations.push({ variation, type, description });
      }
    });

    return variations.slice(0, variationCount);
  }

  /**
   * Analyze prompt effectiveness based on historical data
   */
  analyzeEffectiveness(
    prompt: string,
    responses: Array<{response: string; rating: number; provider: string}>
  ): {
    averageRating: number;
    providerPerformance: Record<string, number>;
    patterns: string[];
    recommendations: string[];
  } {
    if (responses.length === 0) {
      return {
        averageRating: 0,
        providerPerformance: {},
        patterns: [],
        recommendations: ['No historical data available for analysis']
      };
    }

    const averageRating = responses.reduce((sum, r) => sum + r.rating, 0) / responses.length;
    
    const providerPerformance: Record<string, number> = {};
    responses.forEach(r => {
      if (!providerPerformance[r.provider]) {
        providerPerformance[r.provider] = 0;
      }
      providerPerformance[r.provider] += r.rating;
    });

    // Average provider performance
    Object.keys(providerPerformance).forEach(provider => {
      const count = responses.filter(r => r.provider === provider).length;
      providerPerformance[provider] /= count;
    });

    // Identify patterns in successful responses
    const highRatingResponses = responses.filter(r => r.rating >= 4);
    const patterns = this.identifySuccessPatterns(prompt, highRatingResponses);

    // Generate recommendations
    const recommendations = this.generateEffectivenessRecommendations(
      prompt, averageRating, providerPerformance, patterns
    );

    return {
      averageRating,
      providerPerformance,
      patterns,
      recommendations
    };
  }

  private calculateClarity(prompt: string): number {
    let score = 0.5; // Base score

    // Check for clear structure
    if (this.hasGoodStructure(prompt)) score += 0.2;
    
    // Check for specific language
    if (this.hasSpecificLanguage(prompt)) score += 0.15;
    
    // Check for ambiguous words
    const ambiguousWords = this.countAmbiguousWords(prompt);
    score -= Math.min(0.3, ambiguousWords * 0.05);

    // Check for clear instructions
    if (this.hasActionWords(prompt)) score += 0.15;

    return Math.max(0, Math.min(1, score));
  }

  private calculateSpecificity(prompt: string): number {
    let score = 0.3; // Base score

    // Check for specific examples
    if (this.hasExamples(prompt)) score += 0.25;
    
    // Check for constraints/requirements
    if (this.hasConstraints(prompt)) score += 0.2;
    
    // Check for context
    if (this.hasContext(prompt)) score += 0.15;
    
    // Check for vague words
    const vagueness = this.calculateVagueness(prompt);
    score -= vagueness * 0.1;

    return Math.max(0, Math.min(1, score));
  }

  private calculateStructure(prompt: string): number {
    let score = 0.2; // Base score

    // Check for clear sections
    if (this.hasSections(prompt)) score += 0.3;
    
    // Check for numbered lists
    if (/\d+\.|•|\-/.test(prompt)) score += 0.2;
    
    // Check for proper formatting
    if (this.hasGoodFormatting(prompt)) score += 0.3;

    return Math.max(0, Math.min(1, score));
  }

  private calculateCompleteness(prompt: string): number {
    let score = 0.4; // Base score

    // Check for all necessary components
    const components = ['context', 'task', 'format', 'constraints'];
    const present = components.filter(comp => this.hasComponent(prompt, comp));
    score += (present.length / components.length) * 0.6;

    return Math.max(0, Math.min(1, score));
  }

  private calculateReadability(prompt: string): number {
    const words = prompt.split(/\s+/);
    const sentences = prompt.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length === 0) return 0;
    
    const avgWordsPerSentence = words.length / sentences.length;
    const avgSyllablesPerWord = words.reduce((sum, word) => 
      sum + this.countSyllables(word), 0) / words.length;

    // Simplified Flesch Reading Ease formula
    const score = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
    return Math.max(0, Math.min(1, score / 100));
  }

  private detectAmbiguity(prompt: string): PromptIssue[] {
    const issues: PromptIssue[] = [];
    const ambiguousPatterns = [
      { pattern: /\b(this|that|it|they)\b/gi, desc: 'Unclear pronoun reference' },
      { pattern: /\b(some|many|few|several)\b/gi, desc: 'Vague quantifier' },
      { pattern: /\b(good|bad|better|worse)\b/gi, desc: 'Subjective qualifier without criteria' }
    ];

    ambiguousPatterns.forEach(({pattern, desc}) => {
      const matches = prompt.match(pattern);
      if (matches && matches.length > 2) {
        issues.push({
          type: 'ambiguity',
          severity: 'medium',
          description: desc,
          suggestion: 'Replace with more specific terms or provide clear references'
        });
      }
    });

    return issues;
  }

  private detectVagueness(prompt: string): PromptIssue[] {
    const issues: PromptIssue[] = [];
    const vagueWords = ['something', 'anything', 'everything', 'somehow', 'probably', 'maybe'];
    
    const foundVague = vagueWords.filter(word => 
      prompt.toLowerCase().includes(word.toLowerCase())
    );

    if (foundVague.length > 0) {
      issues.push({
        type: 'vagueness',
        severity: 'medium',
        description: `Contains vague terms: ${foundVague.join(', ')}`,
        suggestion: 'Replace vague terms with specific descriptions or requirements'
      });
    }

    return issues;
  }

  private detectContradictions(prompt: string): PromptIssue[] {
    const issues: PromptIssue[] = [];
    
    // Simple contradiction detection
    const contradictoryPairs = [
      ['short', 'detailed'], ['simple', 'complex'], ['quick', 'thorough']
    ];

    contradictoryPairs.forEach(([word1, word2]) => {
      if (prompt.toLowerCase().includes(word1) && prompt.toLowerCase().includes(word2)) {
        issues.push({
          type: 'contradiction',
          severity: 'high',
          description: `Potentially contradictory requirements: "${word1}" and "${word2}"`,
          suggestion: 'Clarify the priority between conflicting requirements'
        });
      }
    });

    return issues;
  }

  private detectBias(prompt: string): PromptIssue[] {
    const issues: PromptIssue[] = [];
    
    // Check for potential bias indicators
    const biasPatterns = [
      /\b(always|never|all|none)\b/gi,
      /\b(obviously|clearly|simply)\b/gi
    ];

    biasPatterns.forEach(pattern => {
      if (pattern.test(prompt)) {
        issues.push({
          type: 'bias',
          severity: 'low',
          description: 'Contains absolute statements that may introduce bias',
          suggestion: 'Consider using more nuanced language to avoid bias'
        });
      }
    });

    return issues;
  }

  private detectComplexity(prompt: string): PromptIssue[] {
    const issues: PromptIssue[] = [];
    
    // Check sentence complexity
    const sentences = prompt.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const longSentences = sentences.filter(s => s.split(' ').length > 30);
    
    if (longSentences.length > 0) {
      issues.push({
        type: 'complexity',
        severity: 'medium',
        description: 'Contains overly complex sentences',
        suggestion: 'Break down long sentences into shorter, clearer statements'
      });
    }

    return issues;
  }

  private generateStructureSuggestions(prompt: string): PromptSuggestion[] {
    const suggestions: PromptSuggestion[] = [];

    if (!this.hasSections(prompt) && prompt.length > 200) {
      suggestions.push({
        type: 'structure',
        priority: 'high',
        description: 'Add clear sections to organize the prompt',
        before: 'Long unstructured prompt',
        after: 'Prompt with clear sections: Context, Task, Requirements, Format',
        reasoning: 'Structured prompts are easier to follow and produce better results'
      });
    }

    return suggestions;
  }

  private generateClaritySuggestions(prompt: string): PromptSuggestion[] {
    const suggestions: PromptSuggestion[] = [];

    if (!this.hasActionWords(prompt)) {
      suggestions.push({
        type: 'clarity',
        priority: 'high',
        description: 'Add clear action words to specify what you want',
        before: 'Vague instruction',
        after: 'Clear instruction with action verbs like "analyze", "summarize", "explain"',
        reasoning: 'Action words make expectations clear'
      });
    }

    return suggestions;
  }

  private generateContextSuggestions(prompt: string, context?: string): PromptSuggestion[] {
    const suggestions: PromptSuggestion[] = [];

    if (!this.hasContext(prompt) && !context) {
      suggestions.push({
        type: 'context',
        priority: 'medium',
        description: 'Add context to help the AI understand the scenario',
        before: 'Task without context',
        after: 'Task with background information and context',
        reasoning: 'Context helps AI provide more relevant and accurate responses'
      });
    }

    return suggestions;
  }

  private generateExampleSuggestions(prompt: string): PromptSuggestion[] {
    const suggestions: PromptSuggestion[] = [];

    if (!this.hasExamples(prompt) && prompt.length > 100) {
      suggestions.push({
        type: 'examples',
        priority: 'medium',
        description: 'Add examples to clarify expectations',
        before: 'Abstract request',
        after: 'Request with concrete examples',
        reasoning: 'Examples demonstrate the desired output format and style'
      });
    }

    return suggestions;
  }

  // Helper methods for analysis
  private hasGoodStructure(prompt: string): boolean {
    return /\n\n|\n-|\n\d+\./.test(prompt);
  }

  private hasSpecificLanguage(prompt: string): boolean {
    const specificWords = ['exactly', 'specifically', 'precisely', 'detailed', 'step-by-step'];
    return specificWords.some(word => prompt.toLowerCase().includes(word));
  }

  private countAmbiguousWords(prompt: string): number {
    const ambiguous = ['this', 'that', 'it', 'these', 'those', 'something', 'anything'];
    return ambiguous.reduce((count, word) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = prompt.match(regex);
      return count + (matches ? matches.length : 0);
    }, 0);
  }

  private hasActionWords(prompt: string): boolean {
    const actionWords = ['analyze', 'summarize', 'explain', 'describe', 'create', 'generate', 'write', 'calculate'];
    return actionWords.some(word => prompt.toLowerCase().includes(word));
  }

  private hasExamples(prompt: string): boolean {
    return /example|instance|such as|like|for example/i.test(prompt);
  }

  private hasConstraints(prompt: string): boolean {
    return /must|should|cannot|limit|maximum|minimum|within|between/i.test(prompt);
  }

  private hasContext(prompt: string): boolean {
    return /context|background|scenario|situation|given that/i.test(prompt);
  }

  private calculateVagueness(prompt: string): number {
    const vagueWords = ['thing', 'stuff', 'some', 'any', 'maybe', 'probably', 'kind of', 'sort of'];
    const count = vagueWords.reduce((total, word) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = prompt.match(regex);
      return total + (matches ? matches.length : 0);
    }, 0);
    
    return Math.min(1, count / 10); // Normalize to 0-1
  }

  private hasSections(prompt: string): boolean {
    return /^(Context|Task|Requirements|Format|Instructions?):/im.test(prompt) ||
           /\n\n.*:/m.test(prompt);
  }

  private hasGoodFormatting(prompt: string): boolean {
    return /\*\*|\*|`|```|\n-|\n\d+\./.test(prompt);
  }

  private hasComponent(prompt: string, component: string): boolean {
    const patterns = {
      context: /context|background|scenario/i,
      task: /task|goal|objective|want|need/i,
      format: /format|output|structure|organize/i,
      constraints: /constraint|limit|requirement|must|should/i
    };
    
    return patterns[component as keyof typeof patterns]?.test(prompt) || false;
  }

  private countSyllables(word: string): number {
    word = word.toLowerCase();
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
  }

  private determineComplexity(prompt: string): 'simple' | 'moderate' | 'complex' {
    const wordCount = prompt.split(/\s+/).length;
    const sentenceCount = prompt.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const avgWordsPerSentence = wordCount / Math.max(sentenceCount, 1);
    
    if (wordCount < 50 && avgWordsPerSentence < 15) return 'simple';
    if (wordCount < 200 && avgWordsPerSentence < 25) return 'moderate';
    return 'complex';
  }

  private estimateTokens(prompt: string): number {
    // Rough estimation: 1 token ≈ 0.75 words
    const wordCount = prompt.split(/\s+/).length;
    return Math.ceil(wordCount / 0.75);
  }

  // Optimization methods
  private improveClarityOptimized(prompt: string): {text: string; improvements: string[]} {
    let optimized = prompt;
    const improvements: string[] = [];

    // Replace ambiguous pronouns
    const pronounReplacements = [
      { pattern: /\bit\b/gi, replacement: '[specific item]', improvement: 'Replaced ambiguous pronoun "it"' },
      { pattern: /\bthis\b/gi, replacement: '[specific item]', improvement: 'Replaced ambiguous "this"' }
    ];

    pronounReplacements.forEach(({pattern, replacement, improvement}) => {
      if (pattern.test(optimized)) {
        optimized = optimized.replace(pattern, replacement);
        improvements.push(improvement);
      }
    });

    // Add structure if missing
    if (!this.hasSections(optimized) && optimized.length > 100) {
      optimized = `Context: [Provide context here]\n\nTask: ${optimized}\n\nRequirements: [Specify requirements]`;
      improvements.push('Added structured sections for clarity');
    }

    return { text: optimized, improvements };
  }

  private improveSpecificity(prompt: string): {text: string; improvements: string[]} {
    let optimized = prompt;
    const improvements: string[] = [];

    // Replace vague quantifiers
    const vague = ['some', 'many', 'few', 'several'];
    vague.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(optimized)) {
        optimized = optimized.replace(regex, '[specific number]');
        improvements.push(`Replaced vague quantifier "${word}" with specific placeholder`);
      }
    });

    return { text: optimized, improvements };
  }

  private improveConciseness(prompt: string): {text: string; improvements: string[]} {
    let optimized = prompt;
    const improvements: string[] = [];

    // Remove redundant phrases
    const redundant = [
      { pattern: /please note that/gi, replacement: '', improvement: 'Removed redundant phrase "please note that"' },
      { pattern: /it should be noted that/gi, replacement: '', improvement: 'Removed wordy phrase' },
      { pattern: /in order to/gi, replacement: 'to', improvement: 'Simplified "in order to" to "to"' }
    ];

    redundant.forEach(({pattern, replacement, improvement}) => {
      if (pattern.test(optimized)) {
        optimized = optimized.replace(pattern, replacement);
        improvements.push(improvement);
      }
    });

    return { text: optimized, improvements };
  }

  private improveCreativity(prompt: string): {text: string; improvements: string[]} {
    let optimized = prompt;
    const improvements: string[] = [];

    // Add creative prompts
    if (!/creative|innovative|unique|original/i.test(optimized)) {
      optimized += '\n\nBe creative and think outside the box in your response.';
      improvements.push('Added creativity encouragement');
    }

    return { text: optimized, improvements };
  }

  private applyProviderOptimizations(prompt: string, provider: string): {text: string; improvements: string[]} {
    let optimized = prompt;
    const improvements: string[] = [];

    // Provider-specific optimizations
    switch (provider) {
      case 'openai':
        if (!prompt.includes('step by step')) {
          optimized += '\n\nThink step by step.';
          improvements.push('Added step-by-step instruction for OpenAI');
        }
        break;
      case 'claude':
        if (!prompt.includes('careful') && !prompt.includes('thorough')) {
          optimized += '\n\nPlease be thorough and careful in your analysis.';
          improvements.push('Added thoroughness instruction for Claude');
        }
        break;
    }

    return { text: optimized, improvements };
  }

  private calculateTemplateRelevance(query: string, template: PromptTemplate): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const templateWords = (template.name + ' ' + template.description).toLowerCase().split(/\s+/);
    
    const commonWords = queryWords.filter(word => templateWords.includes(word));
    return commonWords.length / Math.max(queryWords.length, 1);
  }

  private estimatePerformanceGain(original: PromptAnalysis, optimized: PromptAnalysis): number {
    const improvement = optimized.overall - original.overall;
    return Math.min(1, improvement * 2); // Scale to represent percentage gain
  }

  private generateOptimizationReasoning(improvements: string[], scoreImprovement: number): string {
    if (improvements.length === 0) {
      return 'No significant improvements identified.';
    }

    const impact = scoreImprovement > 0.2 ? 'significant' : 
                   scoreImprovement > 0.1 ? 'moderate' : 'minor';
    
    return `Applied ${improvements.length} improvements resulting in ${impact} enhancement: ${improvements.slice(0, 3).join(', ')}${improvements.length > 3 ? ', and more' : ''}.`;
  }

  // Template and pattern methods
  private initializePatterns(): void {
    this.knownPatterns.set('question', /what|how|when|where|why|which/i);
    this.knownPatterns.set('instruction', /create|generate|write|analyze|explain/i);
    this.knownPatterns.set('creative', /story|poem|creative|imagine|invent/i);
    this.knownPatterns.set('technical', /code|function|algorithm|debug|implement/i);
  }

  private loadDefaultTemplates(): void {
    const defaultTemplates: PromptTemplate[] = [
      {
        id: 'analysis_template',
        name: 'Analysis Template',
        category: 'analytical',
        description: 'Structured template for analytical tasks',
        template: `Analyze the following {{subject}}:

Context: {{context}}

Please provide:
1. Key findings
2. Implications
3. Recommendations

Format your response with clear headings and bullet points.`,
        variables: ['subject', 'context'],
        examples: [],
        effectiveness: 0.85,
        usageCount: 0
      },
      {
        id: 'creative_writing',
        name: 'Creative Writing Template',
        category: 'creative',
        description: 'Template for creative writing tasks',
        template: `Write a {{type}} about {{topic}}.

Style: {{style}}
Length: {{length}}
Audience: {{audience}}

Requirements:
- {{requirement1}}
- {{requirement2}}

Be creative and engaging in your approach.`,
        variables: ['type', 'topic', 'style', 'length', 'audience', 'requirement1', 'requirement2'],
        examples: [],
        effectiveness: 0.8,
        usageCount: 0
      }
    ];

    defaultTemplates.forEach(template => {
      this.templates.set(template.id, template);
    });
  }

  // Additional helper methods for variations
  private rephrasePROMPT(prompt: string, variation: number): string {
    // Simple rephrasing by changing sentence structure
    // This is a simplified version - real implementation would use more advanced NLP
    const variations = [
      (p: string) => p.replace(/Please/, 'I need you to'),
      (p: string) => p.replace(/Can you/, 'I would like you to'),
      (p: string) => p.replace(/Explain/, 'Describe')
    ];
    
    const varFn = variations[variation % variations.length];
    return varFn ? varFn(prompt) : prompt;
  }

  private addStructure(prompt: string): string {
    if (this.hasSections(prompt)) return prompt;
    
    return `## Task
${prompt}

## Requirements
- Be comprehensive and accurate
- Use clear examples where appropriate
- Structure your response logically

## Output Format
Please organize your response with clear headings and sections.`;
  }

  private addDetail(prompt: string): string {
    return `${prompt}

Please provide a detailed response that includes:
- Background context and reasoning
- Step-by-step explanation where applicable
- Relevant examples to illustrate points
- Potential alternative approaches or considerations`;
  }

  private makeConcise(prompt: string): string {
    // Remove unnecessary words and phrases
    let concise = prompt
      .replace(/please note that/gi, '')
      .replace(/it should be noted that/gi, '')
      .replace(/in order to/gi, 'to')
      .replace(/for the purpose of/gi, 'to')
      .replace(/\s+/g, ' ')
      .trim();
    
    return concise;
  }

  private identifySuccessPatterns(prompt: string, responses: Array<{response: string; rating: number}>): string[] {
    // Analyze patterns in successful responses
    // This is simplified - real implementation would use more advanced pattern recognition
    const patterns: string[] = [];
    
    if (responses.some(r => r.response.includes('step'))) {
      patterns.push('Step-by-step responses tend to be highly rated');
    }
    
    if (responses.some(r => r.response.length > 500)) {
      patterns.push('Detailed responses generally receive better ratings');
    }
    
    return patterns;
  }

  private generateEffectivenessRecommendations(
    prompt: string,
    averageRating: number,
    providerPerformance: Record<string, number>,
    patterns: string[]
  ): string[] {
    const recommendations: string[] = [];
    
    if (averageRating < 3.5) {
      recommendations.push('Consider adding more specific requirements to improve response quality');
    }
    
    const bestProvider = Object.entries(providerPerformance)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (bestProvider) {
      recommendations.push(`Consider using ${bestProvider[0]} for this type of prompt (highest performance: ${bestProvider[1].toFixed(2)})`);
    }
    
    patterns.forEach(pattern => {
      recommendations.push(`Based on analysis: ${pattern}`);
    });
    
    return recommendations;
  }
}

// Export singleton instance
export const promptAssistant = new PromptEngineeringAssistant();
export type { PromptAnalysis, PromptIssue, PromptSuggestion, PromptTemplate, OptimizationResult };