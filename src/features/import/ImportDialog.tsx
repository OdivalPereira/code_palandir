import React, { useState } from 'react';
import { Dialog } from '@/ui/Dialog';
import { useUIStore } from '@/stores/uiStore';
import { LocalImport } from './LocalImport';
import { GitHubImport } from './GitHubImport';
import { Folder, Github } from 'lucide-react';

export const ImportDialog: React.FC = () => {
  const { isImportModalOpen, setImportModalOpen } = useUIStore();
  const [activeTab, setActiveTab] = useState<'local' | 'github'>('local');

  return (
    <Dialog
      open={isImportModalOpen}
      onClose={() => setImportModalOpen(false)}
      title="Conectar Projeto Frontend"
      description="Carregue o código para mapear suas telas, componentes e gerar prompts de IA."
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
          <button
            onClick={() => setActiveTab('local')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition-all ${
              activeTab === 'local'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Folder className="h-3.5 w-3.5 text-indigo-400" />
            <span>Local / ZIP / Demo</span>
          </button>
          <button
            onClick={() => setActiveTab('github')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-medium transition-all ${
              activeTab === 'github'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Github className="h-3.5 w-3.5 text-purple-400" />
            <span>GitHub Repositório</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'local' ? <LocalImport /> : <GitHubImport />}
      </div>
    </Dialog>
  );
};
