import React, { useState, useEffect } from 'react';
import {
  Github,
  Lock,
  Globe,
  Key,
  LogOut,
  RefreshCw,
  Search,
  ExternalLink,
  Sparkles,
  Loader2,
  X,
  CheckCircle2,
  FolderGit2,
  Star,
  ShieldCheck
} from 'lucide-react';
import { useGraphStore } from '../stores/graphStore';
import {
  selectIsAuthenticated,
  selectIsImportModalOpen,
  selectUserProfile,
  selectUserRepos,
  selectUserReposStatus,
  selectStatus
} from '../stores/graphSelectors';
import { AppStatus, GitHubRepoItem } from '../types';

export const GitHubImportModal: React.FC = () => {
  const isImportModalOpen = useGraphStore(selectIsImportModalOpen);
  const setImportModalOpen = useGraphStore((state) => state.setImportModalOpen);
  const isAuthenticated = useGraphStore(selectIsAuthenticated);
  const userProfile = useGraphStore(selectUserProfile);
  const userRepos = useGraphStore(selectUserRepos);
  const userReposStatus = useGraphStore(selectUserReposStatus);
  const appStatus = useGraphStore(selectStatus);
  const githubPat = useGraphStore((state) => state.githubPat);
  const setGithubPat = useGraphStore((state) => state.setGithubPat);
  const clearGithubPat = useGraphStore((state) => state.clearGithubPat);
  const fetchUserRepos = useGraphStore((state) => state.fetchUserRepos);
  const fetchUserProfile = useGraphStore((state) => state.fetchUserProfile);
  const importGithubRepo = useGraphStore((state) => state.importGithubRepo);
  const logout = useGraphStore((state) => state.logout);

  const [activeTab, setActiveTab] = useState<'my_repos' | 'manual_url' | 'pat_config'>('my_repos');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'private' | 'public'>('all');
  const [manualUrlInput, setManualUrlInput] = useState('');
  const [patInput, setPatInput] = useState(githubPat || '');
  const [isImporting, setIsImporting] = useState<string | null>(null);

  const isConnected = isAuthenticated || Boolean(githubPat);

  useEffect(() => {
    if (isImportModalOpen && isConnected && userRepos.length === 0 && userReposStatus !== 'loading') {
      fetchUserRepos();
      fetchUserProfile();
    }
  }, [isImportModalOpen, isConnected, userRepos.length, userReposStatus, fetchUserRepos, fetchUserProfile]);

  if (!isImportModalOpen) return null;

  const handleOAuthLogin = () => {
    window.location.href = '/api/auth/login';
  };

  const handleSavePat = () => {
    if (patInput.trim()) {
      setGithubPat(patInput.trim());
      setActiveTab('my_repos');
    }
  };

  const handleClearPat = () => {
    clearGithubPat();
    setPatInput('');
  };

  const handleSelectRepo = async (repo: GitHubRepoItem) => {
    setIsImporting(repo.full_name);
    try {
      await importGithubRepo(repo.full_name);
      setImportModalOpen(false);
    } finally {
      setIsImporting(null);
    }
  };

  const handleManualImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualUrlInput.trim()) return;
    setIsImporting(manualUrlInput);
    try {
      await importGithubRepo(manualUrlInput.trim());
      setImportModalOpen(false);
    } finally {
      setIsImporting(null);
    }
  };

  const filteredRepos = userRepos.filter((repo) => {
    if (filterType === 'private' && !repo.private) return false;
    if (filterType === 'public' && repo.private) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        repo.name.toLowerCase().includes(q) ||
        repo.full_name.toLowerCase().includes(q) ||
        (repo.description && repo.description.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const privateCount = userRepos.filter((r) => r.private).length;
  const publicCount = userRepos.filter((r) => !r.private).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <FolderGit2 size={22} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                Importar Repositório do GitHub
                {isConnected && (
                  <span className="flex items-center gap-1 text-[11px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-normal">
                    <ShieldCheck size={12} /> Acesso a Privados Ativo
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Conecte sua conta do GitHub para explorar projetos públicos, privados e de organizações.
              </p>
            </div>
          </div>
          <button
            onClick={() => setImportModalOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Auth Banner */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between gap-4">
          {isConnected ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                {userProfile?.avatar_url ? (
                  <img
                    src={userProfile.avatar_url}
                    alt={userProfile.login}
                    className="w-8 h-8 rounded-full border border-slate-700"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-300 font-bold text-xs">
                    <Github size={16} />
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-200">
                      {userProfile?.name || userProfile?.login || 'Conta do GitHub Conectada'}
                    </span>
                    {userProfile?.login && (
                      <span className="text-[11px] font-mono text-slate-500">@{userProfile.login}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={11} /> {isAuthenticated ? 'Conectado via GitHub OAuth' : 'Autenticado via PAT'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    fetchUserRepos();
                    fetchUserProfile();
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 transition-colors"
                  title="Atualizar lista de repositórios"
                >
                  <RefreshCw size={12} className={userReposStatus === 'loading' ? 'animate-spin' : ''} />
                  <span>Atualizar</span>
                </button>
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-500/40 rounded-lg text-xs text-slate-400 hover:text-rose-300 transition-colors"
                  title="Desconectar conta do GitHub"
                >
                  <LogOut size={12} />
                  <span>Desconectar</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="space-y-0.5">
                <p className="text-xs font-medium text-slate-200">Você não está conectado ao GitHub</p>
                <p className="text-[11px] text-slate-400">
                  Faça login para listar seus repositórios privados ou informe um Personal Access Token.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleOAuthLogin}
                  className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
                >
                  <Github size={14} />
                  <span>Conectar com GitHub</span>
                </button>
                <button
                  onClick={() => setActiveTab('pat_config')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs transition-colors"
                >
                  <Key size={13} />
                  <span>Usar PAT</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center px-5 pt-3 border-b border-slate-800 gap-4 text-xs font-medium bg-slate-900">
          <button
            onClick={() => setActiveTab('my_repos')}
            className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'my_repos'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderGit2 size={14} />
            Meus Repositórios {userRepos.length > 0 && `(${userRepos.length})`}
          </button>
          <button
            onClick={() => setActiveTab('manual_url')}
            className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'manual_url'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe size={14} />
            Inserir URL / Repositório
          </button>
          <button
            onClick={() => setActiveTab('pat_config')}
            className={`pb-2.5 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'pat_config'
                ? 'border-indigo-500 text-indigo-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key size={14} />
            Personal Access Token (PAT)
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'my_repos' && (
            <div className="space-y-4">
              {/* Search & Filters */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-80">
                  <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                  <input
                    type="text"
                    placeholder="Buscar por nome ou descrição..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                      filterType === 'all'
                        ? 'bg-indigo-600 text-white font-medium'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Todos ({userRepos.length})
                  </button>
                  <button
                    onClick={() => setFilterType('private')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs transition-colors ${
                      filterType === 'private'
                        ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 font-medium'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Lock size={11} />
                    Privados ({privateCount})
                  </button>
                  <button
                    onClick={() => setFilterType('public')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs transition-colors ${
                      filterType === 'public'
                        ? 'bg-slate-700 text-white font-medium'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Globe size={11} />
                    Públicos ({publicCount})
                  </button>
                </div>
              </div>

              {/* Repositories List */}
              {userReposStatus === 'loading' ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 space-y-3">
                  <Loader2 size={32} className="animate-spin text-indigo-400" />
                  <p className="text-xs">Carregando seus repositórios do GitHub (públicos e privados)...</p>
                </div>
              ) : !isConnected ? (
                <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl p-6 space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                    <Github size={24} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-slate-200">Conecte sua conta do GitHub</h3>
                    <p className="text-xs text-slate-400 max-w-md mx-auto">
                      Para visualizar e importar seus projetos privados e de organizações com 1 clique, autorize o Code Palandir via OAuth ou adicione um token de acesso.
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      onClick={handleOAuthLogin}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2"
                    >
                      <Github size={15} />
                      <span>Conectar com GitHub</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('pat_config')}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5"
                    >
                      <Key size={14} />
                      <span>Configurar Token (PAT)</span>
                    </button>
                  </div>
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs space-y-2">
                  <FolderGit2 size={32} className="mx-auto opacity-30" />
                  <p>Nenhum repositório encontrado com os filtros selecionados.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredRepos.map((repo) => (
                    <div
                      key={repo.id || repo.full_name}
                      className="bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-3.5 flex flex-col justify-between gap-3 transition-all group"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {repo.private ? (
                              <span className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md font-mono flex-shrink-0">
                                <Lock size={10} /> Privado
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md font-mono flex-shrink-0">
                                <Globe size={10} /> Público
                              </span>
                            )}
                            <h4
                              className="font-semibold text-xs text-slate-100 group-hover:text-indigo-300 transition-colors truncate"
                              title={repo.full_name}
                            >
                              {repo.name}
                            </h4>
                          </div>

                          <a
                            href={repo.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-500 hover:text-slate-300 p-0.5 transition-colors"
                            title="Abrir no GitHub"
                          >
                            <ExternalLink size={13} />
                          </a>
                        </div>

                        <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed min-h-[1.75rem]">
                          {repo.description || <span className="italic text-slate-600">Sem descrição.</span>}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                        <div className="flex items-center gap-2 text-slate-500 font-mono text-[10px]">
                          <span>{repo.owner?.login || repo.full_name.split('/')[0]}</span>
                          <span>•</span>
                          <span>{repo.default_branch || 'main'}</span>
                          {Boolean(repo.stargazers_count) && (
                            <span className="flex items-center gap-0.5 text-amber-400">
                              <Star size={10} /> {repo.stargazers_count}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => handleSelectRepo(repo)}
                          disabled={appStatus === AppStatus.LOADING_FILES || isImporting === repo.full_name}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5"
                        >
                          {isImporting === repo.full_name ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              <span>Carregando...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={12} />
                              <span>Importar</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'manual_url' && (
            <div className="max-w-lg mx-auto py-6 space-y-5">
              <div className="space-y-1 text-center">
                <h3 className="text-sm font-semibold text-slate-100">Importar por URL ou Owner/Repo</h3>
                <p className="text-xs text-slate-400">
                  Informe qualquer repositório público ou privado (se autenticado com permissão).
                </p>
              </div>

              <form onSubmit={handleManualImport} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">URL ou Caminho do Repositório</label>
                  <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs focus-within:border-indigo-500 transition-colors">
                    <Github size={16} className="text-slate-500 mr-2 flex-shrink-0" />
                    <input
                      type="text"
                      placeholder="ex: github.com/minha-empresa/meu-projeto-privado"
                      value={manualUrlInput}
                      onChange={(e) => setManualUrlInput(e.target.value)}
                      className="bg-transparent border-none w-full text-slate-200 focus:outline-none placeholder-slate-600 font-mono text-xs"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Formatos aceitos: <code>https://github.com/owner/repo</code>, <code>github.com/owner/repo</code> ou <code>owner/repo</code>.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!manualUrlInput.trim() || appStatus === AppStatus.LOADING_FILES}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {isImporting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      <span>Processando repositório...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>Carregar Repositório no Grafo</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'pat_config' && (
            <div className="max-w-lg mx-auto py-4 space-y-5">
              <div className="space-y-1 text-center">
                <h3 className="text-sm font-semibold text-slate-100 flex items-center justify-center gap-2">
                  <Key size={16} className="text-indigo-400" />
                  GitHub Personal Access Token (PAT)
                </h3>
                <p className="text-xs text-slate-400">
                  Ideal para importar projetos privados sem precisar configurar OAuth Server no ambiente.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 text-xs">
                <div className="space-y-1.5">
                  <label className="font-medium text-slate-300">Seu Token de Acesso (PAT)</label>
                  <input
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxx"
                    value={patInput}
                    onChange={(e) => setPatInput(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono text-xs"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo,read:user,read:org&description=Code%20Palandir%20Visualizer"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 underline underline-offset-2"
                  >
                    Gerar token com escopos no GitHub (repo, read:user) <ExternalLink size={10} />
                  </a>

                  {githubPat && (
                    <button
                      onClick={handleClearPat}
                      className="text-[11px] text-rose-400 hover:text-rose-300"
                    >
                      Remover Token
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={handleSavePat}
                disabled={!patInput.trim()}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={14} />
                <span>Salvar Token e Carregar Repositórios</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GitHubImportModal;
