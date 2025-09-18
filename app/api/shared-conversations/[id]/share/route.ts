import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  removeShare,
  shareConversationWithUser,
  updateSharePermissions,
} from '@/services/shared-conversation-service';

type RouteContext = {
  params: { id: string };
};

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { ownerId: session.user.id };
}

export async function POST(request: Request, context: RouteContext) {
  const session = await requireOwner();
  if ('error' in session) return session.error;

  try {
    const payload = await request.json();
    if (!payload?.userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const shared = await shareConversationWithUser(
      context.params.id,
      session.ownerId,
      payload.userId,
      Boolean(payload.canEdit),
    );

    return NextResponse.json(shared, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to share conversation' }, { status: 400 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await requireOwner();
  if ('error' in session) return session.error;

  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const payload = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId query parameter is required' }, { status: 400 });
    }

    const updated = await updateSharePermissions(
      context.params.id,
      session.ownerId,
      userId,
      Boolean(payload?.canEdit),
    );

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to update share' }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const session = await requireOwner();
  if ('error' in session) return session.error;

  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId query parameter is required' }, { status: 400 });
    }

    await removeShare(context.params.id, session.ownerId, userId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to remove share' }, { status: 400 });
  }
}
