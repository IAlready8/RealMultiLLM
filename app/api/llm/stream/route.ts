import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { streamLLM } from "@/lib/llm-api-client";
import { createRequestLogger } from "@/lib/logger";

// OVERWRITTEN FILE: app/api/llm/stream/route.ts (complete rewrite)
// Streams via callLLMApi with onChunk support, logging included.

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
    const reqId = crypto.randomUUID();
    const log = createRequestLogger("/api/llm/stream", reqId);
    log.info({ provider }, "llm.stream.begin");

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          // Format messages for the LLM API client
          const formattedMessages = messages.map((m: any) => ({
            role: m.role,
            content: m.content
          }));
          
          // Extract system prompt if present
          const systemMessage = messages.find((m: any) => m.role === "system");
          const systemPrompt = systemMessage?.content || options?.systemPrompt;
          
          // Stream the response using the LLM API client
          await streamLLM(provider, formattedMessages, {
            onChunk: (chunk: string) => controller.enqueue(encoder.encode(chunk)),
            onComplete: () => {
              controller.close();
              log.info({ provider }, "llm.stream.close");
            },
            onError: (error: Error) => {
              log.error({ error: error.message }, "llm.stream.error");
              controller.error(error);
            }
          }, {
            ...(options || {}),
            systemPrompt
          });
        } catch (err: any) {
          log.error({ error: err?.message }, "llm.stream.error");
          controller.error(err);
        }
      },
    });
    return new NextResponse(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (error: any) {
    // Return a proper JSON response
    return NextResponse.json(
      { error: true, message: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}


