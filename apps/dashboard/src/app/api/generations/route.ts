import { NextResponse } from 'next/server';
import {
  AsyncGenerationPipeline,
  createOpenAIProvider,
} from '@website-generator/ai';
import {
  runMockWebsiteGeneration,
  wizardDataToBusinessProfile,
  type WebsiteWizardData,
} from '@/lib/website-generation';

export const runtime = 'nodejs';

const isWizardData = (value: unknown): value is WebsiteWizardData => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  return (
    [
      'businessName',
      'description',
      'businessType',
      'targetAudience',
      'websiteGoal',
    ].every((key) => typeof input[key] === 'string' && input[key].trim()) &&
    Array.isArray(input.services) &&
    input.services.every((item) => typeof item === 'string') &&
    Array.isArray(input.brandColors) &&
    input.brandColors.every((item) => typeof item === 'string')
  );
};

/** Starts an in-memory generation. Provider credentials never cross this server boundary. */
export async function POST(request: Request) {
  try {
    const input: unknown = await request.json();
    if (!isWizardData(input))
      return NextResponse.json(
        { error: 'Valid business details are required.' },
        { status: 400 },
      );
    const providerName =
      process.env.AI_PROVIDER === 'openai' ? 'openai' : 'mock';
    if (providerName === 'mock') {
      const result = await runMockWebsiteGeneration(input, () => undefined, {
        delayMs: 0,
      });
      return NextResponse.json({ provider: providerName, result });
    }
    const provider = createOpenAIProvider();
    const pipeline = new AsyncGenerationPipeline(provider);
    const generated = await pipeline.generate({
      profile: wizardDataToBusinessProfile(input),
      signal: request.signal,
    });
    return NextResponse.json({
      provider: providerName,
      runId: generated.runId,
      blueprint: generated.blueprint,
      usage: provider.client.usage,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.startsWith('The AI service')
        ? error.message
        : 'Website generation could not be started. Please try again.';
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
