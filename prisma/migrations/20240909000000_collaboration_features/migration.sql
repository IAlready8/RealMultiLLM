-- Prisma migration for collaboration features

-- CreateEnum
CREATE TYPE "TeamMemberRole" AS ENUM ('MEMBER', 'ADMIN');

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "TeamMemberRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedConversation" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SharedConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SharedConversationUser" (
    "id" TEXT NOT NULL,
    "sharedConversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "sharedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sharedBy" TEXT NOT NULL,

    CONSTRAINT "SharedConversationUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Team_ownerId_createdAt_idx" ON "Team"("ownerId", "createdAt");
CREATE INDEX "Team_createdAt_idx" ON "Team"("createdAt");
CREATE UNIQUE INDEX "TeamMember_teamId_userId_key" ON "TeamMember"("teamId", "userId");
CREATE INDEX "TeamMember_userId_role_idx" ON "TeamMember"("userId", "role");
CREATE INDEX "SharedConversation_ownerId_createdAt_idx" ON "SharedConversation"("ownerId", "createdAt");
CREATE INDEX "SharedConversation_teamId_idx" ON "SharedConversation"("teamId");
CREATE INDEX "SharedConversation_isPublic_idx" ON "SharedConversation"("isPublic");
CREATE UNIQUE INDEX "SharedConversationUser_sharedConversationId_userId_key" ON "SharedConversationUser"("sharedConversationId", "userId");
CREATE INDEX "SharedConversationUser_userId_idx" ON "SharedConversationUser"("userId");
CREATE INDEX "SharedConversationUser_sharedBy_idx" ON "SharedConversationUser"("sharedBy");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedConversation" ADD CONSTRAINT "SharedConversation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SharedConversation" ADD CONSTRAINT "SharedConversation_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SharedConversationUser" ADD CONSTRAINT "SharedConversationUser_sharedConversationId_fkey" FOREIGN KEY ("sharedConversationId") REFERENCES "SharedConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedConversationUser" ADD CONSTRAINT "SharedConversationUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharedConversationUser" ADD CONSTRAINT "SharedConversationUser_sharedBy_fkey" FOREIGN KEY ("sharedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
