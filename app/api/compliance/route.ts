import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getComplianceService } from '@/services/compliance/compliance-service';
import { AppError, ValidationError } from '@/lib/error-system';
import { auditLogger } from '@/lib/audit-logger';
import { hasPermission } from '@/lib/rbac';
import prisma from '@/lib/prisma';

/**
 * Main compliance API route handler
 * Routes:
 * GET /api/compliance - Get compliance status and metrics
 * POST /api/compliance/export - Request data export
 * POST /api/compliance/deletion - Request data deletion
 * GET /api/compliance/logs - Get audit logs
 * GET /api/compliance/config - Get compliance configuration
 * PUT /api/compliance/config - Update compliance configuration
 */

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Get user session (available in both try and catch blocks)
  const session = await getServerSession(authOptions);

  try {
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    

    // Check permissions
    const hasViewPermission = await hasPermission(userId, 'compliance.view', { 
      resource: 'compliance', 
      action: 'view' 
    });

    if (!hasViewPermission) {
      await auditLogger.logSecurityEvent(
        'compliance_status_denied',
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
        { error: { message: 'Insufficient permissions for compliance status' } },
        { status: 403 }
      );
    }

    // Get compliance service
    const complianceService = getComplianceService(prisma);

    // Parse query parameters for filters
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'status';
    
    switch (action) {
      case 'status':
        // Get compliance status and metrics
        const metrics = await complianceService.getComplianceStats();
        
        const ms = Date.now() - startTime;
        await auditLogger.logSecurityEvent(
          'compliance_status_success',
          'success',
          {
            userId,
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

        return NextResponse.json({
          status: 'operational',
          metrics
        });

      case 'logs':
        // Get audit logs with filters
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');
        const category = searchParams.get('category') || undefined;
        
        
        const logs = await complianceService.getComplianceLogs({
          userId: searchParams.get('userId') || undefined,
          category,
          
          limit: Math.min(limit, 100), // Cap at 100
          offset
        });
        
        const logMs = Date.now() - startTime;
        await auditLogger.logSecurityEvent(
          'compliance_logs_success',
          'success',
          {
            userId,
            logCount: logs.length,
            ms: logMs
          },
          {
            userId,
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
            userAgent: request.headers.get('user-agent') || null,
            correlationId: requestId
          },
          'medium'
        );

        return NextResponse.json(logs);

      case 'config':
        // Get compliance configuration
        const config = await complianceService.getComplianceConfig(userId);
        
        const configMs = Date.now() - startTime;
        await auditLogger.logSecurityEvent(
          'compliance_config_success',
          'success',
          {
            userId,
            ms: configMs
          },
          {
            userId,
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
            userAgent: request.headers.get('user-agent') || null,
            correlationId: requestId
          },
          'low'
        );

        return NextResponse.json(config);

      default:
        return NextResponse.json(
          { error: { message: `Unknown action: ${action}` } },
          { status: 400 }
        );
    }
  } catch (error) {
    const ms = Date.now() - startTime;
    console.error('Compliance status failed:', error);

    await auditLogger.logSecurityEvent(
      'compliance_status_failed',
      'failure',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        ms
      },
      {
        userId: session?.user?.id || 'unknown',
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
      { error: { message: 'Internal server error retrieving compliance status' } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Get user session (available in both try and catch blocks)
  const session = await getServerSession(authOptions);

  try {
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    

    // Check basic permissions
    const hasManagePermission = await hasPermission(userId, 'compliance.manage', { 
      resource: 'compliance', 
      action: 'manage' 
    });

    if (!hasManagePermission) {
      await auditLogger.logSecurityEvent(
        'compliance_action_denied',
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
        { error: { message: 'Insufficient permissions for compliance actions' } },
        { status: 403 }
      );
    }

    // Get compliance service
    const complianceService = getComplianceService(prisma);

    // Parse request body
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'export':
        // Request data export
        const exportOptions = params.options || {};
        const exportData = await complianceService.exportUserData(userId, exportOptions);
        
        const exportMs = Date.now() - startTime;
        await auditLogger.logSecurityEvent(
          'compliance_export_success',
          'success',
          {
            userId,
            exportOptions,
            ms: exportMs
          },
          {
            userId,
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
            userAgent: request.headers.get('user-agent') || null,
            correlationId: requestId
          },
          'medium'
        );

        return NextResponse.json(exportData);

      case 'deletion':
        // Request data deletion
        const deletionReason = params.reason || undefined;
        const deletionOptions = params.options || {};
        const deletionRecord = await complianceService.requestDataDeletion(userId, deletionOptions, deletionReason);
        
        const deletionMs = Date.now() - startTime;
        await auditLogger.logSecurityEvent(
          'compliance_deletion_requested',
          'success',
          {
            userId,
            deletionRecordId: deletionRecord.id,
            reason: deletionReason,
            deletionOptions,
            ms: deletionMs
          },
          {
            userId,
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
            userAgent: request.headers.get('user-agent') || null,
            correlationId: requestId
          },
          'high'
        );

        return NextResponse.json(deletionRecord);

      case 'consent':
        // Record user consent
        const consentRecord = await complianceService.recordConsent(userId);
        
        const consentMs = Date.now() - startTime;
        await auditLogger.logSecurityEvent(
          'compliance_consent_recorded',
          'success',
          {
            userId,
            consentRecordId: consentRecord.id,
            ms: consentMs
          },
          {
            userId,
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
            userAgent: request.headers.get('user-agent') || null,
            correlationId: requestId
          },
          'medium'
        );

        return NextResponse.json(consentRecord);

      case 'withdraw_consent':
        // Withdraw user consent
        const withdrawnRecord = await complianceService.withdrawConsent(userId);
        
        const withdrawMs = Date.now() - startTime;
        await auditLogger.logSecurityEvent(
          'compliance_consent_withdrawn',
          'success',
          {
            userId,
            consentRecordId: withdrawnRecord.id,
            ms: withdrawMs
          },
          {
            userId,
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
            userAgent: request.headers.get('user-agent') || null,
            correlationId: requestId
          },
          'medium'
        );

        return NextResponse.json(withdrawnRecord);

      default:
        return NextResponse.json(
          { error: { message: `Unknown action: ${action}` } },
          { status: 400 }
        );
    }
  } catch (error) {
    const ms = Date.now() - startTime;
    console.error('Compliance action failed:', error);

    await auditLogger.logSecurityEvent(
      'compliance_action_failed',
      'failure',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        ms
      },
      {
        userId: session?.user?.id || 'unknown',
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
      { error: { message: 'Internal server error performing compliance action' } },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const endpoint = '/api/compliance';
  
  // Get user session (available in both try and catch blocks)
  const session = await getServerSession(authOptions);

  try {
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: { message: 'Unauthorized' } },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    

    // Check permissions
    const hasManagePermission = await hasPermission(userId, 'compliance.manage', { 
      resource: 'compliance', 
      action: 'manage' 
    });

    if (!hasManagePermission) {
      await auditLogger.logSecurityEvent(
        'compliance_update_denied',
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
        { error: { message: 'Insufficient permissions for compliance updates' } },
        { status: 403 }
      );
    }

    // Get compliance service
    const complianceService = getComplianceService(prisma);

    // Parse request body
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'config':
        // Update compliance configuration
        const configSettings = params.settings || {};
        const updatedConfig = await complianceService.updateComplianceConfig(userId, configSettings);
        
        const configMs = Date.now() - startTime;
        await auditLogger.logSecurityEvent(
          'compliance_config_updated',
          'success',
          {
            userId,
            configSettings,
            ms: configMs
          },
          {
            userId,
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
            userAgent: request.headers.get('user-agent') || null,
            correlationId: requestId
          },
          'medium'
        );

        return NextResponse.json(updatedConfig);

      case 'cancel_deletion':
        // Cancel a deletion request
        const { deletionRecordId } = params;
        if (!deletionRecordId) {
          throw new ValidationError('Missing deletionRecordId', 'deletionRecordId', {
            endpoint,
            timestamp: new Date(),
            metadata: { userId, deletionRecordId },
            requestId: userId
          });
        }

        const cancelledRecord = await complianceService.cancelDeletionRequest(userId, deletionRecordId);
        
        const cancelMs = Date.now() - startTime;
        await auditLogger.logSecurityEvent(
          'compliance_deletion_cancelled',
          'success',
          {
            userId,
            deletionRecordId,
            ms: cancelMs
          },
          {
            userId,
            ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
            userAgent: request.headers.get('user-agent') || null,
            correlationId: requestId
          },
          'medium'
        );

        return NextResponse.json(cancelledRecord);

      default:
        return NextResponse.json(
          { error: { message: `Unknown action: ${action}` } },
          { status: 400 }
        );
    }
  } catch (error) {
    const ms = Date.now() - startTime;
    console.error('Compliance update failed:', error);

    await auditLogger.logSecurityEvent(
      'compliance_update_failed',
      'failure',
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        ms
      },
      {
        userId: session?.user?.id || 'unknown',
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
      { error: { message: 'Internal server error updating compliance settings' } },
      { status: 500 }
    );
  }
}