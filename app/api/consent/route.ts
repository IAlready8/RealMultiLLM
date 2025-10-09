/**
 * Consent Management API Route
 * Handles consent operations for GDPR/CCPA compliance
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { getConsentService } from '../../../services/consent-service';
import { ValidationError, AppError } from '../../../lib/error-system';
import prisma from '../../../lib/prisma';
import { auditLogger } from '../../../lib/audit-logger';
import { ConsentCategory } from '../../../types/compliance';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `consent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Get session to identify user (outside try block to make available in catch)
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  try {
    // Initialize consent service
    const consentService = getConsentService(prisma);

    // Get consent status or list of consents
    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get('category');
    const statusParam = searchParams.get('status') as any;
    
    if (categoryParam) {
      // Get status for a specific category
      const hasConsent = await consentService.hasConsent(
        userId, 
        categoryParam as ConsentCategory
      );
      return NextResponse.json({ category: categoryParam, hasConsent });
    } else {
      // Get all consents with filters
      const filter = {
        userId,
        category: categoryParam as ConsentCategory,
        status: statusParam,
        limit: searchParams.get('limit') ? parseInt(searchParams.get('limit') as string) : undefined,
        offset: searchParams.get('offset') ? parseInt(searchParams.get('offset') as string) : undefined,
      };
      
      const consents = await consentService.getConsents(filter);
      return NextResponse.json(consents);
    }
  } catch (error) {
    const ms = Date.now() - startTime;
    console.error('Consent API error:', error);

    await auditLogger.logSecurityEvent(
      'consent_api_error',
      'failure',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        ms,
      },
      {
        userId: userId || 'unknown',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent') || null,
        correlationId: requestId,
      },
      'high'
    );

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 400 });
    }

    if (error instanceof AppError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 500 });
    }

    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `consent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Get session to identify user (outside try block to make available in catch)
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  try {
    // Initialize consent service

    // Initialize consent service
    const consentService = getConsentService(prisma);

    const { category: categoryFromBody, consentText, version, requiresRenewal } = await request.json();

    if (!categoryFromBody || !consentText || !version) {
      throw new ValidationError('Category, consent text, and version are required', 'body', {
        endpoint: 'consent',
        timestamp: new Date(),
        metadata: { userId, category: categoryFromBody },
        requestId,
      });
    }

    const consentRequest = {
      userId,
      category: categoryFromBody as ConsentCategory,
      consentText,
      version,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
      userAgent: request.headers.get('user-agent') || null,
      requiresRenewal: requiresRenewal || false,
    };

    const newConsent = await consentService.recordConsent(consentRequest);

    await auditLogger.logSecurityEvent(
      'consent_recorded',
      'success',
      {
        userId,
        consentId: newConsent.id,
        category: consentRequest.category,
      },
      {
        userId,
        ipAddress: consentRequest.ipAddress || null,
        userAgent: consentRequest.userAgent || null,
        correlationId: requestId,
      },
      'low'
    );

    return NextResponse.json(newConsent);
  } catch (error) {
    const ms = Date.now() - startTime;
    console.error('Consent API error:', error);

    await auditLogger.logSecurityEvent(
      'consent_api_error',
      'failure',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        ms,
      },
      {
        userId: userId || 'unknown',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent') || null,
        correlationId: requestId,
      },
      'high'
    );

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 400 });
    }

    if (error instanceof AppError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 500 });
    }

    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `consent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Get session to identify user (outside try block to make available in catch)
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  try {
    // Initialize consent service

    // Initialize consent service
    const consentService = getConsentService(prisma);

    const { categoryId, newConsentText, newVersion } = await request.json();

    if (!categoryId || !newConsentText || !newVersion) {
      throw new ValidationError('Consent category, new consent text, and new version are required', 'body', {
        endpoint: 'consent',
        timestamp: new Date(),
        metadata: { userId, categoryId },
        requestId,
      });
    }

    const renewedConsent = await consentService.renewConsent(
      userId,
      categoryId as ConsentCategory,
      newConsentText,
      newVersion
    );

    await auditLogger.logSecurityEvent(
      'consent_renewed',
      'success',
      {
        userId,
        consentId: renewedConsent.id,
        category: categoryId as ConsentCategory,
      },
      {
        userId,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent') || null,
        correlationId: requestId,
      },
      'low'
    );

    return NextResponse.json(renewedConsent);
  } catch (error) {
    const ms = Date.now() - startTime;
    console.error('Consent API error:', error);

    await auditLogger.logSecurityEvent(
      'consent_api_error',
      'failure',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        ms,
      },
      {
        userId: userId || 'unknown',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent') || null,
        correlationId: requestId,
      },
      'high'
    );

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 400 });
    }

    if (error instanceof AppError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 500 });
    }

    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `consent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Get session to identify user (outside try block to make available in catch)
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });
  }

  try {
    // Initialize consent service
    const consentService = getConsentService(prisma);

    // Extract consentId from URL
    const { searchParams } = new URL(request.url);
    const consentId = searchParams.get('consentId');

    if (!consentId) {
      throw new ValidationError('Consent ID is required', 'consentId', {
        endpoint: 'consent',
        timestamp: new Date(),
        metadata: { userId, consentId },
        requestId,
      });
    }

    const withdrawnConsent = await consentService.withdrawConsent(userId, consentId);

    await auditLogger.logSecurityEvent(
      'consent_withdrawn',
      'success',
      {
        userId,
        consentId,
      },
      {
        userId,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent') || null,
        correlationId: requestId,
      },
      'medium'
    );

    return NextResponse.json(withdrawnConsent);
  } catch (error) {
    const ms = Date.now() - startTime;
    console.error('Consent API error:', error);

    await auditLogger.logSecurityEvent(
      'consent_api_error',
      'failure',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        ms,
      },
      {
        userId: userId || 'unknown',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent') || null,
        correlationId: requestId,
      },
      'high'
    );

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 400 });
    }

    if (error instanceof AppError) {
      return NextResponse.json({ error: { message: error.message } }, { status: 500 });
    }

    return NextResponse.json({ error: { message: 'Internal server error' } }, { status: 500 });
  }
}