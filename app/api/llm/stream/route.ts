import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { callLLMApi } from "@/services/api-client";
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
          const formattedPrompt = messages.map((m: any) => m.content);
          const systemMessage = messages.find((m: any) => m.role === "system");
          await callLLMApi(provider, formattedPrompt, {
            ...(options || {}),
            stream: true,
            systemPrompt: systemMessage?.content || options?.systemPrompt,
            onChunk: (chunk: string) => controller.enqueue(encoder.encode(chunk)),
          });
          controller.close();
          log.info({ provider }, "llm.stream.close");
        } catch (err: any) {
          log.error({ error: err?.message }, "llm.stream.error");
          controller.error(err);
        }
      },
    });
    return new NextResponse(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (error: any) {
    return new NextResponse(error?.message || "Internal Server Error", { status: 500 });
  }
}


