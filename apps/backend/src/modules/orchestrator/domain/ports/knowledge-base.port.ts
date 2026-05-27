export interface SystemPromptArgs {
  context: string;
  habeasDataConsent?: boolean;
}

export interface KnowledgeBasePort {
  getFaqCatalog(): Promise<string>;
  getSystemPrompt(args: SystemPromptArgs): Promise<string>;
}
