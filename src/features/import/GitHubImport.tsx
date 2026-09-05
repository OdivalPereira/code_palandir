import React, { useState } from 'react';
import { Github, AlertCircle, KeyRound } from 'lucide-react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { parseGitHubUrl, fetchGitHubRepo } from '@/services/github';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';

export const GitHubImport: React.FC = () => {
  const setProject = useProjectStore((state) => state.setProject);
  const setImportModalOpen = useUIStore((state) => state.setImportModalOpen);

  const [repoInput, setRepoInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenField, setShowTokenField] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoInput.trim()) return;

    const parsed = parseGitHubUrl(repoInput);
    if (!parsed) {
      setErrorMessage('Formato inválido. Digite no formato "owner/repo" ou cole a URL completa do GitHub.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { info, files } = await fetchGitHubRepo(parsed.owner, parsed.repo, tokenInput || undefined);

      if (files.length === 0) {
        throw new Error('Nenhum arquivo de código suportado foi encontrado no repositório.');
      }

      setProject(
        {
          name: `${info.owner}/${info.repo}`,
          framework: 'react',
          sourceType: 'github',
          sourceName: `${info.owner}/${info.repo}`,
          fileCount: files.length,
          totalSize: files.reduce((acc, f) => acc + f.size, 0),
          createdAt: Date.now(),
        },
        files
      );

      setImportModalOpen(false);
    } catch (err: any) {
      const msg = err?.message || 'Falha ao baixar repositório do GitHub.';
      setErrorMessage(msg);
      if (/token|privado|limite|401|403/i.test(msg)) {
        setShowTokenField(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleImport} className="space-y-4">
      {errorMessage && (
        <div className="flex items-start justify-between gap-2 rounded-xl bg-rose-950/40 border border-rose-800/80 p-3 text-xs text-rose-300 shadow-sm">
          <div className="flex items-start gap-2 min-w-0">
            <AlertCircle className="h-4 w-4 text-rose-400 mt-0.5 flex-shrink-0" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 p-0.5"
            title="Fechar aviso"
          >
            ✕
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-200 block">
          Repositório do GitHub
        </label>
        <div className="relative">
          <Github className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            type="text"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="ex: vercel/next.js ou https://github.com/..."
            className="pl-9 h-10"
            disabled={isLoading}
            autoFocus
          />
        </div>
        <p className="text-[11px] text-slate-400">
          Aceita repositórios públicos de React, Next.js, Vue e Angular.
        </p>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowTokenField(!showTokenField)}
          className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <KeyRound className="h-3.5 w-3.5" />
          <span>{showTokenField ? 'Ocultar Token' : 'Adicionar Personal Access Token (opcional)'}</span>
        </button>

        {showTokenField && (
          <div className="mt-2 space-y-1">
            <Input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              className="h-9 font-mono text-xs"
              disabled={isLoading}
            />
            <p className="text-[10px] text-slate-500">
              Necessário apenas para repositórios privados ou para evitar o limite de requisições anônimas.
            </p>
          </div>
        )}
      </div>

      <Button
        type="submit"
        disabled={isLoading || !repoInput.trim()}
        className="w-full justify-center gap-2 h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
      >
        <Github className="h-4 w-4" />
        <span>{isLoading ? 'Baixando e Analisando Repositório...' : 'Importar Repositório'}</span>
      </Button>
    </form>
  );
};
