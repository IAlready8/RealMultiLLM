/**
 * Cost Tracking Module
 * Tracks and aggregates LLM usage costs per user/team
 */

import prisma from '@/lib/prisma';

/**
 * Pricing map for LLM providers (USD per 1M tokens)
 * Updated periodically - should be moved to database for dynamic updates
 */
export const PRICING_MAP: Record<string, any> = {
  'openai': {
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
  },
  'anthropic': {
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
    'claude-3-5-haiku-20241022': { input: 0.80, output: 4.00 },
    'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
  },
  'google': {
    'gemini-2.0-flash-exp': { input: 0.00, output: 0.00 }, // Free tier
    'gemini-1.5-pro': { input: 1.25, output: 5.00 },
    'gemini-1.5-flash': { input: 0.075, output: 0.30 },
  },
  'openrouter': {
    'default': { input: 0.50, output: 1.50 }, // Average fallback
  },
  'grok': {
    'grok-beta': { input: 5.00, output: 15.00 },
  },
};

interface CostMetadata {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

/**
 * Calculate cost for a given LLM request
 */
export function calculateCost(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number
): CostMetadata {
  const providerPricing = PRICING_MAP[provider as keyof typeof PRICING_MAP];
  let pricing = { input: 0, output: 0 };

  if (providerPricing) {
    if (typeof providerPricing === 'object' && 'input' in providerPricing) {
      pricing = providerPricing as { input: number; output: number };
    } else {
      const modelPricing = (providerPricing as any)[model];
      if (modelPricing) {
        pricing = modelPricing;
      }
    }
  }

  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  const totalCost = inputCost + outputCost;

  return {
    provider,
    model,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    inputCost,
    outputCost,
    totalCost,
  };
}

/**
 * Track cost to analytics database
 */
export async function trackCost(
  userId: string,
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number
): Promise<void> {
  const costData = calculateCost(provider, model, promptTokens, completionTokens);

  await prisma.analytics.create({
    data: {
      userId,
      event: 'llm_cost',
      payload: JSON.stringify(costData),
    },
  });
}

/**
 * Get cost summary for a user
 */
export async function getUserCostSummary(
  userId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalCost: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
  totalTokens: number;
}> {
  const where: any = {
    userId,
    event: 'llm_cost',
  };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = startDate;
    if (endDate) where.createdAt.lte = endDate;
  }

  const records = await prisma.analytics.findMany({ where });

  let totalCost = 0;
  let totalTokens = 0;
  const byProvider: Record<string, number> = {};
  const byModel: Record<string, number> = {};

  for (const record of records) {
    if (!record.payload) continue;

    try {
      const data: CostMetadata = JSON.parse(record.payload);
      totalCost += data.totalCost;
      totalTokens += data.totalTokens;

      byProvider[data.provider] = (byProvider[data.provider] || 0) + data.totalCost;
      byModel[data.model] = (byModel[data.model] || 0) + data.totalCost;
    } catch (error) {
      console.error('Failed to parse cost record:', error);
    }
  }

  return {
    totalCost,
    byProvider,
    byModel,
    totalTokens,
  };
}

/**
 * Get team cost summary (aggregates all team members)
 */
export async function getTeamCostSummary(
  teamId: string,
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalCost: number;
  byUser: Record<string, number>;
  byProvider: Record<string, number>;
  totalTokens: number;
}> {
  // Get all team members
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        select: { userId: true },
      },
    },
  });

  if (!team) {
    throw new Error('Team not found');
  }

  const userIds = team.members.map(m => m.userId);
  let totalCost = 0;
  let totalTokens = 0;
  const byUser: Record<string, number> = {};
  const byProvider: Record<string, number> = {};

  for (const userId of userIds) {
    const summary = await getUserCostSummary(userId, startDate, endDate);
    totalCost += summary.totalCost;
    totalTokens += summary.totalTokens;
    byUser[userId] = summary.totalCost;

    for (const [provider, cost] of Object.entries(summary.byProvider)) {
      byProvider[provider] = (byProvider[provider] || 0) + cost;
    }
  }

  return {
    totalCost,
    byUser,
    byProvider,
    totalTokens,
  };
}
