import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Full access to all resources',
    },
  });

  const memberRole = await prisma.role.upsert({
    where: { name: 'MEMBER' },
    update: {},
    create: {
      name: 'MEMBER',
      description: 'Can create and manage their own resources',
    },
  });

  // Create permissions
  const permissions = [
    // User management
    { name: 'CREATE_USER', description: 'Can create new users' },
    { name: 'READ_USER', description: 'Can read user data' },
    { name: 'UPDATE_USER', description: 'Can update user data' },
    { name: 'DELETE_USER', description: 'Can delete users' },

    // Conversation management
    { name: 'CREATE_CONVERSATION', description: 'Can create new conversations' },
    { name: 'READ_CONVERSATION', description: 'Can read conversations' },
    { name: 'UPDATE_CONVERSATION', description: 'Can update conversations' },
    { name: 'DELETE_CONVERSATION', description: 'Can delete conversations' },
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: {},
      create: permission,
    });
  }

  // Assign permissions to roles
  const allPermissions = await prisma.permission.findMany();

  // Admin has all permissions
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: permission.id,
      },
    });
  }

  // Member has limited permissions
  const memberPermissions = [
    'CREATE_CONVERSATION',
    'READ_CONVERSATION',
    'UPDATE_CONVERSATION',
    'DELETE_CONVERSATION',
  ];

  for (const permissionName of memberPermissions) {
    const permission = await prisma.permission.findUnique({
      where: { name: permissionName },
    });

    if (permission) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: memberRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: memberRole.id,
          permissionId: permission.id,
        },
      });
    }
  }

  // Create a default admin user
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin',
      roleId: adminRole.id,
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
