import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  deleteSharedConversation,
  getSharedConversationById,
  updateSharedConversation,
} from '@/services/shared-conversation-service';

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
    const conversation = await getSharedConversationById(id, session.user.id);
    return NextResponse.json(conversation);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to fetch conversation' }, { status: 404 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const payload = await request.json();
    const conversation = await updateSharedConversation(id, session.user.id, payload);
    return NextResponse.json(conversation);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to update conversation' }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    await deleteSharedConversation(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to delete conversation' }, { status: 400 });
  }
}
