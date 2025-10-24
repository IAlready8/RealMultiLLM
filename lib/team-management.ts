import { PrismaClient, Team, TeamMembership } from '@prisma/client';
import { AppError } from '@/lib/error-system';
import { hasPermission } from '@/lib/rbac';

/**
 * TeamService provides a thin layer over Prisma to manage teams and role
 * assignments.  It assumes the existence of `Team` and `TeamMembership`
 * models in your Prisma schema (see the provided schema in this update).
 *
 * Permissions are enforced using the existing RBAC system.  Attempting to
 * perform an action without the appropriate permission will result in an
 * `AppError` with the `authentication` category.
 */
export class TeamService {
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Creates a new team and assigns the creating user as the owner.
   *
   * @param ownerId The user ID of the team owner.
   * @param name A human‑readable name for the team.
   */
  async createTeam(ownerId: string, name: string): Promise<Team> {
    if (!ownerId || !name) {
      throw new AppError('Invalid team parameters', {
        category: 'validation',
        severity: 'low',
        context: { ownerId, name },
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.create({ 
        data: { 
          name,
          ownerId: ownerId // Assign the owner when creating the team
        } 
      });
      await tx.teamMembership.create({
        data: { teamId: team.id, userId: ownerId, role: 'OWNER' }, // Assign owner role to the team creator
      });
      return team;
    });
  }

  /**
   * Adds a user to a team with the given role.  Only users with `team:write`
   * permission on the team may add members.
   */
  async addMember(currentUserId: string, teamId: string, userId: string, role: string): Promise<TeamMembership> {
    if (!(await hasPermission(currentUserId, 'team:write', { resource: 'team', resourceId: teamId }))) {
      throw new AppError('Not authorized to add members', {
        category: 'authentication',
        severity: 'medium',
      });
    }
    return this.prisma.teamMembership.create({ data: { teamId, userId, role } });
  }

  /**
   * Removes a user from a team.  Requires `team:write` permission.
   */
  async removeMember(currentUserId: string, teamId: string, userId: string): Promise<TeamMembership> {
    if (!(await hasPermission(currentUserId, 'team:write', { resource: 'team', resourceId: teamId }))) {
      throw new AppError('Not authorized to remove members', {
        category: 'authentication',
        severity: 'medium',
      });
    }
    return this.prisma.teamMembership.delete({ where: { teamId_userId: { teamId, userId } } });
  }

  /**
   * Retrieves all teams for a given user.  This is useful for listing
   * organisations on the dashboard.
   */
  async listTeamsForUser(userId: string): Promise<Team[]> {
    return this.prisma.team.findMany({
      where: { members: { some: { userId } } },
    });
  }

  /**
   * Retrieves the members of a team.  Requires `team:read` permission.
   */
  async listMembers(currentUserId: string, teamId: string): Promise<TeamMembership[]> {
    if (!(await hasPermission(currentUserId, 'team:read', { resource: 'team', resourceId: teamId }))) {
      throw new AppError('Not authorized to view members', {
        category: 'authentication',
        severity: 'low',
      });
    }
    return this.prisma.teamMembership.findMany({ where: { teamId }, include: { user: true } });
  }
}

export default TeamService;