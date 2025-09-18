import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  deleteSharedConversation,
  getSharedConversationById,
  updateSharedConversation,
} from '@/services/shared-conversation-service';

type RouteContext = {
  params: { id: string };
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversation = await getSharedConversationById(context.params.id, session.user.id);
    return NextResponse.json(conversation);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to fetch conversation' }, { status: 404 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    const conversation = await updateSharedConversation(context.params.id, session.user.id, payload);
    return NextResponse.json(conversation);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to update conversation' }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await deleteSharedConversation(context.params.id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to delete conversation' }, { status: 400 });
  }
}
