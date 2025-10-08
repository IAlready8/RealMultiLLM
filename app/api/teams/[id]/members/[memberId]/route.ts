import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { removeTeamMember } from '@/services/team-service';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id, memberId } = await params;
    
    // Only allow removing yourself or if you're an admin
    if (session.user.id !== memberId) {
      // Check if user is team admin
      // This would require implementing a function to check team membership roles
      // For now, we'll let the service handle this logic
    }

    await removeTeamMember(id, session.user.id, memberId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Remove team member error:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Failed to remove member' },
      { status: 400 }
    );
  }
}