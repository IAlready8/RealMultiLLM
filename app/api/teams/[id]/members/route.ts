import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  addTeamMember,
  removeTeamMember,
  updateTeamMemberRole,
} from '@/services/team-service';

async function ensureSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { userId: session.user.id };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await ensureSession();
  if ('error' in session) return session.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const member = await addTeamMember(id, session.userId, body);
    return NextResponse.json(member, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to add member' }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await ensureSession();
  if ('error' in session) return session.error;

  try {
    const { id } = await params;
    const url = new URL(request.url);
    const memberUserId = url.searchParams.get('userId');

    if (!memberUserId) {
      return NextResponse.json({ error: 'userId query parameter is required' }, { status: 400 });
    }

    await removeTeamMember(id, session.userId, memberUserId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to remove member' }, { status: 400 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await ensureSession();
  if ('error' in session) return session.error;

  try {
    const { id } = await params;
    const url = new URL(request.url);
    const memberUserId = url.searchParams.get('userId');
    const body = await request.json();

    if (!memberUserId) {
      return NextResponse.json({ error: 'userId query parameter is required' }, { status: 400 });
    }

    const member = await updateTeamMemberRole(id, session.userId, memberUserId, body.role);
    return NextResponse.json(member);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to update member role' }, { status: 400 });
  }
}
