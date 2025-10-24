import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { dataDeletionService } from '@/services/compliance/data-deletion-service';
import { AppError, ValidationError } from '@/lib/error-system';
import { auditLogger } from '@/lib/audit-logger';
import { hasPermission } from '@/lib/rbac';

/**
 * Compliance API route for executing user data deletion (GDPR/CCPA)
 * POST /api/compliance/deletion/:id/execute - Execute a previously requested deletion
 * Requires admin privileges due to the irreversible nature of this operation
 */

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    const { id: deletionId } = await params;
    const deletionRecordId = deletionId;
    const endpoint = 'compliance.deletion.execute';

    // Check admin permissions (required for execution)
    const isAdmin = await hasPermission(userId, 'admin:write', { 
      resource: 'compliance', 
      action: 'execute_deletion' 
    });

    if (!isAdmin) {
      await auditLogger.logSecurityEvent(
        'deletion_execute_denied',
        'failure',
        {
          userId,
          deletionRecordId,
          reason: 'Admin privileges required for data deletion execution'
        },
        {
          userId,
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
          userAgent: request.headers.get('user-agent') || null,
          correlationId: requestId
        },
        'critical'
      );

      return NextResponse.json(
        { error: { message: 'Admin privileges required for data deletion execution' } },
        { status: 403 }
      );
    }

    // Parse request body for execution options
    const body = await request.json();
    const { options = {} } = body;

    // Validate deletion record ID
    if (!deletionRecordId) {
      throw new ValidationError('Invalid deletion record ID', 'deletionRecordId', {
        endpoint,
        timestamp: new Date(),
        metadata: { userId, deletionRecordId }
      });
    }

    // Log the deletion execution start
    await auditLogger.logSecurityEvent(
      'deletion_execute_started',
      'success',
      {
        userId,
        deletionRecordId,
        options
      },
      {
        userId,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent') || null,
        correlationId: requestId
      },
      'critical'
    );

    // Execute data deletion
    await dataDeletionService.executeDataDeletion(userId, deletionRecordId, options);

    const ms = Date.now() - startTime;
    
    // Log successful deletion execution
    await auditLogger.logSecurityEvent(
      'deletion_execute_completed',
      'success',
      {
        userId,
        deletionRecordId,
        ms
      },
      {
        userId,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent') || null,
        correlationId: requestId
      },
      'critical'
    );

    return NextResponse.json({ 
      success: true, 
      message: 'User data deletion completed successfully',
      deletionRecordId 
    });
  } catch (error) {
    const ms = Date.now() - startTime;
    console.error('Data deletion execution failed:', error);

    // Log failed deletion execution
    await auditLogger.logSecurityEvent(
      'deletion_execute_failed',
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
      { error: { message: 'Internal server error during data deletion execution' } },
      { status: 500 }
    );
  }
}