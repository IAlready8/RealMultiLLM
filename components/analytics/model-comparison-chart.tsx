
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar } from "@/components/ui/chart";
import { Badge } from "@/components/ui/badge";

interface ModelComparisonData {
  provider: string;
  factualAccuracy: number;
  creativity: number;
  helpfulness: number;
  coherence: number;
  conciseness: number;
}

interface ModelComparisonChartProps {
  data: ModelComparisonData[];
  title?: string;
}

export function ModelComparisonChart({ data, title = "Model Comparison" }: ModelComparisonChartProps) {
  // Find the best model for each metric
  const bestModels = {
    factualAccuracy: getBestModel(data, "factualAccuracy"),
    creativity: getBestModel(data, "creativity"),
    helpfulness: getBestModel(data, "helpfulness"),
    coherence: getBestModel(data, "coherence"),
    conciseness: getBestModel(data, "conciseness")
  };
  
  // Calculate overall scores
  const dataWithOverall = data.map(item => ({
    ...item,
    overall: (
      item.factualAccuracy + 
      item.creativity + 
      item.helpfulness + 
      item.coherence + 
      item.conciseness
    ) / 5
  }));
  
  // Find the best overall model
  const bestOverall = dataWithOverall.reduce((best, current) => 
    current.overall > best.overall ? current : best
  , dataWithOverall[0]);
  
  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          {title}
          <Badge variant="outline" className="bg-blue-900/20 text-blue-500">
            Best Overall: {bestOverall.provider}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <BarChart data={data} xAxisKey="provider">
          <Bar dataKey="factualAccuracy" fill="#3B82F6" name="Factual Accuracy" />
          <Bar dataKey="creativity" fill="#10B981" name="Creativity" />
          <Bar dataKey="helpfulness" fill="#F59E0B" name="Helpfulness" />
          <Bar dataKey="coherence" fill="#8B5CF6" name="Coherence" />
          <Bar dataKey="conciseness" fill="#EC4899" name="Conciseness" />
        </BarChart>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2 mt-4">
          <div className="bg-gray-800 p-2 rounded-md">
            <div className="text-xs text-gray-400">Best Factual Accuracy</div>
            <div className="font-medium">{bestModels.factualAccuracy}</div>
          </div>
          <div className="bg-gray-800 p-2 rounded-md">
            <div className="text-xs text-gray-400">Best Creativity</div>
            <div className="font-medium">{bestModels.creativity}</div>
          </div>
          <div className="bg-gray-800 p-2 rounded-md">
            <div className="text-xs text-gray-400">Best Helpfulness</div>
            <div className="font-medium">{bestModels.helpfulness}</div>
          </div>
          <div className="bg-gray-800 p-2 rounded-md">
            <div className="text-xs text-gray-400">Best Coherence</div>
            <div className="font-medium">{bestModels.coherence}</div>
          </div>
          <div className="bg-gray-800 p-2 rounded-md">
            <div className="text-xs text-gray-400">Best Conciseness</div>
            <div className="font-medium">{bestModels.conciseness}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function getBestModel(data: ModelComparisonData[], metric: keyof Omit<ModelComparisonData, 'provider'>): string {
  return data.reduce((best, current) => 
    current[metric] > best[metric] ? current : best
  , data[0]).provider;
}
