import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendChatMessage } from "@/services/api-service";
import { recordAnalyticsEvent } from "@/services/analytics-service";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const startTime = Date.now();

  let provider = "unknown";
  
  try {
    const requestBody = await request.json();
    provider = requestBody.provider;
    const { messages, options } = requestBody;

    if (!provider || !messages) {
      return new NextResponse("Provider and messages are required", { status: 400 });
    }

    const response = await sendChatMessage(provider, messages, options);
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    // Record successful analytics event
    await recordAnalyticsEvent({
      event: "llm_request",
      payload: {
        provider,
        model: options?.model || "default",
        promptTokens: response.metadata?.promptTokens || 0,
        completionTokens: response.metadata?.completionTokens || 0,
        totalTokens: response.metadata?.totalTokens || 0,
        responseTime,
        success: true
      },
      userId: session.user.id!
    });

    return NextResponse.json(response);
  } catch (error: any) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.error("Error in LLM chat API:", error);
    
    // Record error analytics event
    try {
      await recordAnalyticsEvent({
        event: "llm_error",
        payload: {
          provider,
          error: error.message,
          responseTime,
          success: false
        },
        userId: session.user.id!
      });
    } catch (analyticsError) {
      console.error("Failed to record analytics event:", analyticsError);
    }
    
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
