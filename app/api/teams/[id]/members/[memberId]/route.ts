import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { removeTeamMember, updateTeamMemberRole } from '@/services/team-service';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: teamId, memberId } = await params;
    
    // Validate that memberId is provided
    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    await removeTeamMember(teamId, session.user.id, memberId);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove member';
    console.error('Remove team member error:', message);
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: teamId, memberId } = await params;
    const body = await request.json();
    
    // Validate that memberId is provided
    if (!memberId) {
      return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
    }

    const member = await updateTeamMemberRole(teamId, session.user.id, memberId, body.role);
    return NextResponse.json(member);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update member role';
    console.error('Update team member role error:', message);
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}