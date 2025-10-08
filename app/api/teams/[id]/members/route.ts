import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getTeamMembers } from '@/services/team-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const members = await getTeamMembers(id, session.user.id);
    
    return NextResponse.json(members);
  } catch (error: any) {
    console.error('Get team members error:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Failed to fetch team members' },
      { status: 500 }
    );
  }
}