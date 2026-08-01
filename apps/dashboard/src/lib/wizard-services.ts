import { type WebsiteWizardData } from './website-generation';

export type WebsiteWizardForm = WebsiteWizardData & {
  rawServices: string;
};

export function parseServices(rawServices: string): string[] {
  return rawServices
    .split(/\r?\n/)
    .map((service) => service.trim())
    .filter(Boolean);
}

export function updateRawServices(
  form: WebsiteWizardForm,
  rawServices: string,
): WebsiteWizardForm {
  return { ...form, rawServices };
}

export function completeServicesStep(
  form: WebsiteWizardForm,
): WebsiteWizardForm {
  return { ...form, services: parseServices(form.rawServices) };
}

export function toWebsiteWizardData(
  form: WebsiteWizardForm,
): WebsiteWizardData {
  const { rawServices, ...data } = completeServicesStep(form);
  void rawServices;
  return data;
}
