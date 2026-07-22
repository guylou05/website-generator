'use client';
import Link from 'next/link';
import { useReducer, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Loader2,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import {
  generationReducer,
  generationStages,
  initialGenerationState,
  runMockWebsiteGeneration,
  type WebsiteWizardData,
} from '@/lib/website-generation';

const steps = [
  'Business name',
  'Business type',
  'Services',
  'Brand identity',
  'Target audience',
  'Website goal',
  'Review & generate',
];
const initialForm: WebsiteWizardData = {
  businessName: 'Northstar Advisory',
  description: 'Practical strategic guidance for growing companies.',
  businessType: 'Professional services',
  services: ['Strategy consulting', 'Market research', 'Growth planning'],
  brandColors: ['#6658E8', '#141B2D', '#F6F7FB'],
  targetAudience:
    'Founders and leadership teams at growing B2B companies with 10–100 employees.',
  websiteGoal: 'Generate qualified leads',
};
export default function NewWebsite() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [generation, dispatch] = useReducer(
    generationReducer,
    initialGenerationState,
  );
  const controller = useRef<AbortController | null>(null);
  const start = () => {
    controller.current?.abort();
    controller.current = new AbortController();
    void runMockWebsiteGeneration(form, dispatch, {
      signal: controller.current.signal,
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError')
        dispatch({ type: 'cancel' });
    });
  };
  if (generation.status !== 'idle')
    return (
      <Generation
        form={form}
        state={generation}
        onRetry={start}
        onCancel={() => controller.current?.abort()}
      />
    );
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <p className="text-primary text-sm font-medium">New website</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Tell us about your business
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          We’ll use your answers to create a website tailored to you.
        </p>
      </div>
      <div className="mb-8 hidden items-center md:flex">
        {steps.map((label, i) => (
          <div className="flex flex-1 items-center last:flex-none" key={label}>
            <div className="flex flex-col items-center gap-2">
              <span
                className={`grid size-8 place-items-center rounded-full text-xs font-semibold ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground border'}`}
              >
                {i < step ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className={`whitespace-nowrap text-[11px] ${i === step ? 'font-medium' : 'text-muted-foreground'}`}
              >
                {label}
              </span>
            </div>
            {i < 6 && (
              <span
                className={`mx-3 mb-5 h-px flex-1 ${i < step ? 'bg-emerald-500' : 'bg-border'}`}
              />
            )}
          </div>
        ))}
      </div>
      <div className="card mx-auto max-w-2xl p-6 sm:p-8">
        <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">
          Step {step + 1} of 7
        </p>
        <WizardStep step={step} form={form} setForm={setForm} />
        <div className="mt-8 flex items-center justify-between border-t pt-5">
          <button
            disabled={step === 0}
            onClick={() => setStep((x) => x - 1)}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-0"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
          <button
            onClick={() => (step === 6 ? start() : setStep((x) => x + 1))}
            className="bg-primary text-primary-foreground flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium shadow-lg"
          >
            {step === 6 ? (
              <>
                <Sparkles className="size-4" />
                Generate Website
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
function WizardStep({
  step,
  form,
  setForm,
}: {
  step: number;
  form: WebsiteWizardData;
  setForm: (data: WebsiteWizardData) => void;
}) {
  const headings = [
    [
      'What’s your business called?',
      'This will appear throughout your website.',
    ],
    ['What kind of business is it?', 'Choose the option that fits best.'],
    ['What services do you offer?', 'Your primary products and services.'],
    ['Make it feel like your brand', 'Choose your brand colors.'],
    ['Who are you trying to reach?', 'Describe your ideal customers.'],
    ['What should your website achieve?', 'Choose the primary outcome.'],
    [
      'Ready to create your website?',
      'Review your details before we bring it to life.',
    ],
  ];
  const update = <K extends keyof WebsiteWizardData>(
    key: K,
    value: WebsiteWizardData[K],
  ) => setForm({ ...form, [key]: value });
  const heading = headings[step] ?? headings[0]!;
  return (
    <div>
      <h2 className="mt-2 text-xl font-semibold">{heading[0]}</h2>
      <p className="text-muted-foreground mt-1 text-sm">{heading[1]}</p>
      <div className="mt-6">
        {step === 0 && (
          <div className="space-y-5">
            <label className="text-sm font-medium">
              Business name
              <input
                autoFocus
                className="field mt-2"
                value={form.businessName}
                onChange={(e) => update('businessName', e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium">
              Short description
              <textarea
                className="field mt-2 min-h-24 resize-none"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
              />
            </label>
          </div>
        )}
        {step === 1 && (
          <select
            className="field"
            value={form.businessType}
            onChange={(e) => update('businessType', e.target.value)}
          >
            {[
              'Professional services',
              'Health & wellness',
              'Technology & SaaS',
              'Creative & design',
              'Retail & e-commerce',
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        )}
        {step === 2 && (
          <textarea
            className="field min-h-32"
            value={form.services.join('\n')}
            onChange={(e) =>
              update('services', e.target.value.split('\n').filter(Boolean))
            }
          />
        )}
        {step === 3 && (
          <div className="flex gap-3">
            {form.brandColors.map((color) => (
              <span
                key={color}
                className="border-card ring-border size-12 rounded-full border-4 shadow ring-1"
                style={{ background: color }}
              />
            ))}
          </div>
        )}
        {step === 4 && (
          <textarea
            className="field min-h-36 resize-none"
            value={form.targetAudience}
            onChange={(e) => update('targetAudience', e.target.value)}
          />
        )}
        {step === 5 && (
          <select
            className="field"
            value={form.websiteGoal}
            onChange={(e) => update('websiteGoal', e.target.value)}
          >
            {[
              'Generate qualified leads',
              'Book more appointments',
              'Sell products online',
              'Showcase my work',
              'Build brand awareness',
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        )}
        {step === 6 && (
          <div className="space-y-3">
            {[
              ['Business', `${form.businessName} · ${form.businessType}`],
              ['Services', form.services.join(', ')],
              ['Audience', form.targetAudience],
              ['Goal', form.websiteGoal],
              ['Brand', `${form.brandColors.length} colors selected`],
            ].map(([label, value]) => (
              <div
                className="bg-muted flex justify-between gap-4 rounded-lg p-3"
                key={label}
              >
                <span className="text-muted-foreground text-sm">{label}</span>
                <span className="text-right text-sm font-medium">{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
function Generation({
  form,
  state,
  onRetry,
  onCancel,
}: {
  form: WebsiteWizardData;
  state: ReturnType<typeof generationReducer>;
  onRetry: () => void;
  onCancel: () => void;
}) {
  if (state.status === 'success' && state.result)
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <CheckCircle2 className="mx-auto size-14 text-emerald-500" />
        <h1 className="mt-5 text-2xl font-semibold">
          {state.result.websiteName} is ready
        </h1>
        <p className="text-muted-foreground mt-2">
          Your mock project was generated successfully.
        </p>
        <div className="card mt-8 grid gap-4 p-6 text-left sm:grid-cols-3">
          <Status
            label="Pages generated"
            value={String(state.result.pagesGenerated)}
          />
          <Status
            label="Blueprint"
            value={state.result.blueprintValid ? 'Validated' : 'Invalid'}
          />
          <Status
            label="Elementor output"
            value={state.result.elementorReady ? 'Ready' : 'Unavailable'}
          />
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/dashboard/projects"
            className="rounded-lg border px-5 py-2.5 text-sm font-medium"
          >
            View Project
          </Link>
          <button className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-medium">
            Prepare Deployment
          </button>
        </div>
      </div>
    );
  return (
    <div className="mx-auto max-w-2xl py-8 sm:py-16">
      <div className="text-center">
        <Sparkles className="text-primary mx-auto size-10" />
        <h1 className="mt-5 text-2xl font-semibold">
          Creating {form.businessName}
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Live progress from the website generation orchestrator.
        </p>
      </div>
      <div className="card mt-8 p-6 sm:p-8">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <p className="text-sm font-medium">
              {state.failedStage
                ? 'Generation paused'
                : state.currentStage
                  ? generationStages.find(
                      ([id]) => id === state.currentStage,
                    )?.[1]
                  : 'Generation progress'}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {state.completedStages.length} of {generationStages.length} stages
              complete
            </p>
          </div>
          <p className="text-2xl font-semibold">{state.percentage}%</p>
        </div>
        <div className="bg-muted mb-6 h-2 overflow-hidden rounded-full">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all"
            style={{ width: `${state.percentage}%` }}
          />
        </div>
        <div className="space-y-1">
          {generationStages.map(([id, label]) => {
            const complete = state.completedStages.includes(id);
            const active = state.currentStage === id;
            const failed = state.failedStage === id;
            return (
              <div
                key={id}
                className={`flex items-center gap-3 rounded-lg p-3 ${active ? 'bg-primary/5' : ''}`}
              >
                {complete ? (
                  <CheckCircle2 className="size-5 text-emerald-500" />
                ) : failed ? (
                  <XCircle className="size-5 text-red-500" />
                ) : active ? (
                  <Loader2 className="text-primary size-5 animate-spin" />
                ) : (
                  <Circle className="text-border size-5" />
                )}
                <span className="text-sm">{label}</span>
                <span className="text-muted-foreground ml-auto text-xs">
                  {complete
                    ? 'Complete'
                    : failed
                      ? 'Failed'
                      : active
                        ? 'In progress'
                        : 'Waiting'}
                </span>
              </div>
            );
          })}
        </div>
        {state.error && (
          <p className="mt-4 text-sm text-red-600">{state.error}</p>
        )}
        <div className="mt-6 flex gap-3">
          {state.status === 'failed' || state.status === 'cancelled' ? (
            <button
              onClick={onRetry}
              className="bg-primary text-primary-foreground flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium"
            >
              <RotateCcw className="size-4" />
              Retry
            </button>
          ) : (
            <button
              onClick={onCancel}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium"
            >
              <XCircle className="size-4" />
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
function Status({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
