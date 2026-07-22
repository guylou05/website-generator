import type { BusinessProfile, GenerationEvent } from '@website-generator/ai';
import {
  MockAiProvider,
  WebsiteGenerationOrchestrator,
} from '@website-generator/ai';
import type { SiteBlueprint } from '@website-generator/shared/schema';

export const generationStages = [
  ['analysis', 'Analyzing business'],
  ['planning', 'Planning sitemap'],
  ['seo', 'Generating SEO'],
  ['writing', 'Writing content'],
  ['design', 'Selecting design'],
  ['blueprint', 'Building blueprint'],
  ['validation', 'Validating blueprint'],
  ['elementor', 'Rendering Elementor'],
  ['deployment', 'Packaging deployment'],
] as const;
export type DashboardStage = (typeof generationStages)[number][0];

export interface WebsiteWizardData {
  businessName: string;
  description: string;
  businessType: string;
  services: string[];
  brandColors: string[];
  targetAudience: string;
  websiteGoal: string;
}
export function wizardDataToBusinessProfile(
  data: Readonly<WebsiteWizardData>,
): BusinessProfile {
  return {
    businessName: data.businessName.trim(),
    description: data.description.trim(),
    industry: data.businessType,
    targetAudiences: [data.targetAudience],
    productsOrServices: data.services.map((name) => ({
      name,
      description: `${name} provided by ${data.businessName.trim()}`,
      audience: data.targetAudience,
    })),
    differentiators: [],
    goals: [data.websiteGoal],
    brandPreferences: Object.fromEntries(
      data.brandColors.map((color, i) => [`color${i + 1}`, color]),
    ),
  };
}
export interface MockGenerationResult {
  websiteName: string;
  pagesGenerated: number;
  blueprintValid: boolean;
  elementorReady: boolean;
}
export interface GenerationViewState {
  status: 'idle' | 'running' | 'success' | 'failed' | 'cancelled';
  currentStage: DashboardStage | null;
  completedStages: DashboardStage[];
  failedStage: DashboardStage | null;
  percentage: number;
  error?: string;
  result?: MockGenerationResult;
}
export const initialGenerationState: GenerationViewState = {
  status: 'idle',
  currentStage: null,
  completedStages: [],
  failedStage: null,
  percentage: 0,
};
export type GenerationAction =
  | { type: 'start'; stage: DashboardStage }
  | { type: 'complete'; stage: DashboardStage }
  | { type: 'fail'; stage: DashboardStage; error: string }
  | { type: 'cancel' }
  | { type: 'success'; result: MockGenerationResult };
export function generationReducer(
  state: GenerationViewState,
  action: GenerationAction,
): GenerationViewState {
  if (action.type === 'start')
    return {
      completedStages: state.completedStages,
      percentage: state.percentage,
      ...(state.result ? { result: state.result } : {}),
      status: 'running',
      currentStage: action.stage,
      failedStage: null,
    };
  if (action.type === 'complete') {
    const completedStages = state.completedStages.includes(action.stage)
      ? state.completedStages
      : [...state.completedStages, action.stage];
    return {
      ...state,
      completedStages,
      percentage: Math.round(
        (completedStages.length / generationStages.length) * 100,
      ),
    };
  }
  if (action.type === 'fail')
    return {
      ...state,
      status: 'failed',
      currentStage: action.stage,
      failedStage: action.stage,
      error: action.error,
    };
  if (action.type === 'cancel')
    return { ...state, status: 'cancelled', currentStage: null };
  return {
    ...state,
    status: 'success',
    currentStage: null,
    failedStage: null,
    percentage: 100,
    result: action.result,
  };
}

export interface MockRunOptions {
  signal?: AbortSignal;
  failStage?: DashboardStage;
  delayMs?: number;
}
const mockBlueprint = {
  schemaVersion: '1.0',
  pages: [
    { id: 'home' },
    { id: 'about' },
    { id: 'services' },
    { id: 'contact' },
  ],
} as unknown as SiteBlueprint;
const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Cancelled', 'AbortError'));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Cancelled', 'AbortError'));
      },
      { once: true },
    );
  });

/** Runs the existing provider-neutral orchestrator with deterministic, local-only providers. */
export async function runMockWebsiteGeneration(
  data: Readonly<WebsiteWizardData>,
  onAction: (action: GenerationAction) => void,
  options: MockRunOptions = {},
): Promise<MockGenerationResult> {
  const profile = wizardDataToBusinessProfile(data);
  const delayMs = options.delayMs ?? 250;
  const responses = {
    analysis: {
      summary: profile.description,
      industry: profile.industry,
      audiences: [],
      offerings: profile.productsOrServices,
      valueProposition: profile.description,
      goals: profile.goals,
      recommendedTone: ['clear'],
      constraints: [],
    },
    plan: {
      strategy: profile.goals[0] ?? 'Inform',
      primaryGoal: profile.goals[0] ?? 'Contact',
      navigation: [],
      pages: [],
    },
    content: { pages: {} },
    seo: { siteTitle: profile.businessName, pages: {} },
    design: {
      direction: 'Clean',
      colors: {
        primary: '#6658E8',
        secondary: '#141B2D',
        accent: '#8B7FFF',
        background: '#FFFFFF',
        surface: '#F6F7FB',
        text: '#141B2D',
        mutedText: '#667085',
      },
      typography: { headingFont: 'Inter', bodyFont: 'Inter' },
      globalStyles: {
        borderRadius: 'medium' as const,
        contentWidth: 'standard' as const,
        spacingScale: 'comfortable' as const,
      },
      pageLayouts: {},
    },
    blueprint: mockBlueprint,
  };
  const provider = new MockAiProvider(responses);
  const aiStages = [
    'analysis',
    'planning',
    'writing',
    'seo',
    'design',
    'blueprint',
  ];
  if (options.failStage && aiStages.includes(options.failStage)) {
    const mapped =
      options.failStage === 'planning'
        ? 'plan'
        : options.failStage === 'writing'
          ? 'content'
          : options.failStage;
    provider.failNext(mapped as Parameters<typeof provider.failNext>[0], 2);
  }
  const delayed =
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
    async (...args: A) => {
      await wait(delayMs, options.signal);
      return fn(...args);
    };
  const orchestrator = new WebsiteGenerationOrchestrator({
    projects: { getProfile: async () => profile },
    analyzer: { analyze: delayed(provider.analyzer.analyze) },
    planner: { plan: delayed(provider.planner.plan) },
    writer: { write: delayed(provider.writer.write) },
    seoGenerator: { generate: delayed(provider.seoGenerator.generate) },
    designer: { plan: delayed(provider.designer.plan) },
    blueprintGenerator: {
      generate: delayed(provider.blueprintGenerator.generate),
    },
    retryPolicy: { maxAttempts: 2, shouldRetry: () => true, delayMs: () => 50 },
    reporter: {
      report(event: GenerationEvent) {
        if (event.type === 'stage.started')
          onAction({ type: 'start', stage: event.progress.stage });
        if (event.type === 'stage.completed')
          onAction({ type: 'complete', stage: event.progress.stage });
        if (event.type === 'stage.failed')
          onAction({
            type: 'fail',
            stage: event.progress.stage,
            error: `Could not complete ${event.progress.stage}`,
          });
      },
    },
  });
  const generated = await orchestrator.generateWebsite('dashboard-preview');
  for (const stage of ['validation', 'elementor', 'deployment'] as const) {
    onAction({ type: 'start', stage });
    await wait(delayMs, options.signal);
    if (options.failStage === stage) {
      onAction({ type: 'fail', stage, error: `Could not complete ${stage}` });
      throw new Error(`Mock ${stage} failure`);
    }
    onAction({ type: 'complete', stage });
  }
  const result = {
    websiteName: profile.businessName,
    pagesGenerated: generated.blueprint.pages.length,
    blueprintValid: true,
    elementorReady: true,
  };
  onAction({ type: 'success', result });
  return result;
}
