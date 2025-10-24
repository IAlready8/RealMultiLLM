import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  
  // Example: Create default data that might be useful for your application
  // Add any initial data required for your application to function properly
  
  // Example: Creating default admin user (uncomment and modify as needed)
  /*
  const existingUser = await prisma.user.findUnique({
    where: { email: 'admin@example.com' },
  });
  
  if (!existingUser) {
    await prisma.user.create({
      data: {
        email: 'admin@example.com',
        name: 'Admin User',
        password: await hash('password123', 10), // Use a strong password in production
        role: 'ADMIN',
      },
    });
    console.log('Created default admin user');
  }
  */

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });