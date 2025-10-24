import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function hasPermission(userId: string, permissionName: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  if (!user || !user.role) {
    return false;
  }

  return user.role.rolePermissions.some(
    (rolePermission) => rolePermission.permission.name === permissionName
  );
}
