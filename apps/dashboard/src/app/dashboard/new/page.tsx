'use client';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Loader2,
  Palette,
  Sparkles,
  Upload,
} from 'lucide-react';

const steps = [
  'Business name',
  'Business type',
  'Services',
  'Brand identity',
  'Target audience',
  'Website goal',
  'Review & generate',
];
const types = [
  'Professional services',
  'Health & wellness',
  'Technology & SaaS',
  'Creative & design',
  'Retail & e-commerce',
  'Food & hospitality',
];
const stages = [
  'Analyzing business',
  'Building sitemap',
  'Writing content',
  'Creating design',
  'Rendering Elementor',
  'Preparing deployment',
];
export default function NewWebsite() {
  const [step, setStep] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(3);
  const next = () => {
    if (step === 6) {
      setGenerating(true);
      return;
    }
    setStep((x) => Math.min(6, x + 1));
  };
  if (generating)
    return <Generation progress={progress} setProgress={setProgress} />;
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
        {steps.map((s, i) => (
          <div className="flex flex-1 items-center last:flex-none" key={s}>
            <div className="flex flex-col items-center gap-2">
              <span
                className={`grid size-8 place-items-center rounded-full text-xs font-semibold ${i < step ? 'bg-emerald-500 text-white' : i === step ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground border'}`}
              >
                {i < step ? <Check className="size-4" /> : i + 1}
              </span>
              <span
                className={`whitespace-nowrap text-[11px] ${i === step ? 'font-medium' : 'text-muted-foreground'}`}
              >
                {s}
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
        <Step step={step} />
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
            onClick={next}
            className="bg-primary text-primary-foreground shadow-primary/20 flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium shadow-lg"
          >
            {step === 6 ? (
              <>
                <Sparkles className="size-4" />
                Generate website
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
function Step({ step }: { step: number }) {
  const titles = [
    [
      'What’s your business called?',
      'This will appear throughout your website.',
    ],
    ['What kind of business is it?', 'Choose the option that fits best.'],
    ['What services do you offer?', 'Add your primary services or products.'],
    [
      'Make it feel like your brand',
      'Upload a logo and choose your brand colors.',
    ],
    ['Who are you trying to reach?', 'Describe your ideal customers.'],
    ['What should your website achieve?', 'Pick the primary outcome you want.'],
    [
      'Ready to create your website?',
      'Review your details before we bring it to life.',
    ],
  ];
  return (
    <div>
      <h2 className="mt-2 text-xl font-semibold">{titles[step]?.[0]}</h2>
      <p className="text-muted-foreground mt-1 text-sm">{titles[step]?.[1]}</p>
      <div className="mt-6">
        {step === 0 && (
          <>
            <label className="text-sm font-medium">
              Business name
              <input
                autoFocus
                className="field mt-2"
                defaultValue="Northstar Advisory"
              />
            </label>
            <label className="mt-5 block text-sm font-medium">
              Short description{' '}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
              <textarea
                className="field mt-2 min-h-24 resize-none"
                placeholder="We help growing companies..."
              />
            </label>
          </>
        )}
        {step === 1 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {types.map((x, i) => (
              <label
                key={x}
                className={`cursor-pointer rounded-lg border p-4 text-sm font-medium transition ${i === 0 ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
              >
                <input
                  className="mr-3"
                  type="radio"
                  name="type"
                  defaultChecked={i === 0}
                />
                {x}
              </label>
            ))}
          </div>
        )}
        {step === 2 && (
          <>
            <label className="text-sm font-medium">Services</label>
            <div className="mt-2 flex flex-wrap gap-2 rounded-lg border p-3">
              {[
                'Strategy consulting',
                'Market research',
                'Growth planning',
              ].map((x) => (
                <span
                  className="bg-primary/10 text-primary rounded-md px-2.5 py-1.5 text-sm"
                  key={x}
                >
                  {x} ×
                </span>
              ))}
              <input
                className="min-w-32 flex-1 bg-transparent p-1 text-sm outline-none"
                placeholder="Add a service..."
              />
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Press enter after each service.
            </p>
          </>
        )}
        {step === 3 && (
          <div className="grid gap-6 sm:grid-cols-2">
            <button className="text-muted-foreground hover:bg-muted grid h-32 place-items-center rounded-xl border border-dashed text-sm">
              <span className="grid place-items-center gap-2">
                <Upload className="size-5" />
                Upload your logo<span className="text-xs">PNG, JPG or SVG</span>
              </span>
            </button>
            <div>
              <label className="text-sm font-medium">Brand colors</label>
              <div className="mt-3 flex gap-3">
                {['#6658E8', '#141B2D', '#F6F7FB'].map((x) => (
                  <span
                    key={x}
                    className="border-card ring-border size-11 rounded-full border-4 shadow ring-1"
                    style={{ background: x }}
                  />
                ))}
                <button className="grid size-11 place-items-center rounded-full border">
                  <Palette className="size-4" />
                </button>
              </div>
            </div>
          </div>
        )}
        {step === 4 && (
          <textarea
            className="field min-h-36 resize-none"
            defaultValue="Founders and leadership teams at growing B2B companies with 10–100 employees who value clear, practical strategic guidance."
          />
        )}
        {step === 5 && (
          <div className="space-y-3">
            {[
              'Generate qualified leads',
              'Book more appointments',
              'Sell products online',
              'Showcase my work',
              'Build brand awareness',
            ].map((x, i) => (
              <label
                key={x}
                className={`flex cursor-pointer items-center rounded-lg border p-4 text-sm font-medium ${i === 0 ? 'border-primary bg-primary/5' : ''}`}
              >
                <input
                  className="mr-3"
                  type="radio"
                  name="goal"
                  defaultChecked={i === 0}
                />
                {x}
              </label>
            ))}
          </div>
        )}
        {step === 6 && (
          <div className="space-y-3">
            {[
              ['Business', 'Northstar Advisory · Professional services'],
              [
                'Services',
                'Strategy consulting, Market research, Growth planning',
              ],
              ['Audience', 'B2B founders and leadership teams'],
              ['Goal', 'Generate qualified leads'],
              ['Brand', 'Logo uploaded · 3 colors selected'],
            ].map((x) => (
              <div
                className="bg-muted flex justify-between gap-4 rounded-lg p-3"
                key={x[0]}
              >
                <span className="text-muted-foreground text-sm">{x[0]}</span>
                <span className="text-right text-sm font-medium">{x[1]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
function Generation({
  progress,
  setProgress,
}: {
  progress: number;
  setProgress: (n: number) => void;
}) {
  return (
    <div className="mx-auto max-w-2xl py-8 sm:py-16">
      <div className="text-center">
        <span className="bg-primary/10 text-primary mx-auto grid size-14 place-items-center rounded-2xl">
          <Sparkles className="size-6" />
        </span>
        <h1 className="mt-5 text-2xl font-semibold">
          Creating Northstar Advisory
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          We’re turning your ideas into a polished website. This usually takes
          4–6 minutes.
        </p>
      </div>
      <div className="card mt-8 p-6 sm:p-8">
        <div className="mb-7 flex items-end justify-between">
          <div>
            <p className="text-sm font-medium">Generation progress</p>
            <p className="text-muted-foreground mt-1 text-xs">
              Stage {progress + 1} of {stages.length}
            </p>
          </div>
          <p className="text-2xl font-semibold">
            {Math.round(((progress + 0.5) / stages.length) * 100)}%
          </p>
        </div>
        <div className="bg-muted mb-8 h-2 overflow-hidden rounded-full">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all"
            style={{ width: `${((progress + 0.5) / stages.length) * 100}%` }}
          />
        </div>
        <div className="space-y-1">
          {stages.map((x, i) => (
            <div
              key={x}
              className={`flex items-center gap-3 rounded-lg p-3 ${i === progress ? 'bg-primary/5' : ''}`}
            >
              {i < progress ? (
                <CheckCircle2 className="size-5 text-emerald-500" />
              ) : i === progress ? (
                <Loader2 className="text-primary size-5 animate-spin" />
              ) : (
                <Circle className="text-border size-5" />
              )}
              <span
                className={`text-sm ${i === progress ? 'font-medium' : i > progress ? 'text-muted-foreground' : ''}`}
              >
                {x}
              </span>
              {i < progress && (
                <span className="text-muted-foreground ml-auto text-xs">
                  Complete
                </span>
              )}
              {i === progress && (
                <span className="text-primary ml-auto text-xs">
                  In progress
                </span>
              )}
            </div>
          ))}
        </div>
        {progress < 5 && (
          <button
            onClick={() => setProgress(progress + 1)}
            className="text-muted-foreground mt-6 w-full rounded-lg border py-2 text-xs"
          >
            Preview next stage
          </button>
        )}
      </div>
      <p className="text-muted-foreground mt-5 text-center text-xs">
        You can safely leave this page. We’ll notify you when your website is
        ready.
      </p>
    </div>
  );
}
