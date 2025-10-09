import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { dataExportService } from '@/services/compliance/data-export-service';
import { AppError, ValidationError } from '@/lib/error-system';
import { auditLogger } from '@/lib/audit-logger';
import { hasPermission } from '@/lib/rbac';

/**
 * Compliance API route for exporting user data (GDPR/CCPA)
 * GET /api/compliance/export - Export user's personal data
 */

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
    const hasExportPermission = await hasPermission(userId, 'compliance.manage', { 
      resource: 'compliance', 
      action: 'export' 
    });

    if (!hasExportPermission) {
      await auditLogger.logSecurityEvent(
        'compliance_export_denied',
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
        { error: { message: 'Insufficient permissions for compliance export' } },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'json';
    const anonymize = searchParams.get('anonymize') === 'true';
    const includePersonas = searchParams.get('includePersonas') !== 'false';
    const includeConversations = searchParams.get('includeConversations') !== 'false';
    const includeProviders = searchParams.get('includeProviders') !== 'false';
    const includeTeams = searchParams.get('includeTeams') !== 'false';
    const includeAuditLogs = searchParams.get('includeAuditLogs') === 'true';
    const includeAnalytics = searchParams.get('includeAnalytics') !== 'false';
    const includeSettings = searchParams.get('includeSettings') !== 'false';

    // Log the export request
    await auditLogger.logSecurityEvent(
      'compliance_export_requested',
      'success',
      {
        userId,
        format,
        anonymize,
        options: {
          includePersonas,
          includeConversations,
          includeProviders,
          includeTeams,
          includeAuditLogs,
          includeAnalytics,
          includeSettings
        }
      },
      {
        userId,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null,
        userAgent: request.headers.get('user-agent') || null,
        correlationId: requestId
      },
      'medium'
    );

    // Export user data
    const exportData = await dataExportService.exportUserData(userId, {
      format: format as 'json' | 'csv',
      anonymize,
      includePersonas,
      includeConversations,
      includeProviders,
      includeTeams,
      includeAuditLogs,
      includeAnalytics,
      includeSettings
    });

    const ms = Date.now() - startTime;
    
    // Log successful export
    await auditLogger.logSecurityEvent(
      'compliance_export_completed',
      'success',
      {
        userId,
        format,
        dataSize: JSON.stringify(exportData).length,
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

    // Return the exported data
    if (format === 'csv') {
      const csvData = await dataExportService.exportUserDataAsCSV(userId, {
        anonymize,
        includePersonas,
        includeConversations,
        includeProviders,
        includeTeams,
        includeAuditLogs,
        includeAnalytics,
        includeSettings
      });

      return new NextResponse(csvData, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="user-data-export-${userId}-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    } else {
      return NextResponse.json(exportData, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="user-data-export-${userId}-${new Date().toISOString().split('T')[0]}.json"`
        }
      });
    }
  } catch (error) {
    const ms = Date.now() - startTime;
    console.error('Compliance export failed:', error);

    // Log failed export
    await auditLogger.logSecurityEvent(
      'compliance_export_failed',
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
      { error: { message: 'Internal server error during compliance export' } },
      { status: 500 }
    );
  }
}