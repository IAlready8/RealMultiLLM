'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ProviderConfig from '@/components/provider-config';
import ApiKeyTester from '@/components/api-key-tester';

export default function ProviderManagementPage() {
  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Provider Management</h1>
        <p className="text-muted-foreground mt-2">
          Configure and test your LLM provider API keys
        </p>
      </div>

      <Tabs defaultValue="config" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="config">Provider Configuration</TabsTrigger>
          <TabsTrigger value="test">API Key Tester</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <ProviderConfig />
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <ApiKeyTester />
        </TabsContent>
      </Tabs>
    </div>
  );
}
