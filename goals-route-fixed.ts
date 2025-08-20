import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const userId = (session.user as { id?: string })?.id;
    if (!userId) {
      return new NextResponse("User ID not found", { status: 400 });
    }
    
    const goals = await prisma.goal.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return NextResponse.json(goals);
  } catch (error) {
    console.error("Error fetching goals:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, description } = body;

    if (!title) {
      return new NextResponse("Title is required", { status: 400 });
    }

    const userId = (session.user as { id?: string })?.id;
    if (!userId) {
      return new NextResponse("User ID not found", { status: 400 });
    }

    const newGoal = await prisma.goal.create({
      data: {
        title,
        description,
        userId,
      },
    });
    return NextResponse.json(newGoal, { status: 201 });
  } catch (error) {
    console.error("Error creating goal:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, title, description, status } = body;

    if (!id || !title || !status) {
      return new NextResponse("ID, title, and status are required", { status: 400 });
    }

    const userId = (session.user as { id?: string })?.id;
    if (!userId) {
      return new NextResponse("User ID not found", { status: 400 });
    }

    const updatedGoal = await prisma.goal.update({
      where: {
        id,
        userId, // Ensure user can only update their own goals
      },
      data: {
        title,
        description,
        status,
      },
    });
    return NextResponse.json(updatedGoal);
  } catch (error) {
    console.error("Error updating goal:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new NextResponse("Goal ID is required", { status: 400 });
    }

    const userId = (session.user as { id?: string })?.id;
    if (!userId) {
      return new NextResponse("User ID not found", { status: 400 });
    }

    await prisma.goal.delete({
      where: {
        id,
        userId, // Ensure user can only delete their own goals
      },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting goal:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}