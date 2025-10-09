
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import logger from "@/lib/logger";

// Define Zod schemas for input validation
const goalSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),
  description: z.string().max(1000).optional(),
});

const updateGoalSchema = goalSchema.extend({
  id: z.string().cuid("Invalid ID"),
  status: z.enum(["pending", "in_progress", "completed"]),
});

export async function GET(_request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const goals = await prisma.goal.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return NextResponse.json(goals);
  } catch (error) {
    logger.error("Failed to fetch goals", { userId: session.user.id, error });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validatedData = goalSchema.parse(body);

    const newGoal = await prisma.goal.create({
      data: {
        ...validatedData,
        userId: session.user.id,
      },
    });
    return NextResponse.json(newGoal, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    logger.error("Failed to create goal", { userId: session.user.id, error });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validatedData = updateGoalSchema.parse(body);
    const { id, ...dataToUpdate } = validatedData;

    const goalToUpdate = await prisma.goal.findUnique({
      where: { id },
    });

    if (!goalToUpdate || goalToUpdate.userId !== session.user.id) {
      return NextResponse.json({ error: "Goal not found or not owned by user" }, { status: 404 });
    }

    const updatedGoal = await prisma.goal.update({
      where: { id },
      data: dataToUpdate,
    });
    return NextResponse.json(updatedGoal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    logger.error("Failed to update goal", { userId: session.user.id, error });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Goal ID is required" }, { status: 400 });
    }
    
    const goalToDelete = await prisma.goal.findUnique({
      where: { id },
    });

    if (!goalToDelete || goalToDelete.userId !== session.user.id) {
      return NextResponse.json({ error: "Goal not found or not owned by user" }, { status: 404 });
    }

    await prisma.goal.delete({
      where: { id },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error("Failed to delete goal", { userId: session.user.id, error });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
