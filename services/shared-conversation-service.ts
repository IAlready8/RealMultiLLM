import prisma from '@/lib/prisma';

export type SharedConversationMessage = {
  provider: string;
  messages: unknown;
};

export type SharedConversationInput = {
  title: string;
  messages: SharedConversationMessage[] | unknown;
  teamId?: string | null;
  isPublic?: boolean;
  canEdit?: boolean;
};

export type SharedConversationUpdate = Partial<SharedConversationInput>;

function conversationInclude() {
  return {
    owner: {
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    },
    team: {
      select: {
        id: true,
        name: true,
        description: true,
      },
    },
    sharedWith: {
      orderBy: { sharedAt: 'asc' as const },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        sharedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    },
  } as const;
}

export async function createSharedConversation(ownerId: string, data: SharedConversationInput) {
  if (!data.title?.trim()) {
    throw new Error('Conversation title is required');
  }

  const conversation = await prisma.sharedConversation.create({
    data: {
      title: data.title.trim(),
      messages: JSON.stringify(data.messages ?? []),
      ownerId,
      teamId: data.teamId ?? null,
      isPublic: data.isPublic ?? false,
      canEdit: data.canEdit ?? false,
    },
    include: conversationInclude(),
  });

  return conversation;
}

export async function getUserSharedConversations(userId: string) {
  const conversations = await prisma.sharedConversation.findMany({
    where: {
      OR: [
        { ownerId: userId },
        {
          sharedWith: {
            some: {
              userId,
            },
          },
        },
        {
          team: {
            members: {
              some: { userId },
            },
          },
        },
        { isPublic: true },
      ],
    },
    orderBy: { updatedAt: 'desc' },
    include: conversationInclude(),
  });

  return conversations;
}

export async function getSharedConversationById(id: string, userId: string) {
  const conversation = await prisma.sharedConversation.findFirst({
    where: {
      id,
      OR: [
        { ownerId: userId },
        {
          sharedWith: {
            some: { userId },
          },
        },
        {
          isPublic: true,
        },
        {
          team: {
            members: {
              some: { userId },
            },
          },
        },
      ],
    },
    include: conversationInclude(),
  });

  if (!conversation) {
    throw new Error('Conversation not found or insufficient permissions');
  }

  return conversation;
}

function userHasEditPermission(
  conversation: {
    ownerId: string;
    canEdit: boolean;
    sharedWith: { userId: string; canEdit: boolean }[];
    team: (null | { members: { userId: string }[] });
  },
  userId: string,
) {
  if (conversation.ownerId === userId) {
    return true;
  }

  const sharedEntry = conversation.sharedWith.find((item) => item.userId === userId);
  if (sharedEntry?.canEdit) {
    return true;
  }

  const isTeamMember = conversation.team?.members?.some((member) => member.userId === userId) ?? false;

  if (conversation.canEdit && (isTeamMember || sharedEntry)) {
    return true;
  }

  return false;
}

export async function updateSharedConversation(
  id: string,
  userId: string,
  data: SharedConversationUpdate,
) {
  const conversation = await prisma.sharedConversation.findUnique({
    where: { id },
    include: {
      sharedWith: true,
      team: {
        include: {
          members: true,
        },
      },
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (
    !userHasEditPermission(
      {
        ownerId: conversation.ownerId,
        canEdit: conversation.canEdit,
        sharedWith: conversation.sharedWith.map((item) => ({
          userId: item.userId,
          canEdit: item.canEdit,
        })),
        team: conversation.team
          ? {
              members: conversation.team.members.map((member) => ({ userId: member.userId })),
            }
          : null,
      },
      userId,
    )
  ) {
    throw new Error('Insufficient permissions to update conversation');
  }

  const updated = await prisma.sharedConversation.update({
    where: { id },
    data: {
      title: data.title?.trim() ?? undefined,
      messages: data.messages ? JSON.stringify(data.messages) : undefined,
      teamId: data.teamId === undefined ? undefined : data.teamId || null,
      isPublic: data.isPublic ?? undefined,
      canEdit: data.canEdit ?? undefined,
    },
    include: conversationInclude(),
  });

  return updated;
}

export async function deleteSharedConversation(id: string, userId: string) {
  const conversation = await prisma.sharedConversation.findUnique({
    where: { id },
    select: {
      ownerId: true,
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (conversation.ownerId !== userId) {
    throw new Error('Only the owner can delete this conversation');
  }

  await prisma.sharedConversation.delete({ where: { id } });
  return { success: true };
}

export async function shareConversationWithUser(
  conversationId: string,
  ownerId: string,
  userId: string,
  canEdit = false,
) {
  const conversation = await prisma.sharedConversation.findUnique({
    where: { id: conversationId },
    select: { ownerId: true },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (conversation.ownerId !== ownerId) {
    throw new Error('Only the owner can share this conversation');
  }

  const existing = await prisma.sharedConversationUser.findUnique({
    where: {
      sharedConversationId_userId: {
        sharedConversationId: conversationId,
        userId,
      },
    },
  });

  if (existing) {
    throw new Error('Conversation already shared with this user');
  }

  const share = await prisma.sharedConversationUser.create({
    data: {
      sharedConversationId: conversationId,
      userId,
      canEdit,
      sharedBy: ownerId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      sharedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return share;
}

export async function updateSharePermissions(
  conversationId: string,
  ownerId: string,
  userId: string,
  canEdit: boolean,
) {
  const conversation = await prisma.sharedConversation.findUnique({
    where: { id: conversationId },
    select: { ownerId: true },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (conversation.ownerId !== ownerId) {
    throw new Error('Only the owner can update share permissions');
  }

  const updated = await prisma.sharedConversationUser.update({
    where: {
      sharedConversationId_userId: {
        sharedConversationId: conversationId,
        userId,
      },
    },
    data: {
      canEdit,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      sharedByUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return updated;
}

export async function removeShare(conversationId: string, ownerId: string, userId: string) {
  const conversation = await prisma.sharedConversation.findUnique({
    where: { id: conversationId },
    select: { ownerId: true },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  if (conversation.ownerId !== ownerId) {
    throw new Error('Only the owner can remove shares');
  }

  await prisma.sharedConversationUser.delete({
    where: {
      sharedConversationId_userId: {
        sharedConversationId: conversationId,
        userId,
      },
    },
  });

  return { success: true };
}
