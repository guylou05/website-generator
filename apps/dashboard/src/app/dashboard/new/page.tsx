'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from 'lucide-react';
import { type WebsiteWizardData } from '@/lib/website-generation';
import { dashboardApi } from '@/lib/api-client';

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
  businessName: '',
  description: '',
  businessType: '',
  services: [],
  brandColors: ['#6658E8', '#141B2D', '#F6F7FB'],
  targetAudience: '',
  websiteGoal: '',
};
export default function NewWebsite() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submitted = useRef(false);
  const router = useRouter();
  const search = useSearchParams();
  useEffect(() => {
    const saved = window.localStorage.getItem('sitefoundry.website-draft');
    if (saved)
      try {
        const draft = JSON.parse(saved) as {
          step: number;
          form: WebsiteWizardData;
        };
        setStep(Math.min(draft.step, 6));
        setForm(draft.form);
      } catch {
        window.localStorage.removeItem('sitefoundry.website-draft');
      }
    const template = search.get('template');
    if (template)
      setForm((current) => ({ ...current, template }) as WebsiteWizardData);
  }, [search]);
  useEffect(() => {
    window.localStorage.setItem(
      'sitefoundry.website-draft',
      JSON.stringify({ step, form }),
    );
  }, [form, step]);
  const validation = validateStep(step, form);
  const next = () => {
    if (validation) {
      setError(validation);
      return;
    }
    setError('');
    setStep((value) => value + 1);
  };
  const start = () => {
    if (submitted.current || submitting) return;
    const issue = validateStep(6, form);
    if (issue) {
      setError(issue);
      return;
    }
    submitted.current = true;
    setSubmitting(true);
    setError('');
    void (async () => {
      try {
        const project = await dashboardApi.createProject({
          name: form.businessName,
          business_profile: { ...form },
          brand_settings: { colors: form.brandColors },
        });
        const run = await dashboardApi.createGeneration(project.id, {
          ...form,
        });
        window.localStorage.removeItem('sitefoundry.website-draft');
        router.push(`/dashboard/projects/${project.id}/generations/${run.id}`);
      } catch (error) {
        submitted.current = false;
        setSubmitting(false);
        setError(
          error instanceof Error
            ? error.message
            : 'The project could not be created.',
        );
      }
    })();
  };
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
            disabled={submitting}
            onClick={() => (step === 6 ? start() : next())}
            className="bg-primary text-primary-foreground flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium shadow-lg"
          >
            {step === 6 ? (
              <>
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {submitting ? 'Creating project…' : 'Generate Website'}
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600">
            {error}
          </p>
        )}
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
          <label className="text-sm font-medium">
            Business type
            <select
              className="field mt-2"
              value={form.businessType}
              onChange={(e) => update('businessType', e.target.value)}
            >
              <option value="" disabled>
                Select a business type
              </option>
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
          </label>
        )}
        {step === 2 && (
          <label className="text-sm font-medium">
            Services, one per line
            <textarea
              className="field mt-2 min-h-32"
              value={form.services.join('\n')}
              onChange={(e) =>
                update(
                  'services',
                  e.target.value
                    .split('\n')
                    .map((value) => value.trim())
                    .filter(Boolean),
                )
              }
            />
          </label>
        )}
        {step === 3 && (
          <div className="flex flex-wrap gap-4">
            {form.brandColors.map((color, index) => (
              <label className="text-muted-foreground text-xs" key={index}>
                Color {index + 1}
                <input
                  aria-label={`Brand color ${index + 1}`}
                  type="color"
                  className="mt-2 block size-12 cursor-pointer rounded-full border-0 bg-transparent"
                  value={color}
                  onChange={(event) => {
                    const colors = [...form.brandColors];
                    colors[index] = event.target.value;
                    update('brandColors', colors);
                  }}
                />
              </label>
            ))}
          </div>
        )}
        {step === 4 && (
          <label className="text-sm font-medium">
            Target audience
            <textarea
              className="field mt-2 min-h-36 resize-none"
              value={form.targetAudience}
              onChange={(e) => update('targetAudience', e.target.value)}
            />
          </label>
        )}
        {step === 5 && (
          <label className="text-sm font-medium">
            Primary website goal
            <select
              className="field mt-2"
              value={form.websiteGoal}
              onChange={(e) => update('websiteGoal', e.target.value)}
            >
              <option value="" disabled>
                Select a goal
              </option>
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
          </label>
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

function validateStep(step: number, form: WebsiteWizardData): string {
  if ((step === 0 || step === 6) && form.businessName.trim().length < 2)
    return 'Enter a business name of at least two characters.';
  if ((step === 1 || step === 6) && !form.businessType)
    return 'Choose a business type.';
  if ((step === 2 || step === 6) && form.services.length === 0)
    return 'Add at least one service, one per line.';
  if ((step === 3 || step === 6) && form.brandColors.length === 0)
    return 'Choose at least one brand color.';
  if ((step === 4 || step === 6) && form.targetAudience.trim().length < 3)
    return 'Describe your target audience.';
  if ((step === 5 || step === 6) && !form.websiteGoal)
    return 'Choose a website goal.';
  return '';
}
