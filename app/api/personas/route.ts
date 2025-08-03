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
    const personas = await prisma.persona.findMany({
      where: {
        userId: session.user.id!,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
    return NextResponse.json(personas);
  } catch (error) {
    console.error("Error fetching personas:", error);
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
    const { title, description, prompt } = body;

    if (!title || !prompt) {
      return new NextResponse("Title and prompt are required", { status: 400 });
    }

    const newPersona = await prisma.persona.create({
      data: {
        title,
        description: description || null,
        prompt,
        userId: session.user.id!,
      },
    });
    return NextResponse.json(newPersona, { status: 201 });
  } catch (error) {
    console.error("Error creating persona:", error);
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
    const { id, title, description, prompt } = body;

    if (!id || !title || !prompt) {
      return new NextResponse("ID, title, and prompt are required", { status: 400 });
    }

    const updatedPersona = await prisma.persona.update({
      where: {
        id,
        userId: session.user.id!, // Ensure user can only update their own personas
      },
      data: {
        title,
        description: description || null,
        prompt,
      },
    });
    return NextResponse.json(updatedPersona);
  } catch (error) {
    console.error("Error updating persona:", error);
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
      return new NextResponse("Persona ID is required", { status: 400 });
    }

    await prisma.persona.delete({
      where: {
        id,
        userId: session.user.id!, // Ensure user can only delete their own personas
      },
    });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error deleting persona:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}