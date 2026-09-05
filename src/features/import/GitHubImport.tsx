import React, { useState, useEffect } from 'react';
import {
  Github,
  AlertCircle,
  KeyRound,
  Globe,
  ExternalLink,
  RefreshCw,
  Trash2,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  Info,
  CheckCircle2,
  ClipboardPaste,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Badge } from '@/ui/Badge';
import {
  parseGitHubUrl,
  fetchGitHubRepo,
  getGitHubToken,
  setGitHubToken,
  clearGitHubToken,
  fetchGitHubRateLimit,
  isFineGrainedToken,
  POPULAR_GITHUB_REPOS,
  type GitHubRateLimitInfo,
  type FetchRepoProgress,
} from '@/services/github';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { detectFramework } from '@/engine/analyzers/frameworkDetector';
import { copyToClipboard } from '@/services/clipboard';

export const GitHubImport: React.FC = () => {
  const setProject = useProjectStore((state) => state.setProject);
  const setImportModalOpen = useUIStore((state) => state.setImportModalOpen);

  const [repoInput, setRepoInput] = useState('');
  const [activeMode, setActiveMode] = useState<'public' | 'token'>('public');
  const [tokenInput, setTokenInput] = useState(() => getGitHubToken() || '');
  const [rememberInSession, setRememberInSession] = useState(false);
  const [showTokenText, setShowTokenText] = useState(false);
  const [showTokenGuide, setShowTokenGuide] = useState(false);
  const [copiedGhCmd, setCopiedGhCmd] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<FetchRepoProgress | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rateLimit, setRateLimit] = useState<GitHubRateLimitInfo | null>(null);

  // Load rate limit on mount
  useEffect(() => {
    let isMounted = true;
    fetchGitHubRateLimit().then((rl) => {
      if (isMounted && rl) setRateLimit(rl);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const hasToken = Boolean(getGitHubToken() || tokenInput.trim());

  const handleRefreshRateLimit = async () => {
    const rl = await fetchGitHubRateLimit(tokenInput.trim() || undefined);
    if (rl) setRateLimit(rl);
  };

  const handleApplyToken = () => {
    const cleaned = tokenInput.trim();
    if (cleaned) {
      setGitHubToken(cleaned, rememberInSession);
      handleRefreshRateLimit();
    }
  };

  const handleClearToken = () => {
    clearGitHubToken();
    setTokenInput('');
    setRememberInSession(false);
    handleRefreshRateLimit();
  };

  const handlePasteUrl = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
        const clipText = await navigator.clipboard.readText();
        if (clipText && clipText.trim()) {
          setRepoInput(clipText.trim());
          setErrorMessage(null);
        }
      }
    } catch {
      // clipboard read permission denied or not supported
    }
  };

  const handleCopyGhCmd = async () => {
    const success = await copyToClipboard('gh auth token');
    if (success) {
      setCopiedGhCmd(true);
      setTimeout(() => setCopiedGhCmd(false), 2500);
    }
  };

  const handleSelectPreset = (url: string) => {
    setRepoInput(url);
    setErrorMessage(null);
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoInput.trim()) return;

    const parsed = parseGitHubUrl(repoInput);
    if (!parsed) {
      setErrorMessage(
        'Formato inválido. Use "owner/repo" (ex: pmndrs/zustand) ou cole a URL completa do GitHub.'
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setProgress({ step: 'meta', message: 'Iniciando conexão com GitHub...' });

    // Store token if entered
    if (tokenInput.trim()) {
      setGitHubToken(tokenInput.trim(), rememberInSession);
    }

    try {
      const effectiveToken = tokenInput.trim() || getGitHubToken() || undefined;

      const { info, files } = await fetchGitHubRepo(parsed.owner, parsed.repo, {
        token: effectiveToken,
        branch: parsed.branch,
        subpath: parsed.subpath,
        onProgress: (p) => setProgress(p),
      });

      if (files.length === 0) {
        throw new Error('Nenhum arquivo de código suportado (.tsx, .jsx, .ts, .js, .vue) foi encontrado no repositório.');
      }

      const detectedFramework = detectFramework(files);

      setProject(
        {
          name: `${info.owner}/${info.repo}${parsed.subpath ? `/${parsed.subpath}` : ''}`,
          framework: detectedFramework,
          sourceType: 'github',
          sourceName: `${info.owner}/${info.repo}`,
          fileCount: files.length,
          totalSize: files.reduce((acc, f) => acc + f.size, 0),
          createdAt: Date.now(),
        },
        files
      );

      // Refresh rate limit after successful fetch
      handleRefreshRateLimit();

      setImportModalOpen(false);
    } catch (err: any) {
      const msg = err?.message || 'Falha ao conectar com o repositório do GitHub.';
      setErrorMessage(msg);
      // Auto-suggest token mode if private or rate limited
      if (/privado|404|token|limite|401|403/i.test(msg)) {
        setActiveMode('token');
      }
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  return (
    <form onSubmit={handleImport} className="space-y-4">
      {/* Error Banner */}
      {errorMessage && (
        <div className="flex items-start justify-between gap-2 rounded-xl bg-rose-950/50 border border-rose-800/80 p-3 text-xs text-rose-300 shadow-sm animate-in fade-in-50">
          <div className="flex items-start gap-2 min-w-0">
            <AlertCircle className="h-4 w-4 text-rose-400 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <span className="leading-relaxed block">{errorMessage}</span>
              {errorMessage.includes('privado') && (
                <p className="text-[11px] text-rose-400/90">
                  Dica: Para repositórios privados da sua organização, ative a aba <strong>Token Seguro</strong> abaixo e gere um token com permissão somente leitura.
                </p>
              )}
            </div>
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

      {/* Mode Selector Tabs */}
      <div className="flex items-center gap-1 rounded-xl bg-slate-900/90 p-1 border border-slate-800">
        <button
          type="button"
          onClick={() => setActiveMode('public')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${
            activeMode === 'public'
              ? 'bg-indigo-600/30 text-indigo-200 border border-indigo-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe className="h-3.5 w-3.5 text-indigo-400" />
          <span>Público (1 Clique, Sem Token)</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMode('token')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-all ${
            activeMode === 'token'
              ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <KeyRound className="h-3.5 w-3.5 text-purple-400" />
          <span>Token Seguro (Privado ou Quota)</span>
          {hasToken && (
            <span className="h-2 w-2 rounded-full bg-emerald-400" title="Token configurado" />
          )}
        </button>
      </div>

      {/* Mode 1: Public Repo Explanation & Rate Limit */}
      {activeMode === 'public' && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/15 p-3 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <span className="text-slate-300">
              Acesso anônimo instantâneo. <strong>Nenhum token, login ou permissão é exigida.</strong>
            </span>
          </div>
          {rateLimit && (
            <div className="flex items-center gap-1 flex-shrink-0 text-[11px] text-slate-400 ml-2">
              <Badge variant={rateLimit.remaining > 10 ? 'default' : 'amber'} className="text-[10px] font-mono">
                {rateLimit.remaining}/{rateLimit.limit} req/h
              </Badge>
              <button
                type="button"
                onClick={handleRefreshRateLimit}
                className="p-1 text-slate-500 hover:text-slate-300"
                title="Atualizar limite da API"
              >
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Fine-Grained Token Configuration */}
      {activeMode === 'token' && (
        <div className="rounded-xl border border-purple-800/40 bg-purple-950/20 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-purple-400" />
              <span className="text-xs font-semibold text-purple-200">
                Personal Access Token (Fine-Grained)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowTokenGuide(!showTokenGuide)}
              className="text-[11px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium"
            >
              <Info className="h-3 w-3" />
              <span>{showTokenGuide ? 'Ocultar Guia' : 'Por que é seguro?'}</span>
            </button>
          </div>

          {/* Educational Security Guide */}
          {showTokenGuide && (
            <div className="rounded-lg bg-slate-950/80 border border-purple-800/60 p-3 text-[11px] text-slate-300 space-y-2 leading-relaxed">
              <p className="font-semibold text-purple-300 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Diferencial de Segurança do Code Palandir:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-slate-400">
                <li>
                  <strong>Fine-Grained Token:</strong> No GitHub, selecione apenas o repositório específico que você quer analisar.
                </li>
                <li>
                  <strong>Apenas Leitura:</strong> Conceda permissão estritamente de leitura (<em>Repository permissions → Contents: Read-only</em>).
                </li>
                <li>
                  <strong>Sem Risco:</strong> O app nunca tem acesso de escrita, pull request, push ou exclusão.
                </li>
                <li>
                  <strong>Armazenamento Seguro:</strong> O token é guardado apenas na memória do seu navegador durante a sessão. Nunca é salvo em disco ou enviado a servidores externos.
                </li>
              </ul>
              <div className="pt-1">
                <a
                  href="https://github.com/settings/personal-access-tokens/new"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-indigo-400 hover:text-indigo-300 font-medium underline underline-offset-2"
                >
                  <span>Abrir página do GitHub para criar Fine-Grained Token</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {/* Token Input & Visibility Toggle */}
          <div className="space-y-2">
            <div className="relative">
              <Input
                type={showTokenText ? 'text' : 'password'}
                value={tokenInput}
                onChange={(e) => {
                  setTokenInput(e.target.value);
                  if (!e.target.value.trim()) {
                    clearGitHubToken();
                  }
                }}
                onBlur={handleApplyToken}
                placeholder="github_pat_xxxxxxxxxxxxxxxxxxxx"
                className="pr-20 font-mono text-xs h-9 bg-slate-950 border-slate-800 focus:border-purple-500"
                disabled={isLoading}
              />
              <div className="absolute right-2 top-2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowTokenText(!showTokenText)}
                  className="p-1 text-slate-500 hover:text-slate-300"
                  title={showTokenText ? 'Ocultar token' : 'Revelar token'}
                >
                  {showTokenText ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                {tokenInput && (
                  <button
                    type="button"
                    onClick={handleClearToken}
                    className="p-1 text-slate-500 hover:text-rose-400"
                    title="Remover e limpar token"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberInSession}
                  onChange={(e) => {
                    setRememberInSession(e.target.checked);
                    if (tokenInput.trim()) {
                      setGitHubToken(tokenInput.trim(), e.target.checked);
                    }
                  }}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Lembrar nesta aba (SessionStorage — descartado ao fechar navegador)</span>
              </label>

              {tokenInput.trim() && (
                <span className="flex items-center gap-1 text-emerald-400 font-mono text-[10px]">
                  <CheckCircle2 className="h-3 w-3" />
                  {isFineGrainedToken(tokenInput) ? 'Fine-grained PAT' : 'Personal Token'}
                </span>
              )}
            </div>

            {/* Quick CLI helper */}
            <div className="pt-1 flex items-center justify-between border-t border-purple-900/40 text-[10px] text-slate-400">
              <span>Usa o GitHub CLI no terminal?</span>
              <button
                type="button"
                onClick={handleCopyGhCmd}
                className="inline-flex items-center gap-1 text-purple-300 hover:text-purple-100 font-mono bg-purple-900/30 px-2 py-0.5 rounded border border-purple-700/50 transition-colors"
                title="Copiar comando para obter token ativo do GitHub CLI"
              >
                {copiedGhCmd ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-emerald-300 font-sans">Comando copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copiar gh auth token</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Repository Input */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-200 block">
            Repositório do GitHub
          </label>
          <button
            type="button"
            onClick={handlePasteUrl}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1 font-medium transition-colors"
            title="Colar URL copiada"
          >
            <ClipboardPaste className="h-3 w-3" />
            <span>Colar link</span>
          </button>
        </div>
        <div className="relative">
          <Github className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <Input
            type="text"
            value={repoInput}
            onChange={(e) => setRepoInput(e.target.value)}
            placeholder="ex: pmndrs/zustand ou https://github.com/remix-run/react-router"
            className="pl-9 pr-9 h-10 bg-slate-900 border-slate-800 focus:border-indigo-500"
            disabled={isLoading}
            autoFocus
          />
        </div>
        <p className="text-[11px] text-slate-400">
          Aceita repositórios públicos ou privados de React, Next.js, Vue e Angular. Também aceita links para subpastas de monorepos (ex: <code>/tree/main/packages/client</code>).
        </p>
      </div>

      {/* Popular Presets */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          <Sparkles className="h-3 w-3 text-amber-400" />
          <span>Exemplos Populares para Testar (1 Clique)</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {POPULAR_GITHUB_REPOS.map((preset) => (
            <button
              key={preset.url}
              type="button"
              onClick={() => handleSelectPreset(preset.url)}
              disabled={isLoading}
              className="flex flex-col text-left p-2 rounded-lg border border-slate-800/80 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-700 transition-all group"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs font-medium text-slate-200 group-hover:text-indigo-300 truncate">
                  {preset.name}
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                  {preset.tag}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 truncate mt-0.5">
                {preset.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Live Download Progress Indicator */}
      {isLoading && progress && (
        <div className="rounded-xl bg-slate-900/90 border border-indigo-500/30 p-3 space-y-2 shadow-md">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-indigo-300 flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-400" />
              {progress.message}
            </span>
            {progress.total !== undefined && progress.current !== undefined && (
              <span className="font-mono text-[11px] text-slate-400">
                {Math.round((progress.current / progress.total) * 100)}%
              </span>
            )}
          </div>

          {progress.total !== undefined && progress.current !== undefined && (
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-indigo-500 transition-all duration-150 ease-out"
                style={{
                  width: `${Math.min(100, (progress.current / progress.total) * 100)}%`,
                }}
              />
            </div>
          )}

          {progress.currentFile && (
            <p className="text-[10px] text-slate-500 font-mono truncate">
              {progress.currentFile}
            </p>
          )}
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={isLoading || !repoInput.trim()}
        className="w-full justify-center gap-2 h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/20"
      >
        <Github className="h-4 w-4" />
        <span>{isLoading ? 'Conectando e Mapeando...' : 'Importar Repositório'}</span>
      </Button>
    </form>
  );
};
