export const SYSTEM_PROMPT = `You are a senior small-business website strategist. Return only the requested structured result. Be factual, concise, accessible, conversion-focused, and builder-agnostic. Never invent certifications, testimonials, addresses, prices, or guarantees.`;

export const prompts = {
  analysis: `Analyze this small business. Identify customer needs and objections, differentiators, conversion goals, constraints, and a credible value proposition.`,
  planning: `Plan a focused sitemap and navigation for a small-business website. Include useful service pages, conversion paths, contact opportunities, and FAQ sections where they answer real buying questions. Use stable lowercase page and section keys.`,
  writing: `Write clear, specific, conversion-focused page copy. Lead with customer outcomes, explain each service plainly, answer objections in FAQs, and use honest calls to action. Do not use hype or unverifiable claims.`,
  seo: `Create a local SEO strategy for every planned page. Use natural service-and-location intent when location is known, unique titles and descriptions, and focused keywords without stuffing.`,
  design: `Select an accessible, professional design direction. Use valid hex colors, readable contrast, broadly available font families, and semantic layout choices rather than CSS or page-builder settings.`,
  blueprint: `Assemble a complete Website Blueprint schema version 1.0. It must be portable across builders, contain all planned pages and supplied copy/SEO/design, use semantic components, valid URLs, ISO timestamps, and no Elementor, WordPress, React, HTML, CSS, or image-generation instructions.`,
} as const;
