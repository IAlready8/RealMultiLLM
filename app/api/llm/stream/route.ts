import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { streamChatMessage } from "@/services/api-service";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const { provider, messages, options } = await request.json();

    if (!provider || !messages) {
      return new NextResponse("Provider and messages are required", { status: 400 });
    }

    const encoder = new TextEncoder();
    const customReadable = new ReadableStream({
      async start(controller) {
        try {
          await streamChatMessage(
            provider,
            messages,
            (chunk) => {
              controller.enqueue(encoder.encode(chunk));
            },
            options
          );
          controller.close();
        } catch (error: any) {
          console.error("Error in LLM stream API:", error);
          controller.error(error);
        }
      },
    });

    return new NextResponse(customReadable, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error: any) {
    console.error("Error in LLM stream API (outer catch):", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
