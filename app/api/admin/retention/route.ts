import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireRole } from '@/lib/rbac';
import { enforceRetentionPolicy, getRetentionStats } from '@/lib/retention/data-retention';

/**
 * Data Retention Admin API
 * Allows admins to view retention stats and manually trigger cleanup
 */

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Require admin role
  const hasAdminRole = await requireRole(session.user.id, 'admin');
  if (!hasAdminRole) {
    return NextResponse.json({ error: 'Forbidden - admin role required' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '90', 10);

    const stats = await getRetentionStats(days);

    return NextResponse.json({
      stats,
      cutoffDays: days,
      cutoffDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get retention stats';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Require super-admin for manual deletion
  const hasSuperAdminRole = await requireRole(session.user.id, 'super-admin');
  if (!hasSuperAdminRole) {
    return NextResponse.json({ error: 'Forbidden - super-admin role required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { maxAgeDays, respectPins, dryRun } = body;

    const result = await enforceRetentionPolicy({
      maxAgeDays: maxAgeDays || 90,
      respectPins: respectPins !== false,
      dryRun: dryRun === true,
      batchSize: 1000,
    });

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to enforce retention policy';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
