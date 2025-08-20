import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { callLLMServer } from "@/lib/llm-api-client-server";
import { recordAnalyticsEvent } from "@/services/analytics-service";
import { createRequestLogger } from "@/lib/logger";
import { ChatRequestSchema } from "@/lib/validation-schemas";
import { sanitizeChatMessage } from "@/lib/sanitize";
import { safeHandleApiError, ErrorCodes, createApiError } from "@/lib/error-handler";
import { checkRateLimit } from "@/lib/rate-limit";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { withValidation } from "@/lib/validation-middleware";

// Create a middleware for chat request validation
const validateChat = withValidation(ChatRequestSchema);

// OVERWRITTEN FILE: app/api/llm/chat/route.ts (complete rewrite)
// Adds centralized logging and supports new Ollama provider via callLLMApi.

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json(
      createApiError(ErrorCodes.AUTHENTICATION_ERROR, "Authentication required"),
      { status: 401 }
    );
  }

  const userId = (session.user as { id?: string })?.id;
  if (!userId) {
    return NextResponse.json(
      createApiError(ErrorCodes.AUTHENTICATION_ERROR, "User ID not found"),
      { status: 400 }
    );
  }

  // Apply rate limiting for LLM API calls
  const rateLimitResult = await checkRateLimit(
    request as any, 
    'apiLLM', 
    userId
  );
  if (!rateLimitResult.success && rateLimitResult.error) {
    return rateLimitResult.error;
  }

  const reqId = randomUUID();
  const log = createRequestLogger("/api/llm/chat", reqId);
  const start = Date.now();
  let provider = "unknown";

  try {
    // Apply validation middleware
    const validationResponse = await validateChat(request as any);
    if (validationResponse) {
      return validationResponse;
    }

    const body = await request.json();
    
    // Validate request structure
    try {
      const validatedRequest = ChatRequestSchema.parse(body);
      provider = validatedRequest.provider;
      const { messages, options } = validatedRequest;

      log.info({ provider, options }, "llm.chat.begin");
      
      // Sanitize message content
      const sanitizedMessages = messages.map((m) => ({
        role: m.role,
        content: sanitizeChatMessage(m.content)
      }));

      // Format messages for the LLM API client
      const formattedMessages = sanitizedMessages.map((m) => ({
        role: m.role,
        content: m.content
      }));
      
      // Extract system prompt if present
      const systemMessage = sanitizedMessages.find((m) => m.role === "system");
      const systemPrompt = systemMessage?.content;
      
      // Call the LLM with the properly formatted messages
      const response = await callLLMServer(provider, formattedMessages, {
        ...options,
        systemPrompt
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
        userId,
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
    } catch (validationError) {
      const ms = Date.now() - start;
      log.error({ error: validationError, provider, ms }, "llm.chat.validation.error");
      return safeHandleApiError(validationError, "/api/llm/chat", userId);
    }
  } catch (error: any) {
    const ms = Date.now() - start;
    log.error({ error: error?.message, provider, ms }, "llm.chat.error");
    try {
      await recordAnalyticsEvent({
        event: "llm_error",
        payload: { provider, error: error?.message || "Unknown", responseTime: ms, success: false },
        userId,
      });
    } catch {}
    return safeHandleApiError(error, "/api/llm/chat", userId);
  }
}