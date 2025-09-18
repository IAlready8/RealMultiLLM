import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  createSharedConversation,
  getUserSharedConversations,
} from '@/services/shared-conversation-service';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    const conversation = await createSharedConversation(session.user.id, payload);
    return NextResponse.json(conversation, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create shared conversation' }, { status: 400 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const conversations = await getUserSharedConversations(session.user.id);
    return NextResponse.json(conversations);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to fetch shared conversations' }, { status: 500 });
  }
}
