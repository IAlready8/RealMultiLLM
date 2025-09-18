export type PromptOptimizationTechnique = 'clarity' | 'specificity' | 'conciseness' | 'structure';

export async function optimizePrompt(prompt: string, technique: PromptOptimizationTechnique = 'clarity') {
  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new Error('Prompt cannot be empty');
  }

  switch (technique) {
    case 'clarity':
      return ensureEndsWithPunctuation(`Please provide a clear and thorough response to the following: ${trimmed}`);
    case 'specificity':
      return `${trimmed}

Please include concrete details, examples, and reference points where possible.`;
    case 'conciseness':
      return `${trimmed}

Respond concisely, focusing only on the key information.`;
    case 'structure':
      return `${trimmed}

Format the answer with clear headings, bullet points, and short paragraphs where appropriate.`;
    default:
      return trimmed;
  }
}

function ensureEndsWithPunctuation(value: string) {
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

export type ABTestResult = {
  modelA: {
    text: string;
    quality: number;
    speed: number;
    cost: number;
    score: number;
  };
  modelB: {
    text: string;
    quality: number;
    speed: number;
    cost: number;
    score: number;
  };
  winner: 'modelA' | 'modelB';
};

export async function runABTest(
  prompt: string,
  modelA: string,
  modelB: string,
  testParams: {
    weightQuality?: number;
    weightSpeed?: number;
    weightCost?: number;
  } = {},
): Promise<ABTestResult> {
  if (!prompt.trim()) {
    throw new Error('Prompt cannot be empty');
  }

  const qualityWeight = testParams.weightQuality ?? 0.5;
  const speedWeight = testParams.weightSpeed ?? 0.3;
  const costWeight = testParams.weightCost ?? 0.2;
  const totalWeight = qualityWeight + speedWeight + costWeight;

  if (totalWeight <= 0) {
    throw new Error('Invalid test parameter weights');
  }

  const normalize = (value: number) => value / totalWeight;

  const responseA = simulateModelResponse(prompt, modelA);
  const responseB = simulateModelResponse(prompt, modelB);

  const maxSpeed = Math.max(responseA.speed, responseB.speed);
  const maxCost = Math.max(responseA.cost, responseB.cost);

  const scoreA =
    responseA.quality * normalize(qualityWeight) +
    (maxSpeed - responseA.speed) / maxSpeed * normalize(speedWeight) +
    (maxCost - responseA.cost) / maxCost * normalize(costWeight);

  const scoreB =
    responseB.quality * normalize(qualityWeight) +
    (maxSpeed - responseB.speed) / maxSpeed * normalize(speedWeight) +
    (maxCost - responseB.cost) / maxCost * normalize(costWeight);

  return {
    modelA: { ...responseA, score: scoreA },
    modelB: { ...responseB, score: scoreB },
    winner: scoreA >= scoreB ? 'modelA' : 'modelB',
  };
}

function simulateModelResponse(prompt: string, model: string) {
  const seeded = seededRandom(prompt.length + model.length);
  const quality = 0.65 + seeded() * 0.35;
  const speed = 250 + seeded() * 500; // milliseconds
  const cost = 0.0005 + seeded() * 0.001; // USD

  return {
    text: `Simulated response from ${model}: ${prompt.slice(0, 96)}${prompt.length > 96 ? '…' : ''}`,
    quality,
    speed,
    cost,
  };
}

// Simple seeded pseudo-random generator for deterministic simulations
function seededRandom(seed: number) {
  let value = Math.sin(seed) * 10000;
  return function () {
    value = Math.sin(value) * 10000;
    return value - Math.floor(value);
  };
}

export type EnsembleMethod = 'majority_vote' | 'confidence_weighted' | 'best_of_n';

export type EnsembleResult = {
  text: string;
  confidence: number;
  sources: Array<{ model: string; text: string; confidence: number }>;
};

export async function ensembleModels(
  prompt: string,
  models: string[],
  method: EnsembleMethod = 'majority_vote',
): Promise<EnsembleResult> {
  if (!prompt.trim()) {
    throw new Error('Prompt cannot be empty');
  }

  if (!models.length) {
    throw new Error('At least one model is required for ensembling');
  }

  const responses = models.map((model) => {
    const seeded = seededRandom(prompt.length + model.length * 3);
    const confidence = 0.6 + seeded() * 0.4;
    return {
      model,
      text: `Simulated response from ${model}: ${prompt.slice(0, 140)}${prompt.length > 140 ? '…' : ''}`,
      confidence,
    };
  });

  switch (method) {
    case 'majority_vote': {
      const winner = responses.reduce((longest, current) =>
        current.text.length > longest.text.length ? current : longest,
      );
      return {
        text: winner.text,
        confidence: winner.confidence,
        sources: responses,
      };
    }
    case 'confidence_weighted': {
      const confidenceSum = responses.reduce((acc, item) => acc + item.confidence, 0);
      const text = responses
        .map((item) => `${item.model.toUpperCase()} (${(item.confidence * 100).toFixed(1)}% confidence):\n${item.text}`)
        .join('\n\n');
      return {
        text,
        confidence: confidenceSum / responses.length,
        sources: responses,
      };
    }
    case 'best_of_n': {
      const winner = responses.reduce((best, current) =>
        current.confidence > best.confidence ? current : best,
      );
      return {
        text: winner.text,
        confidence: winner.confidence,
        sources: responses,
      };
    }
    default:
      return {
        text: responses[0].text,
        confidence: responses[0].confidence,
        sources: responses,
      };
  }
}
