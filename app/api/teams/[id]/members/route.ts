import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { addTeamMember, getTeamMembers } from '@/services/team-service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: _id } = await params;
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: teamId } = await params;
    const body = await request.json();
    
    // Validate required fields
    if (!body.userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const member = await addTeamMember(teamId, session.user.id, body);
    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to add member';
    console.error('Add team member error:', message);
    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: teamId } = await params;
    const members = await getTeamMembers(teamId, session.user.id);
    
    return NextResponse.json(members);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch team members';
    console.error('Get team members error:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}