import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  ensembleModels,
  optimizePrompt,
  runABTest,
} from '@/services/prompt-optimization-service';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { prompt, technique, models, method, testParams } = body ?? {};

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (technique) {
      const optimized = await optimizePrompt(prompt, technique);
      return NextResponse.json({ original: prompt, optimized, technique });
    }

    if (Array.isArray(models) && models.length > 0) {
      if (method === 'ab_test') {
        if (models.length < 2) {
          return NextResponse.json({ error: 'A/B testing requires two models' }, { status: 400 });
        }
        const result = await runABTest(prompt, models[0], models[1], testParams);
        return NextResponse.json(result);
      }

      const ensemble = await ensembleModels(prompt, models, method);
      return NextResponse.json(ensemble);
    }

    return NextResponse.json({ error: 'Invalid request parameters' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'Failed to process request' }, { status: 400 });
  }
}
