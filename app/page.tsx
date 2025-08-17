import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] py-2">
      <h1 className="text-4xl font-bold text-white mb-4">Welcome to MultiLLM Chat Assistant</h1>
      <p className="text-lg text-gray-400 mb-8">Your personal tool for interacting with multiple LLM APIs.</p>
      
      {/* Quick Access for Development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-500 rounded-lg">
          <p className="text-yellow-400 text-sm mb-2">Development Quick Access:</p>
          <div className="flex gap-2">
            <p className="text-xs text-gray-400">Email: demo@demo.com | Password: demo</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-4xl">
        <Card className="flex flex-col">
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

        <Card className="flex flex-col">
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

        <Card className="flex flex-col">
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