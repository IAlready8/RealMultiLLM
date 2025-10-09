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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create shared conversation';
    return NextResponse.json({ error: message }, { status: 400 });
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch shared conversations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
