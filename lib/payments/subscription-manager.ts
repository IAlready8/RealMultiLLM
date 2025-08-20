/**
 * Advanced Subscription Management System
 * - Real-time subscription state tracking with advanced analytics
 * - Revenue optimization through intelligent pricing strategies
 * - Scalable payment processing with comprehensive error handling
 */

import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  features: string[];
  limits: {
    requestsPerMonth: number;
    modelsAccess: string[];
    prioritySupport: boolean;
  };
}

interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed';
  metadata: Record<string, string>;
}

interface SubscriptionMetrics {
  mrr: number; // Monthly Recurring Revenue
  churnRate: number;
  upgrades: number;
  downgrades: number;
  newSubscriptions: number;
  cancelledSubscriptions: number;
}

class AdvancedSubscriptionManager {
  private prisma: PrismaClient;
  private stripe: Stripe;
  private readonly SUBSCRIPTION_TIERS: SubscriptionTier[] = [
    {
      id: 'free',
      name: 'Free Tier',
      price: 0,
      features: ['Basic chat', 'Limited models', 'Community support'],
      limits: {
        requestsPerMonth: 100,
        modelsAccess: ['openai:gpt-3.5-turbo', 'google:gemini-pro'],
        prioritySupport: false
      }
    },
    {
      id: 'pro',
      name: 'Professional',
      price: 29.99,
      features: ['All models', 'Priority support', 'Advanced analytics', 'Pipeline hub'],
      limits: {
        requestsPerMonth: 5000,
        modelsAccess: ['*'], // All models
        prioritySupport: true
      }
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 99.99,
      features: ['Unlimited requests', 'Custom models', 'Dedicated support', 'SSO'],
      limits: {
        requestsPerMonth: -1, // Unlimited
        modelsAccess: ['*'],
        prioritySupport: true
      }
    }
  ];

  constructor() {
    this.prisma = new PrismaClient();
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2025-07-30.basil'
    });
  }

  // Revenue optimization through intelligent subscription management
  async createSubscription(userId: string, tierId: string): Promise<{ subscriptionId: string; paymentUrl?: string }> {
    try {
      const tier = this.SUBSCRIPTION_TIERS.find(t => t.id === tierId);
      if (!tier) {
        throw new Error(`Invalid subscription tier: ${tierId}`);
      }

      // Performance optimization: Check existing subscription first
      const existingSubscription = await this.prisma.subscription.findFirst({
        where: { userId }
      });

      if (existingSubscription) {
        // Handle upgrade/downgrade scenario
        return await this.modifySubscription(userId, tierId);
      }

      // Create new subscription
      const subscription = await this.prisma.subscription.create({
        data: {
          userId,
          tier: tierId,
          status: tier.price === 0 ? 'active' : 'pending',
          startDate: new Date(),
          endDate: this.calculateEndDate(new Date()),
          metadata: JSON.stringify({
            features: tier.features,
            limits: tier.limits
          })
        }
      });

      // Create Stripe payment intent for paid tiers
      if (tier.price > 0) {
        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: Math.round(tier.price * 100), // Convert to cents
          currency: 'usd',
          metadata: {
            userId,
            subscriptionId: subscription.id,
            tier: tierId
          }
        });

        // Track analytics event for subscription creation
        await this.trackSubscriptionEvent(userId, 'subscription_created', {
          tier: tierId,
          amount: tier.price,
          paymentIntentId: paymentIntent.id
        });

        return {
          subscriptionId: subscription.id,
          paymentUrl: paymentIntent.client_secret || undefined
        };
      }

      await this.trackSubscriptionEvent(userId, 'free_subscription_activated', { tier: tierId });

      return { subscriptionId: subscription.id };
    } catch (error) {
      console.error('Subscription creation error:', error);
      throw new Error(`Failed to create subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Advanced subscription modification with revenue impact analysis
  async modifySubscription(userId: string, newTierId: string): Promise<{ subscriptionId: string; paymentUrl?: string }> {
    try {
      const currentSubscription = await this.prisma.subscription.findFirst({
        where: { userId }
      });

      if (!currentSubscription) {
        throw new Error('No existing subscription found');
      }

      const newTier = this.SUBSCRIPTION_TIERS.find(t => t.id === newTierId);
      const currentTier = this.SUBSCRIPTION_TIERS.find(t => t.id === currentSubscription.tier);

      if (!newTier || !currentTier) {
        throw new Error('Invalid tier configuration');
      }

      // Calculate prorated amount for upgrade/downgrade
      const proratedAmount = this.calculateProratedAmount(
        currentTier,
        newTier,
        currentSubscription.startDate,
        currentSubscription.endDate || new Date()
      );

      // Update subscription
      const updatedSubscription = await this.prisma.subscription.update({
        where: { id: currentSubscription.id },
        data: {
          tier: newTierId,
          status: newTier.price === 0 ? 'active' : 'pending',
          metadata: JSON.stringify({
            features: newTier.features,
            limits: newTier.limits,
            previousTier: currentTier.id
          })
        }
      });

      // Handle payment for upgrades
      if (proratedAmount > 0) {
        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: Math.round(proratedAmount * 100),
          currency: 'usd',
          metadata: {
            userId,
            subscriptionId: updatedSubscription.id,
            type: 'upgrade',
            newTier: newTierId,
            previousTier: currentTier.id
          }
        });

        await this.trackSubscriptionEvent(userId, 'subscription_upgraded', {
          fromTier: currentTier.id,
          toTier: newTierId,
          proratedAmount
        });

        return {
          subscriptionId: updatedSubscription.id,
          paymentUrl: paymentIntent.client_secret || undefined
        };
      }

      // Handle downgrades (credit handling would be implemented here)
      await this.trackSubscriptionEvent(userId, proratedAmount < 0 ? 'subscription_downgraded' : 'subscription_modified', {
        fromTier: currentTier.id,
        toTier: newTierId,
        creditAmount: Math.abs(proratedAmount)
      });

      return { subscriptionId: updatedSubscription.id };
    } catch (error) {
      console.error('Subscription modification error:', error);
      throw new Error(`Failed to modify subscription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Real-time subscription validation for API access control
  async validateSubscription(userId: string, requiredFeature?: string): Promise<{ valid: boolean; tier: SubscriptionTier | null; remainingRequests?: number }> {
    try {
      const subscription = await this.prisma.subscription.findFirst({
        where: { userId }
      });

      if (!subscription || subscription.status !== 'active') {
        return { valid: false, tier: null };
      }

      const tier = this.SUBSCRIPTION_TIERS.find(t => t.id === subscription.tier);
      if (!tier) {
        return { valid: false, tier: null };
      }

      // Check subscription expiry
      if (subscription.endDate && new Date() > subscription.endDate) {
        await this.prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'expired' }
        });
        return { valid: false, tier };
      }

      // Check usage limits
      const currentUsage = await this.getCurrentMonthUsage(userId);
      const hasRemainingRequests = tier.limits.requestsPerMonth === -1 || currentUsage < tier.limits.requestsPerMonth;

      if (!hasRemainingRequests) {
        return { valid: false, tier, remainingRequests: 0 };
      }

      return {
        valid: true,
        tier,
        remainingRequests: tier.limits.requestsPerMonth === -1 ? -1 : tier.limits.requestsPerMonth - currentUsage
      };
    } catch (error) {
      console.error('Subscription validation error:', error);
      return { valid: false, tier: null };
    }
  }

  // Advanced analytics for revenue optimization
  async getSubscriptionMetrics(timeframe: 'month' | 'quarter' | 'year'): Promise<SubscriptionMetrics> {
    try {
      const startDate = this.getStartDateForTimeframe(timeframe);
      
      const [subscriptions, analytics] = await Promise.all([
        this.prisma.subscription.findMany({
          where: {
            createdAt: { gte: startDate }
          }
        }),
        this.prisma.analyticsEvent.findMany({
          where: {
            event: { in: ['subscription_created', 'subscription_cancelled', 'subscription_upgraded', 'subscription_downgraded'] },
            timestamp: { gte: startDate }
          }
        })
      ]);

      // Calculate MRR (Monthly Recurring Revenue)
      const activePaidSubscriptions = subscriptions.filter(s => s.status === 'active' && s.tier !== 'free');
      const mrr = activePaidSubscriptions.reduce((total, sub) => {
        const tier = this.SUBSCRIPTION_TIERS.find(t => t.id === sub.tier);
        return total + (tier?.price || 0);
      }, 0);

      // Calculate churn rate
      const totalSubscriptions = subscriptions.length;
      const cancelledSubscriptions = analytics.filter(e => e.event === 'subscription_cancelled').length;
      const churnRate = totalSubscriptions > 0 ? (cancelledSubscriptions / totalSubscriptions) * 100 : 0;

      // Count subscription changes
      const upgrades = analytics.filter(e => e.event === 'subscription_upgraded').length;
      const downgrades = analytics.filter(e => e.event === 'subscription_downgraded').length;
      const newSubscriptions = analytics.filter(e => e.event === 'subscription_created').length;

      return {
        mrr,
        churnRate,
        upgrades,
        downgrades,
        newSubscriptions,
        cancelledSubscriptions
      };
    } catch (error) {
      console.error('Metrics calculation error:', error);
      return {
        mrr: 0,
        churnRate: 0,
        upgrades: 0,
        downgrades: 0,
        newSubscriptions: 0,
        cancelledSubscriptions: 0
      };
    }
  }

  // Webhook handler for Stripe events
  async handleStripeWebhook(event: any): Promise<void> {
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailure(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await this.handleRecurringPayment(event.data.object);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Webhook processing error:', error);
      throw error;
    }
  }

  // Helper methods
  private async handlePaymentSuccess(paymentIntent: any): Promise<void> {
    const { userId, subscriptionId } = paymentIntent.metadata;
    
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'active' }
    });

    await this.trackSubscriptionEvent(userId, 'payment_succeeded', {
      amount: paymentIntent.amount / 100,
      paymentIntentId: paymentIntent.id
    });
  }

  private async handlePaymentFailure(paymentIntent: any): Promise<void> {
    const { userId, subscriptionId } = paymentIntent.metadata;
    
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'payment_failed' }
    });

    await this.trackSubscriptionEvent(userId, 'payment_failed', {
      amount: paymentIntent.amount / 100,
      paymentIntentId: paymentIntent.id,
      errorCode: paymentIntent.last_payment_error?.code
    });
  }

  private async handleRecurringPayment(invoice: any): Promise<void> {
    // Handle recurring subscription payments
    const customerId = invoice.customer;
    // Implementation would link Stripe customer to our user
  }

  private calculateProratedAmount(currentTier: SubscriptionTier, newTier: SubscriptionTier, startDate: Date, endDate: Date): number {
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    const dailyRateNew = newTier.price / 30; // Assuming 30-day month
    const dailyRateCurrent = currentTier.price / 30;
    
    return (dailyRateNew - dailyRateCurrent) * remainingDays;
  }

  private calculateEndDate(startDate: Date): Date {
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    return endDate;
  }

  private async getCurrentMonthUsage(userId: string): Promise<number> {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const events = await this.prisma.analyticsEvent.findMany({
      where: {
        userId,
        event: 'llm_request',
        timestamp: { gte: startOfMonth }
      }
    });

    return events.length;
  }

  private getStartDateForTimeframe(timeframe: string): Date {
    const now = new Date();
    switch (timeframe) {
      case 'month':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        return new Date(now.getFullYear(), quarter * 3, 1);
      case 'year':
        return new Date(now.getFullYear(), 0, 1);
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }

  private async trackSubscriptionEvent(userId: string, eventName: string, payload: any): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          event: eventName,
          payload,
          userId,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Failed to track subscription event:', error);
    }
  }

  // Public getter for subscription tiers
  getSubscriptionTiers(): SubscriptionTier[] {
    return this.SUBSCRIPTION_TIERS;
  }
}

export { AdvancedSubscriptionManager };
export type { SubscriptionTier, PaymentIntent, SubscriptionMetrics };