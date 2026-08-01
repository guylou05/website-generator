import assert from 'node:assert/strict';
import test from 'node:test';
import {
  completeServicesStep,
  parseServices,
  updateRawServices,
  type WebsiteWizardForm,
} from '../src/lib/wizard-services';

const form: WebsiteWizardForm = {
  businessName: 'Acme',
  description: '',
  businessType: 'Professional services',
  services: [],
  rawServices: '',
  brandColors: ['#6658E8'],
  targetAudience: 'Business owners',
  websiteGoal: 'Generate qualified leads',
};

test('the services field preserves typed spaces, punctuation, and accents', () => {
  const value = 'Réparation proactive de sites Web';
  assert.equal(updateRawServices(form, value).rawServices, value);
});

test('Enter creates a newline in the raw services value', () => {
  const first = updateRawServices(form, 'Website Maintenance');
  const second = updateRawServices(first, `${first.rawServices}\n`);
  assert.equal(second.rawServices, 'Website Maintenance\n');
});

test('pasted multiline input is preserved without per-keystroke parsing', () => {
  const pasted =
    'Proactive Website Maintenance\nDomain, DNS & Email Support\nSécurité & dépannage';
  assert.equal(updateRawServices(form, pasted).rawServices, pasted);
  assert.deepEqual(updateRawServices(form, pasted).services, []);
});

test('parsing preserves internal spaces and ignores blank lines', () => {
  assert.deepEqual(
    parseServices(
      '  Proactive Website Maintenance  \n\n  Domain, DNS & Email Support\n   \nWebsite Migration  ',
    ),
    [
      'Proactive Website Maintenance',
      'Domain, DNS & Email Support',
      'Website Migration',
    ],
  );
});

test('continuing to Step 4 stores the correctly parsed services array', () => {
  const editing = updateRawServices(
    form,
    'Proactive Website Maintenance\n\nEmergency Website Repair\nDomain, DNS & Email Support',
  );
  const continued = completeServicesStep(editing);

  assert.deepEqual(continued.services, [
    'Proactive Website Maintenance',
    'Emergency Website Repair',
    'Domain, DNS & Email Support',
  ]);
  assert.equal(continued.rawServices, editing.rawServices);
});
