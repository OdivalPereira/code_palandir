import type { UINodeType } from './graph';

export interface SelectedElement {
  id: string;
  label: string;
  nodeType: UINodeType;
  filePath?: string;
  codeSnippet?: string;
  details?: Record<string, unknown>;
}

export type PromptTemplateCategory = 'feature' | 'refactor' | 'fix' | 'test' | 'explain' | 'audit';

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: PromptTemplateCategory;
  systemRole: string;
  promptInstruction: string;
  defaultGoal: string;
}

export interface GeneratedPrompt {
  id: string;
  content: string;
  templateId: string;
  userGoal: string;
  selectedElements: SelectedElement[];
  estimatedTokens: number;
  createdAt: number;
}
