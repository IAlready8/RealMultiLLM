import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import { checkApiRateLimit } from "@/lib/api";

// Define Zod schemas for persona input validation
const personaSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  description: z.string().max(500).optional(),
  prompt: z.string().min(1, "Prompt is required"),
});

const updatePersonaSchema = personaSchema.extend({
  id: z.string().cuid("Invalid ID"),
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const personas = await prisma.persona.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });
    return NextResponse.json(personas);
  } catch (error) {
    logger.error("Failed to fetch personas", { userId: session.user.id, error });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Rate limit check
  const rateLimitResult = await checkApiRateLimit(request, 'personas', session.user.id);
  if (!rateLimitResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
        },
      }
    );
  }

  try {
    const body = await request.json();
    const validatedData = personaSchema.parse(body);

    const newPersona = await prisma.persona.create({
      data: {
        ...validatedData,
        userId: session.user.id,
      },
    });
    return NextResponse.json(newPersona, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    logger.error("Failed to create persona", { userId: session.user.id, error });
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
    const validatedData = updatePersonaSchema.parse(body);
    const { id, ...dataToUpdate } = validatedData;

    const personaToUpdate = await prisma.persona.findUnique({
      where: { id },
    });

    if (!personaToUpdate || personaToUpdate.userId !== session.user.id) {
      return NextResponse.json({ error: "Persona not found or not owned by user" }, { status: 404 });
    }

    const updatedPersona = await prisma.persona.update({
      where: { id },
      data: dataToUpdate,
    });
    return NextResponse.json(updatedPersona);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    logger.error("Failed to update persona", { userId: session.user.id, error });
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
      return NextResponse.json({ error: "Persona ID is required" }, { status: 400 });
    }

    const personaToDelete = await prisma.persona.findUnique({
      where: { id },
    });

    if (!personaToDelete || personaToDelete.userId !== session.user.id) {
      return NextResponse.json({ error: "Persona not found or not owned by user" }, { status: 404 });
    }

    await prisma.persona.delete({
      where: { id },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error("Failed to delete persona", { userId: session.user.id, error });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}