export type ElementorDevice = 'desktop' | 'tablet' | 'mobile';
export type ElementorSettings = Record<string, unknown>;

export interface ElementorWidget {
  readonly id: string;
  readonly elType: 'widget';
  readonly widgetType:
    | 'heading'
    | 'text-editor'
    | 'button'
    | 'icon'
    | 'image'
    | 'icon-box'
    | 'accordion'
    | 'form';
  readonly settings: ElementorSettings;
  readonly elements: readonly [];
}

export interface ElementorContainer {
  readonly id: string;
  readonly elType: 'container';
  readonly isInner: boolean;
  readonly settings: ElementorSettings;
  readonly elements: readonly ElementorElement[];
}

export type ElementorElement = ElementorContainer | ElementorWidget;

export interface ElementorDocument {
  readonly version: '0.4';
  readonly title: string;
  readonly type: 'page';
  readonly page_settings: ElementorSettings;
  readonly content: readonly ElementorContainer[];
}

export type ElementorSectionKind =
  | 'header'
  | 'hero'
  | 'trust-bar'
  | 'services'
  | 'features'
  | 'pricing'
  | 'testimonials'
  | 'faq'
  | 'cta'
  | 'contact'
  | 'footer';

export class ElementorRenderError extends Error {
  constructor(
    message: string,
    readonly path?: string,
    options?: ErrorOptions,
  ) {
    super(path ? `${message} at ${path}` : message, options);
    this.name = 'ElementorRenderError';
  }
}

export class UnsupportedElementorSectionError extends ElementorRenderError {
  constructor(
    readonly sectionId: string,
    readonly sectionType: string,
  ) {
    super(
      `Unsupported Elementor section type "${sectionType}"`,
      `sections.${sectionId}`,
    );
    this.name = 'UnsupportedElementorSectionError';
  }
}
