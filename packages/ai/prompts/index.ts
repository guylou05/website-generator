/** A model-neutral prompt representation that can be adapted by any AI provider. */
export interface PromptMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

export interface PromptTemplate<TInput> {
  readonly id: string;
  readonly version: string;
  render(input: Readonly<TInput>): readonly PromptMessage[];
}

export interface PromptRegistry {
  get<TInput>(id: string, version?: string): PromptTemplate<TInput>;
}

export class InMemoryPromptRegistry implements PromptRegistry {
  constructor(private readonly templates: readonly PromptTemplate<unknown>[]) {}

  get<TInput>(id: string, version?: string): PromptTemplate<TInput> {
    const template = this.templates.find(
      (candidate) =>
        candidate.id === id && (!version || candidate.version === version),
    );
    if (!template)
      throw new Error(
        `Prompt template not found: ${id}${version ? `@${version}` : ''}`,
      );
    return template as PromptTemplate<TInput>;
  }
}
