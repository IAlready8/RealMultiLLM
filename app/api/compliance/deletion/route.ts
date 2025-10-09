import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { dataDeletionService } from '@/services/compliance/data-deletion-service';
import { AppError, ValidationError } from '@/lib/error-system';
import { auditLogger } from '@/lib/audit-logger';
import { hasPermission } from '@/lib/rbac';

/**
 * Compliance API route for requesting and managing user data deletion (GDPR/CCPA)
 * POST /api/compliance/deletion - Request user data deletion
 * GET /api/compliance/deletion - Get user's deletion records
 * PUT /api/compliance/deletion/:id - Cancel a deletion request
 */

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const endpoint = '/api/compliance/deletion';
  let userId = 'unknown';

  try {
    // Get user session
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    userId = session.user.id;
    

    // Check permissions
    const hasDeletionPermission = await hasPermission(userId, 'compliance.manage', { 
      resource: 'compliance', 
      action: 'delete' 
    });

    if (!hasDeletionPermission) {
      await auditLogger.logSecurityEvent(
        'deletion_request_denied',
        'failure',
        {
          userId,
          reason: 'Insufficient permissions'
        },
        {
          userId,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          userAgent: request.headers.get('user-agent') || null,
          correlationId: requestId
        },
        'high'
      );

      return NextResponse.json(
        { error: { message: 'Insufficient permissions for data deletion' } },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { reason, options = {} } = body;

    // Validate request
    if (reason && typeof reason !== 'string') {
      throw new ValidationError('Invalid reason parameter', 'reason', {
        endpoint,
        timestamp: new Date(),
        metadata: { userId, reason }
      });
    }

    // Log the deletion request
    await auditLogger.logSecurityEvent(
      'deletion_requested',
      'success',
      {
        userId,
        reason,
        options
      },
      {
        userId,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent') || null,
        correlationId: requestId
      },
      'high'
    );

    // Request data deletion
    const deletionRecord = await dataDeletionService.requestDataDeletion(userId, options, reason);

    const ms = Date.now() - startTime;
    
    // Log successful deletion request
    await auditLogger.logSecurityEvent(
      'deletion_request_completed',
      'success',
      {
        userId,
        deletionRecordId: deletionRecord.id,
        ms
      },
      {
        userId,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent') || null,
        correlationId: requestId
      },
      'medium'
    );

    return NextResponse.json(deletionRecord);
  } catch (error) {
    const ms = Date.now() - startTime;
    console.error('Data deletion request failed:', error);

    // Log failed deletion request
    await auditLogger.logSecurityEvent(
      'deletion_request_failed',
      'failure',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        ms
      },
      {
        userId: userId,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent') || null,
        correlationId: requestId
      },
      'critical'
    );

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 400 }
      );
    }

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: { message: 'Internal server error during data deletion request' } },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  let userId = 'unknown';

  try {
    // Get user session
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    userId = session.user.id;
    

    // Check permissions
    const hasViewPermission = await hasPermission(userId, 'compliance.manage', { 
      resource: 'compliance', 
      action: 'view' 
    });

    if (!hasViewPermission) {
      await auditLogger.logSecurityEvent(
        'deletion_list_denied',
        'failure',
        {
          userId,
          reason: 'Insufficient permissions'
        },
        {
          userId,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          userAgent: request.headers.get('user-agent') || null,
          correlationId: requestId
        },
        'high'
      );

      return NextResponse.json(
        { error: { message: 'Insufficient permissions to view deletion records' } },
        { status: 403 }
      );
    }

    // Get deletion records
    const deletionRecords = await dataDeletionService.getDeletionRecords(userId);

    const ms = Date.now() - startTime;
    
    // Log successful retrieval
    await auditLogger.logSecurityEvent(
      'deletion_list_completed',
      'success',
      {
        userId,
        recordCount: deletionRecords.length,
        ms
      },
      {
        userId,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent') || null,
        correlationId: requestId
      },
      'low'
    );

    return NextResponse.json(deletionRecords);
  } catch (error) {
    const ms = Date.now() - startTime;
    console.error('Failed to retrieve deletion records:', error);

    // Log failed retrieval
    await auditLogger.logSecurityEvent(
      'deletion_list_failed',
      'failure',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        ms
      },
      {
        userId: userId,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent') || null,
        correlationId: requestId
      },
      'high'
    );

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 400 }
      );
    }

    if (error instanceof AppError) {
      return NextResponse.json(
        { error: { message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: { message: 'Internal server error retrieving deletion records' } },
      { status: 500 }
    );
  }
}