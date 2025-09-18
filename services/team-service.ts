import prisma from '@/lib/prisma';
import { Prisma, TeamMemberRole } from '@prisma/client';

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
  } satisfies Prisma.TeamInclude;
}

export async function createTeam(ownerId: string, data: CreateTeamInput) {
  if (!data.name?.trim()) {
    throw new Error('Team name is required');
  }

  const team = await prisma.team.create({
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

export async function getTeamById(teamId: string, userId: string) {
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
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      owner: true,
      members: true,
    },
  });

  if (!team) {
    throw new Error('Team not found');
  }

  const actor =
    team.ownerId === userId
      ? { role: TeamMemberRole.ADMIN }
      : team.members.find((member) => member.userId === userId);

  if (!actor || actor.role !== TeamMemberRole.ADMIN) {
    throw new Error('Insufficient permissions to update team');
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

  return updatedTeam;
}

export async function deleteTeam(teamId: string, userId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { ownerId: true },
  });

  if (!team) {
    throw new Error('Team not found');
  }

  if (team.ownerId !== userId) {
    throw new Error('Only team owners can delete teams');
  }

  await prisma.team.delete({ where: { id: teamId } });
  return { success: true };
}

export async function addTeamMember(teamId: string, actorId: string, member: MemberInput) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: true },
  });

  if (!team) {
    throw new Error('Team not found');
  }

  const actor =
    team.ownerId === actorId
      ? { role: TeamMemberRole.ADMIN }
      : team.members.find((m) => m.userId === actorId);

  if (!actor || actor.role !== TeamMemberRole.ADMIN) {
    throw new Error('Insufficient permissions to add team members');
  }

  if (team.members.some((m) => m.userId === member.userId)) {
    throw new Error('User is already a member of this team');
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

  return created;
}

export async function removeTeamMember(teamId: string, actorId: string, memberUserId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: true },
  });

  if (!team) {
    throw new Error('Team not found');
  }

  const actor =
    team.ownerId === actorId
      ? { role: TeamMemberRole.ADMIN }
      : team.members.find((m) => m.userId === actorId);

  if (!actor || actor.role !== TeamMemberRole.ADMIN) {
    throw new Error('Insufficient permissions to remove team members');
  }

  if (memberUserId === team.ownerId) {
    throw new Error('Cannot remove the team owner');
  }

  await prisma.teamMember.delete({
    where: {
      teamId_userId: {
        teamId,
        userId: memberUserId,
      },
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
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: true },
  });

  if (!team) {
    throw new Error('Team not found');
  }

  const actor =
    team.ownerId === actorId
      ? { role: TeamMemberRole.ADMIN }
      : team.members.find((m) => m.userId === actorId);

  if (!actor || actor.role !== TeamMemberRole.ADMIN) {
    throw new Error('Insufficient permissions to update roles');
  }

  if (memberUserId === team.ownerId) {
    throw new Error('Cannot change the owner role');
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

  return updated;
}
