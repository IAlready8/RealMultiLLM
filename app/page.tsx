import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-[calc(100vh-64px)] py-2">
      {/* subtle ambient accents */}
      <div className="ambient-orb ambient-orb--left" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--right" aria-hidden="true" />

      <h1 className="heading-underline text-4xl font-bold text-white mb-4">Welcome to MultiLLM Chat Assistant</h1>
      <p className="text-lg text-gray-400 mb-4">Your personal tool for interacting with multiple LLM APIs.</p>
      <div className="mb-8">
        <Link href="/settings" className="text-xs text-gray-300 hover:text-white px-3 py-1 rounded-md border border-gray-700 bg-gray-900/40 rainbow-outline-hover">
          New: OpenRouter free models now available →
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
        <Card className="flex flex-col rainbow-outline-hover">
          <CardHeader>
            <CardTitle>Start New Chat</CardTitle>
            <CardDescription>Begin a new conversation with your chosen LLM.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex items-end">
            <Link href="/multi-chat" passHref>
              <Button className="w-full">Go to Multi-Chat</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="flex flex-col rainbow-outline-hover">
          <CardHeader>
            <CardTitle>View Analytics</CardTitle>
            <CardDescription>See your usage statistics and model comparisons.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex items-end">
            <Link href="/analytics" passHref>
              <Button className="w-full">View Analytics</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="flex flex-col rainbow-outline-hover">
          <CardHeader>
            <CardTitle>Configure Settings</CardTitle>
            <CardDescription>Manage your API keys and application preferences.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow flex items-end">
            <Link href="/settings" passHref>
              <Button className="w-full">Go to Settings</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
