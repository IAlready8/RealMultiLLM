import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { callLLMApi } from "@/services/api-client";
import { recordAnalyticsEvent } from "@/services/analytics-service";
import { createRequestLogger } from "@/lib/logger";

// OVERWRITTEN FILE: app/api/llm/chat/route.ts (complete rewrite)
// Adds centralized logging and supports new Ollama provider via callLLMApi.

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const reqId = crypto.randomUUID();
  const log = createRequestLogger("/api/llm/chat", reqId);
  const start = Date.now();
  let provider = "unknown";

  try {
    const body = await request.json();
    provider = body.provider;
    const { messages, options } = body;
    if (!provider || !messages) {
      return new NextResponse("Provider and messages are required", { status: 400 });
    }

    log.info({ provider, options }, "llm.chat.begin");
    const formattedPrompt = messages.map((m: any) => m.content);
    const systemMessage = messages.find((m: any) => m.role === "system");
    const response = await callLLMApi(provider, formattedPrompt, {
      ...options,
      systemPrompt: systemMessage?.content || options?.systemPrompt,
    });

    const ms = Date.now() - start;
    await recordAnalyticsEvent({
      event: "llm_request",
      payload: {
        provider,
        model: options?.model || "default",
        promptTokens: response.usage?.promptTokens || 0,
        completionTokens: response.usage?.completionTokens || 0,
        totalTokens: response.usage?.totalTokens || 0,
        responseTime: ms,
        success: true,
      },
      userId: session.user.id!,
    });
    log.info({ ms }, "llm.chat.success");

    return NextResponse.json({
      role: "assistant",
      content: response.text,
      timestamp: Date.now(),
      metadata: {
        ...(response.usage || {}),
        ...(response.metadata || {}),
      },
    });
  } catch (error: any) {
    const ms = Date.now() - start;
    log.error({ error: error?.message, provider, ms }, "llm.chat.error");
    try {
      await recordAnalyticsEvent({
        event: "llm_error",
        payload: { provider, error: error?.message || "Unknown", responseTime: ms, success: false },
        userId: session.user.id!,
      });
    } catch {}
    return new NextResponse(error?.message || "Internal Server Error", { status: 500 });
  }
}


