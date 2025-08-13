import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sanitizePersonaData } from "@/lib/sanitize";
import { validatePersona } from "@/lib/validation-schemas";
import { safeHandleApiError, ErrorCodes, createApiError } from "@/lib/error-handler";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json(
      createApiError(ErrorCodes.AUTHENTICATION_ERROR, "Authentication required"),
      { status: 401 }
    );
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
    return safeHandleApiError(error, "/api/personas", session.user.id);
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json(
      createApiError(ErrorCodes.AUTHENTICATION_ERROR, "Authentication required"),
      { status: 401 }
    );
  }

  // Apply rate limiting for API calls
  const rateLimitResult = await checkRateLimit(
    request as any, 
    'apiGeneral', 
    session.user.id
  );
  if (!rateLimitResult.success && rateLimitResult.error) {
    return rateLimitResult.error;
  }

  try {
    const body = await request.json();
    
    // Validate and sanitize input
    try {
      const validatedData = validatePersona({
        name: body.title,
        description: body.description || '',
        systemPrompt: body.prompt
      });
      
      // Sanitize user input
      const sanitized = sanitizePersonaData({
        name: validatedData.name,
        description: validatedData.description
      });
      
      const { name: title, description } = sanitized;
      const prompt = body.prompt; // System prompts don't need HTML sanitization
      
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
    } catch (validationError) {
      return safeHandleApiError(validationError, "/api/personas", session.user.id);
    }
  } catch (error) {
    return safeHandleApiError(error, "/api/personas", session.user.id);
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json(
      createApiError(ErrorCodes.AUTHENTICATION_ERROR, "Authentication required"),
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return new NextResponse("ID is required", { status: 400 });
    }

    // Validate and sanitize input
    try {
      const validatedData = validatePersona({
        name: body.title,
        description: body.description || '',
        systemPrompt: body.prompt
      });
      
      // Sanitize user input
      const sanitized = sanitizePersonaData({
        name: validatedData.name,
        description: validatedData.description
      });
      
      const { name: title, description } = sanitized;
      const prompt = body.prompt; // System prompts don't need HTML sanitization
      
      if (!title || !prompt) {
        return new NextResponse("Title and prompt are required", { status: 400 });
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
    } catch (validationError) {
      return safeHandleApiError(validationError, "/api/personas", session.user.id);
    }
  } catch (error) {
    return safeHandleApiError(error, "/api/personas", session.user.id);
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json(
      createApiError(ErrorCodes.AUTHENTICATION_ERROR, "Authentication required"),
      { status: 401 }
    );
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
    return safeHandleApiError(error, "/api/personas", session.user.id);
  }
}