import prisma from '@/lib/prisma';
import { Prisma, TeamMemberRole } from '@prisma/client';
import { ValidationError, AuthenticationError } from '@/lib/error-system';
import { hasPermission } from '@/lib/rbac';

type CreateTeamInput = {
  name: string;
  description?: string | null;
};

type UpdateTeamInput = Partial<CreateTeamInput>;

type MemberInput = {
  userId: string;
  role?: TeamMemberRole | 'MEMBER' | 'ADMIN' | 'member' | 'admin';
};

function normalizeRole(role?: MemberInput['role']): TeamMemberRole {
  if (!role) return TeamMemberRole.MEMBER;
  if (typeof role === 'string') {
    const upper = role.toUpperCase();
    if (upper === 'ADMIN') return TeamMemberRole.ADMIN;
    return TeamMemberRole.MEMBER;
  }
  return role;
}

function teamInclude() {
  return {
    owner: {
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
      },
    },
    members: {
      orderBy: { joinedAt: 'asc' as const },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    },
    sharedConversations: {
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        isPublic: true,
        canEdit: true,
      },
    },
    conversations: true, // Adding conversations to the team include
  } satisfies Prisma.TeamInclude;
}

export async function createTeam(ownerId: string, data: CreateTeamInput) {
  if (!data.name?.trim()) {
    throw new ValidationError('Invalid team parameters', 'name', {
      endpoint: 'team.create',
      timestamp: new Date(),
      metadata: { ownerId, name: data.name },
      requestId: ownerId
    });
  }

  // Use RBAC to check if the user has permission to create a team
  const hasTeamWritePermission = await hasPermission(ownerId, 'team:write', { teamId: null as string | null, resource: 'team' });
  if (!hasTeamWritePermission) {
    throw new AuthenticationError('Not authorized to create team', {
      endpoint: 'team.create',
      timestamp: new Date(),
      metadata: { ownerId },
      requestId: ownerId
    });
  }

  const team = await prisma.$transaction(async (tx) => {
    const newTeam = await tx.team.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
        ownerId,
        members: {
          create: {
            userId: ownerId,
            role: TeamMemberRole.ADMIN,
          },
        },
      },
      include: teamInclude(),
    });

    // Create an audit log entry
    await tx.auditLog.create({
      data: {
        action: 'team.create',
        resource: 'team',
        resourceId: newTeam.id,
        userId: ownerId,
        details: JSON.stringify({ teamName: newTeam.name }),
        outcome: 'success',
      },
    });

    return newTeam;
  });

  return team;
}

export async function getUserTeams(userId: string) {
  const teams = await prisma.team.findMany({
    where: {
      OR: [
        { ownerId: userId },
        {
          members: {
            some: {
              userId,
            },
          },
        },
      ],
    },
    orderBy: { createdAt: 'asc' },
    include: teamInclude(),
  });

  return teams;
}

export async function getAllTeams() {
  const teams = await prisma.team.findMany({
    orderBy: { createdAt: 'asc' },
    include: teamInclude(),
  });

  return teams;
}

export async function getTeamById(teamId: string, userId: string) {
  // Check if user has read permission for this team
  const hasReadPermission = await hasPermission(userId, 'team:read', { teamId, resource: 'team' });
  if (!hasReadPermission) {
    throw new AuthenticationError('Not authorized to view team', {
      endpoint: 'team.get',
      timestamp: new Date(),
      metadata: { userId, teamId },
      requestId: teamId
    });
  }

  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
    include: teamInclude(),
  });

  return team;
}

export async function updateTeam(teamId: string, userId: string, data: UpdateTeamInput) {
  // Check if user has write permission for this team
  const hasWritePermission = await hasPermission(userId, 'team:write', { teamId, resource: 'team' });
  if (!hasWritePermission) {
    throw new AuthenticationError('Not authorized to update team', {
      endpoint: 'team.update',
      timestamp: new Date(),
      metadata: { userId, teamId },
      requestId: teamId
    });
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      owner: true,
      members: true,
    },
  });

  if (!team) {
    throw new ValidationError('Team not found', 'teamId', {
      endpoint: 'team.update',
      timestamp: new Date(),
      metadata: { teamId },
      requestId: teamId
    });
  }

  const actor =
    team.ownerId === userId
      ? { role: TeamMemberRole.ADMIN }
      : team.members.find((member) => member.userId === userId);

  if (!actor || actor.role !== TeamMemberRole.ADMIN) {
    throw new AuthenticationError('Insufficient permissions to update team', {
      endpoint: 'team.update',
      timestamp: new Date(),
      metadata: { userId, teamId },
      requestId: teamId
    });
  }

  const updatedTeam = await prisma.team.update({
    where: { id: teamId },
    data: {
      name: data.name?.trim() ?? undefined,
      description:
        data.description === undefined
          ? undefined
          : data.description?.trim() || null,
    },
    include: teamInclude(),
  });

  // Create an audit log entry
  await prisma.auditLog.create({
    data: {
      action: 'team.update',
      resource: 'team',
      resourceId: teamId,
      userId,
      details: JSON.stringify({ updatedFields: Object.keys(data) }),
      outcome: 'success',
    },
  });

  return updatedTeam;
}

export async function deleteTeam(teamId: string, userId: string) {
  // Check if user has write permission for this team
  const hasWritePermission = await hasPermission(userId, 'team:write', { teamId, resource: 'team' });
  if (!hasWritePermission) {
    throw new AuthenticationError('Not authorized to delete team', {
      endpoint: 'team.delete',
      timestamp: new Date(),
      metadata: { userId, teamId },
      requestId: teamId
    });
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { ownerId: true },
  });

  if (!team) {
    throw new ValidationError('Team not found', 'teamId', {
      endpoint: 'team.delete',
      timestamp: new Date(),
      metadata: { teamId },
      requestId: teamId
    });
  }

  if (team.ownerId !== userId) {
    throw new AuthenticationError('Only team owners can delete teams', {
      endpoint: 'team.delete',
      timestamp: new Date(),
      metadata: { userId, teamId },
      requestId: teamId
    });
  }

  await prisma.team.delete({ where: { id: teamId } });

  // Create an audit log entry
  await prisma.auditLog.create({
    data: {
      action: 'team.delete',
      resource: 'team',
      resourceId: teamId,
      userId,
      details: JSON.stringify({ teamName: teamId }),
      outcome: 'success',
    },
  });

  return { success: true };
}

export async function addTeamMember(teamId: string, actorId: string, member: MemberInput) {
  // Check if user has write permission for this team
  const hasWritePermission = await hasPermission(actorId, 'team:write', { teamId, resource: 'team' });
  if (!hasWritePermission) {
    throw new AuthenticationError('Not authorized to add members', {
      endpoint: 'team.addMember',
      timestamp: new Date(),
      metadata: { actorId, teamId },
      requestId: teamId
    });
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: true },
  });

  if (!team) {
    throw new ValidationError('Team not found', 'teamId', {
      endpoint: 'team.addMember',
      timestamp: new Date(),
      metadata: { teamId },
      requestId: teamId
    });
  }

  const actor =
    team.ownerId === actorId
      ? { role: TeamMemberRole.ADMIN }
      : team.members.find((m) => m.userId === actorId);

  if (!actor || actor.role !== TeamMemberRole.ADMIN) {
    throw new AuthenticationError('Insufficient permissions to add team members', {
      endpoint: 'team.addMember',
      timestamp: new Date(),
      metadata: { actorId, teamId },
      requestId: teamId
    });
  }

  if (team.members.some((m) => m.userId === member.userId)) {
    throw new ValidationError('User is already a member of this team', 'userId', {
      endpoint: 'team.addMember',
      timestamp: new Date(),
      metadata: { teamId, userId: member.userId },
      requestId: teamId
    });
  }

  const created = await prisma.teamMember.create({
    data: {
      teamId,
      userId: member.userId,
      role: normalizeRole(member.role),
    },
    include: {
      team: { select: { id: true, name: true } },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  // Create an audit log entry
  await prisma.auditLog.create({
    data: {
      action: 'team.member.add',
      resource: 'team.member',
      resourceId: `${teamId}:${member.userId}`,
      userId: actorId,
      details: JSON.stringify({ memberId: member.userId, role: normalizeRole(member.role) }),
      outcome: 'success',
    },
  });

  return created;
}

export async function removeTeamMember(teamId: string, actorId: string, memberUserId: string) {
  // Check if user has write permission for this team
  const hasWritePermission = await hasPermission(actorId, 'team:write', { teamId, resource: 'team' });
  if (!hasWritePermission) {
    throw new AuthenticationError('Not authorized to remove members', {
      endpoint: 'team.removeMember',
      timestamp: new Date(),
      metadata: { actorId, teamId },
      requestId: teamId
    });
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: true },
  });

  if (!team) {
    throw new ValidationError('Team not found', 'teamId', {
      endpoint: 'team.removeMember',
      timestamp: new Date(),
      metadata: { teamId },
      requestId: teamId
    });
  }

  const actor =
    team.ownerId === actorId
      ? { role: TeamMemberRole.ADMIN }
      : team.members.find((m) => m.userId === actorId);

  if (!actor || actor.role !== TeamMemberRole.ADMIN) {
    throw new AuthenticationError('Insufficient permissions to remove team members', {
      endpoint: 'team.removeMember',
      timestamp: new Date(),
      metadata: { actorId, teamId },
      requestId: teamId
    });
  }

  if (memberUserId === team.ownerId) {
    throw new ValidationError('Cannot remove the team owner', 'memberUserId', {
      endpoint: 'team.removeMember',
      timestamp: new Date(),
      metadata: { teamId, memberUserId },
      requestId: teamId
    });
  }

  await prisma.teamMember.delete({
    where: {
      teamId_userId: {
        teamId,
        userId: memberUserId,
      },
    },
  });

  // Create an audit log entry
  await prisma.auditLog.create({
    data: {
      action: 'team.member.remove',
      resource: 'team.member',
      resourceId: `${teamId}:${memberUserId}`,
      userId: actorId,
      details: JSON.stringify({ memberId: memberUserId }),
      outcome: 'success',
    },
  });

  return { success: true };
}

export async function updateTeamMemberRole(
  teamId: string,
  actorId: string,
  memberUserId: string,
  role: MemberInput['role'],
) {
  // Check if user has write permission for this team
  const hasWritePermission = await hasPermission(actorId, 'team:write', { teamId, resource: 'team' });
  if (!hasWritePermission) {
    throw new AuthenticationError('Not authorized to update members', {
      endpoint: 'team.updateMemberRole',
      timestamp: new Date(),
      metadata: { actorId, teamId },
      requestId: teamId
    });
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: true },
  });

  if (!team) {
    throw new ValidationError('Team not found', 'teamId', {
      endpoint: 'team.updateMemberRole',
      timestamp: new Date(),
      metadata: { teamId },
      requestId: teamId
    });
  }

  const actor =
    team.ownerId === actorId
      ? { role: TeamMemberRole.ADMIN }
      : team.members.find((m) => m.userId === actorId);

  if (!actor || actor.role !== TeamMemberRole.ADMIN) {
    throw new AuthenticationError('Insufficient permissions to update roles', {
      endpoint: 'team.updateMemberRole',
      timestamp: new Date(),
      metadata: { actorId, teamId },
      requestId: teamId
    });
  }

  if (memberUserId === team.ownerId) {
    throw new ValidationError('Cannot change the owner role', 'memberUserId', {
      endpoint: 'team.updateMemberRole',
      timestamp: new Date(),
      metadata: { teamId, memberUserId },
      requestId: teamId
    });
  }

  const updated = await prisma.teamMember.update({
    where: {
      teamId_userId: {
        teamId,
        userId: memberUserId,
      },
    },
    data: {
      role: normalizeRole(role),
    },
    include: {
      team: { select: { id: true, name: true } },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

  // Create an audit log entry
  await prisma.auditLog.create({
    data: {
      action: 'team.member.update',
      resource: 'team.member',
      resourceId: `${teamId}:${memberUserId}`,
      userId: actorId,
      details: JSON.stringify({ memberId: memberUserId, newRole: normalizeRole(role) }),
      outcome: 'success',
    },
  });

  return updated;
}

// New function to get team members
export async function getTeamMembers(teamId: string, userId: string) {
  // Check if user has read permission for this team
  const hasReadPermission = await hasPermission(userId, 'team:read', { teamId, resource: 'team' });
  if (!hasReadPermission) {
    throw new AuthenticationError('Not authorized to view team members', {
      endpoint: 'team.getMembers',
      timestamp: new Date(),
      metadata: { userId, teamId },
      requestId: teamId
    });
  }

  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      OR: [
        { ownerId: userId },
        { members: { some: { userId } } },
      ],
    },
    include: {
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      members: {
        orderBy: { joinedAt: 'asc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
    },
  });

  if (!team) {
    throw new ValidationError('Team not found', 'teamId', {
      endpoint: 'team.getMembers',
      timestamp: new Date(),
      metadata: { teamId },
      requestId: teamId
    });
  }

  // Format the members list to include the owner as well
  const allMembers = [
    {
      id: team.owner.id,
      userId: team.owner.id,
      role: TeamMemberRole.ADMIN,
      joinedAt: team.createdAt,
      user: team.owner,
    },
    ...team.members
  ];

  return allMembers;
}

// New function to check if a user is a member of a team
export async function isTeamMember(teamId: string, userId: string): Promise<boolean> {
  const team = await prisma.team.findFirst({
    where: {
      id: teamId,
      OR: [
        { ownerId: userId },
        {
          members: {
            some: {
              userId,
            },
          },
        },
      ],
    },
  });

  return !!team;
}

// New function to get teams for a specific user (admin view)
export async function getTeamsForUser(userId: string, requestingUserId: string) {
  // Check if requesting user has admin permission
  const isAdmin = await hasPermission(requestingUserId, 'admin:read', { resource: 'team' });
  if (!isAdmin) {
    throw new AuthenticationError('Not authorized to view teams for other users', {
      endpoint: 'team.getUserTeams',
      timestamp: new Date(),
      metadata: { userId: requestingUserId, targetUserId: userId },
      requestId: userId
    });
  }

  const teams = await prisma.team.findMany({
    where: {
      OR: [
        { ownerId: userId },
        {
          members: {
            some: {
              userId,
            },
          },
        },
      ],
    },
    orderBy: { createdAt: 'asc' },
    include: teamInclude(),
  });

  return teams;
}
