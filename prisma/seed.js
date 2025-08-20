const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  // Create a demo user for development
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@demo.com' },
    update: {},
    create: {
      email: 'demo@demo.com',
      name: 'Demo User',
      password: '$2a$10$abcdefghijklmnopqrstuvwx hashed demo password',
      emailVerified: new Date(),
    },
  });

  // Create sample personas
  const personas = [
    {
      title: 'Code Assistant',
      description: 'Helps with programming questions and code review',
      prompt: 'You are a helpful coding assistant. Answer programming questions clearly and concisely. Provide code examples when appropriate.',
      userId: demoUser.id,
    },
    {
      title: 'Creative Writer',
      description: 'Assists with creative writing and storytelling',
      prompt: 'You are a creative writing assistant. Help with brainstorming, developing characters, and crafting compelling narratives.',
      userId: demoUser.id,
    },
    {
      title: 'Research Analyst',
      description: 'Helps with research and data analysis',
      prompt: 'You are a research analyst assistant. Help gather information, analyze data, and summarize findings clearly and objectively.',
      userId: demoUser.id,
    },
  ];

  for (const persona of personas) {
    await prisma.persona.upsert({
      where: { 
        title_userId: {
          title: persona.title,
          userId: persona.userId
        }
      },
      update: {},
      create: persona,
    });
  }

  // Create sample goals
  const goals = [
    {
      title: 'Complete project setup',
      description: 'Finish setting up the development environment and run the first build',
      status: 'completed',
      userId: demoUser.id,
    },
    {
      title: 'Implement authentication',
      description: 'Set up user authentication with NextAuth.js',
      status: 'pending',
      userId: demoUser.id,
    },
    {
      title: 'Add LLM providers',
      description: 'Integrate OpenAI, Claude, and other LLM providers',
      status: 'pending',
      userId: demoUser.id,
    },
  ];

  for (const goal of goals) {
    await prisma.goal.upsert({
      where: { 
        title_userId: {
          title: goal.title,
          userId: goal.userId
        }
      },
      update: {},
      create: goal,
    });
  }

  // Create user settings
  await prisma.userSettings.upsert({
    where: { userId: demoUser.id },
    update: {},
    create: {
      userId: demoUser.id,
      modelSettings: JSON.stringify({
        defaultProvider: 'openai',
        defaultModel: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 2048,
      }),
    },
  });

  console.log('Seeding completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });