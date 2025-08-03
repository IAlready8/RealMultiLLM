"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, BarChart3, Users, Settings, Target, GitBranch } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Personal LLM Tool
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            A comprehensive multi-LLM chat assistant with advanced features for conversations, comparisons, personas, and analytics.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Link href="/multi-chat">
            <Card className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <MessageSquare className="h-5 w-5 text-blue-400" />
                  Multi-Chat
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Chat with multiple LLMs simultaneously and compare responses in real-time
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/comparison">
            <Card className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <BarChart3 className="h-5 w-5 text-green-400" />
                  Comparison
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Side-by-side model comparison with detailed analysis and metrics
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/personas">
            <Card className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Users className="h-5 w-5 text-purple-400" />
                  Personas
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Create and manage AI personas with custom prompts and behaviors
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/goal-hub">
            <Card className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Target className="h-5 w-5 text-red-400" />
                  Goal Hub
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Track and manage your goals with AI-powered assistance
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/pipeline">
            <Card className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <GitBranch className="h-5 w-5 text-yellow-400" />
                  Pipeline
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Create complex AI workflows with multi-step processing pipelines
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/analytics">
            <Card className="bg-gray-800 border-gray-700 hover:bg-gray-750 transition-colors cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <BarChart3 className="h-5 w-5 text-cyan-400" />
                  Analytics
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Comprehensive usage analytics and performance insights
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>

        <div className="text-center">
          <Link href="/settings">
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Settings className="mr-2 h-4 w-4" />
              Configure Settings
            </Button>
          </Link>
        </div>

        <div className="mt-12 text-center text-gray-400">
          <p>Powered by OpenAI, Claude, Google AI, Llama, GitHub Copilot, and Grok</p>
        </div>
      </div>
    </div>
  );
}