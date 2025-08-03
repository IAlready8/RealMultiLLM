import { NextResponse } from "next/server";

const providers = [
  { id: "openai", name: "OpenAI", models: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"] },
  { id: "claude", name: "Claude", models: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"] },
  { id: "google", name: "Google AI", models: ["gemini-pro", "gemini-ultra"] },
  { id: "llama", name: "Llama", models: ["llama-3", "llama-2-70b"] },
  { id: "github", name: "GitHub", models: ["github-copilot"] },
  { id: "grok", name: "Grok", models: ["grok-1"] },
];

export async function GET() {
  return NextResponse.json(providers);
}
