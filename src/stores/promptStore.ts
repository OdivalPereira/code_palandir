import { create } from 'zustand';
import { PROMPT_TEMPLATES } from '@/features/prompt/PromptTemplates';
import { generatePromptText, estimateTokens } from '@/features/prompt/usePromptGenerator';
import { useSelectionStore } from './selectionStore';
import { useProjectStore } from './projectStore';

interface PromptState {
  activeTemplateId: string;
  userGoal: string;
  customInstructions: string;
  isCopied: boolean;

  setTemplateId: (id: string) => void;
  setUserGoal: (goal: string) => void;
  setCustomInstructions: (instructions: string) => void;
  setIsCopied: (copied: boolean) => void;
  getGeneratedPrompt: () => string;
  getTokenCount: () => number;
}

export const usePromptStore = create<PromptState>((set, get) => ({
  activeTemplateId: 'feature',
  userGoal: '',
  customInstructions: '',
  isCopied: false,

  setTemplateId: (id) => set({ activeTemplateId: id }),
  setUserGoal: (goal) => set({ userGoal: goal }),
  setCustomInstructions: (instructions) => set({ customInstructions: instructions }),
  setIsCopied: (copied) => set({ isCopied: copied }),

  getGeneratedPrompt: () => {
    const { activeTemplateId, userGoal } = get();
    const template = PROMPT_TEMPLATES.find(t => t.id === activeTemplateId) || PROMPT_TEMPLATES[0];
    const selectedElements = useSelectionStore.getState().selectedElements;
    const framework = useProjectStore.getState().meta?.framework || 'react';

    return generatePromptText(template, userGoal, selectedElements, framework);
  },

  getTokenCount: () => {
    const prompt = get().getGeneratedPrompt();
    return estimateTokens(prompt);
  },
}));
