import React, { useEffect, useRef, useState } from 'react';
import {
  Archive,
  BarChart3,
  BookOpen,
  ChevronDown,
  FileDown,
  FileText,
  FolderOpen,
  Github,
  GitBranch,
  GitPullRequest,
  Key,
  Lightbulb,
  Loader2,
  LogOut,
  Network,
  Route,
  Save,
  Search,
  Sparkles,
  Tag,
  X
} from 'lucide-react';
import { useBasketStore } from '../stores/basketStore';
import { generateMarkdownExport, downloadMarkdown } from '../utils/exportUtils';
import { useGraphStore } from '../stores/graphStore';
import {
  selectActivePullRequest,
  selectAuthNotice,
  selectAvailableBranches,
  selectAvailableTags,
  selectCurrentBranch,
  selectGithubOwnerRepo,
  selectGithubRateLimit,
  selectIsPromptOpen,
  selectIsAuthenticated,
  selectPromptItems,
  selectSearchQuery,
  selectSidebarTab,
  selectStatus,
  selectGithubUrl,
  selectUserProfile,
} from '../stores/graphSelectors';
import { AppStatus } from '../types';

const AppTopBar: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const status = useGraphStore(selectStatus);
  const isAuthenticated = useGraphStore(selectIsAuthenticated);
  const authNotice = useGraphStore(selectAuthNotice);
  const promptItems = useGraphStore(selectPromptItems);
  const searchQuery = useGraphStore(selectSearchQuery);
  const sidebarTab = useGraphStore(selectSidebarTab);
  const isPromptOpen = useGraphStore(selectIsPromptOpen);
  const githubUrl = useGraphStore(selectGithubUrl);
  const githubPat = useGraphStore((state) => state.githubPat);
  const setGithubPat = useGraphStore((state) => state.setGithubPat);
  const clearGithubPat = useGraphStore((state) => state.clearGithubPat);
  const graphViewMode = useGraphStore((state) => state.graphViewMode);
  const setGraphViewMode = useGraphStore((state) => state.setGraphViewMode);
  const setSearchQuery = useGraphStore((state) => state.setSearchQuery);
  const setGithubUrl = useGraphStore((state) => state.setGithubUrl);
  const setPromptOpen = useGraphStore((state) => state.setPromptOpen);
  const setSidebarTab = useGraphStore((state) => state.setSidebarTab);
  const processFiles = useGraphStore((state) => state.processFiles);
  const openLocalDirectory = useGraphStore((state) => state.openLocalDirectory);
  const processZipFile = useGraphStore((state) => state.processZipFile);
  const importGithubRepo = useGraphStore((state) => state.importGithubRepo);
  const searchRelevantFiles = useGraphStore((state) => state.searchRelevantFiles);
  const handleSaveSession = useGraphStore((state) => state.handleSaveSession);
  const restoreSessionById = useGraphStore((state) => state.restoreSessionById);
  const sessionId = useGraphStore((state) => state.sessionId);
  const refreshAuthSession = useGraphStore((state) => state.refreshAuthSession);
  const logout = useGraphStore((state) => state.logout);
  const userRepos = useGraphStore((state) => state.userRepos);
  const userReposStatus = useGraphStore((state) => state.userReposStatus);
  const fetchUserRepos = useGraphStore((state) => state.fetchUserRepos);
  const detectedFramework = useGraphStore((state) => state.detectedFramework);
  const frameworkStatus = useGraphStore((state) => state.frameworkStatus);
  const ownerRepo = useGraphStore(selectGithubOwnerRepo);
  const availableBranches = useGraphStore(selectAvailableBranches);
  const currentBranch = useGraphStore(selectCurrentBranch);
  const availableTags = useGraphStore(selectAvailableTags);
  const activePullRequest = useGraphStore(selectActivePullRequest);
  const githubRateLimit = useGraphStore(selectGithubRateLimit);
  const userProfile = useGraphStore(selectUserProfile);
  const setImportModalOpen = useGraphStore((state) => state.setImportModalOpen);
  const switchBranch = useGraphStore((state) => state.switchBranch);

  const [showRepoDropdown, setShowRepoDropdown] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [showPatModal, setShowPatModal] = useState(false);
  const [patInputValue, setPatInputValue] = useState('');

  useEffect(() => {
    refreshAuthSession();
  }, [refreshAuthSession]);

  const handleOpenFolder = async () => {
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      await openLocalDirectory();
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleOpenSession = async () => {
    const requestedId = window.prompt('Enter session ID to open:', sessionId ?? '');
    if (!requestedId) return;
    try {
      await restoreSessionById(requestedId);
    } catch (error) {
      console.error(error);
      alert('Failed to open session.');
    }
  };

  const toggleSidebar = (tab: 'prompt' | 'summary' | 'flow' | 'recommendations' | 'metrics' | 'library' | 'github-pr') => {
    if (isPromptOpen && sidebarTab === tab) {
      setPromptOpen(false);
    } else {
      setSidebarTab(tab);
      setPromptOpen(true);
    }
  };

  return (
    <>
      <div className="h-16 border-b border-slate-800 bg-slate-900 flex items-center px-6 justify-between z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-lg">
            <Sparkles size={20} />
            <span>Code Palandir</span>
          </div>

          <div className="flex items-center gap-2 ml-6">
            {/* Local Folder Ingestion */}
            <button
              onClick={handleOpenFolder}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded text-sm transition-colors text-slate-200"
              title="Open local folder via File System Access API or folder upload"
            >
              <FolderOpen size={14} className="text-amber-400" /> Folder
            </button>
            <input
              type="file"
              ref={fileInputRef}
              // @ts-ignore
              webkitdirectory="" directory="" multiple=""
              className="hidden"
              onChange={(event) => {
                if (event.target.files && event.target.files.length > 0) {
                  processFiles(event.target.files);
                }
              }}
            />

            {/* ZIP Ingestion */}
            <button
              onClick={() => zipInputRef.current?.click()}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded text-sm transition-colors text-slate-200"
              title="Upload and extract .ZIP repository in browser offline"
            >
              <Archive size={14} className="text-cyan-400" /> .ZIP
            </button>
            <input
              type="file"
              ref={zipInputRef}
              accept=".zip,application/zip"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  processZipFile(file);
                }
                event.target.value = '';
              }}
            />

            <span className="text-slate-600 text-xs">OR</span>

            {/* GitHub Import Modal Button */}
            <button
              onClick={() => setImportModalOpen(true)}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/40 px-3 py-1.5 rounded text-sm font-medium transition-colors text-white shadow-sm"
              title="Importar repositórios públicos ou privados do GitHub"
            >
              <Github size={14} /> Importar do GitHub
            </button>

            {/* GitHub Direct URL Quick Ingestion */}
            <div className="hidden lg:flex items-center bg-slate-800 border border-slate-700 rounded overflow-hidden">
              <div className="px-2 text-slate-500"><Github size={14} /></div>
              <input
                type="text"
                placeholder="github.com/owner/repo"
                className="bg-transparent border-none text-sm px-2 py-1.5 w-40 focus:outline-none text-slate-300"
                value={githubUrl}
                onChange={event => setGithubUrl(event.target.value)}
                onKeyDown={event => event.key === 'Enter' && importGithubRepo()}
              />
              <button
                onClick={() => importGithubRepo()}
                disabled={status === AppStatus.LOADING_FILES}
                className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-xs font-medium text-white transition-colors"
              >
                {status === AppStatus.LOADING_FILES ? <Loader2 size={12} className="animate-spin" /> : 'Carregar'}
              </button>
            </div>

            {/* Branch / Tag Dropdown Selector */}
            {ownerRepo && availableBranches.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowBranchDropdown((prev) => !prev)}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1.5 rounded text-xs font-mono text-indigo-300 transition-colors"
                  title={`Branch atual: ${currentBranch}`}
                >
                  <GitBranch size={13} className="text-indigo-400" />
                  <span className="max-w-[110px] truncate">{currentBranch}</span>
                  <ChevronDown size={11} />
                </button>

                {showBranchDropdown && (
                  <div className="absolute top-full left-0 mt-1 w-60 max-h-64 overflow-y-auto bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-50 p-1 space-y-1">
                    <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Branches ({availableBranches.length})
                    </div>
                    {availableBranches.map((branch) => (
                      <button
                        key={branch.name}
                        className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors ${
                          branch.name === currentBranch
                            ? 'bg-indigo-600/30 text-indigo-200 font-medium'
                            : 'hover:bg-slate-700 text-slate-300'
                        }`}
                        onClick={() => {
                          setShowBranchDropdown(false);
                          switchBranch(branch.name);
                        }}
                      >
                        <span className="truncate">{branch.name}</span>
                        {branch.name === currentBranch && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                      </button>
                    ))}

                    {availableTags.length > 0 && (
                      <>
                        <div className="px-2 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-t border-slate-700 mt-1 pt-1">
                          Tags ({availableTags.length})
                        </div>
                        {availableTags.map((tag) => (
                          <button
                            key={tag.name}
                            className="w-full text-left px-2.5 py-1.5 rounded text-xs hover:bg-slate-700 text-slate-300 flex items-center gap-1.5"
                            onClick={() => {
                              setShowBranchDropdown(false);
                              switchBranch(tag.name);
                            }}
                          >
                            <Tag size={11} className="text-amber-400" />
                            <span className="truncate">{tag.name}</span>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* PAT Config Button */}
            <button
              onClick={() => {
                setPatInputValue(githubPat || '');
                setShowPatModal(true);
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border transition-colors ${
                githubPat
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
              title={githubPat ? 'GitHub Personal Access Token is active' : 'Configure GitHub PAT for private repositories'}
            >
              <Key size={13} className={githubPat ? 'text-emerald-400' : 'text-slate-400'} />
              {githubPat ? 'PAT Active' : 'GitHub PAT'}
            </button>

            {/* My Repos Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  if (!isAuthenticated) {
                    window.location.href = '/api/auth/login';
                    return;
                  }
                  if (userRepos.length === 0) {
                    fetchUserRepos();
                  }
                  setShowRepoDropdown((prev) => !prev);
                }}
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded text-sm transition-colors text-slate-300"
              >
                {userReposStatus === 'loading' ? <Loader2 size={14} className="animate-spin" /> : <Github size={14} />}
                My Repos
                <ChevronDown size={12} />
              </button>
              {showRepoDropdown && userRepos.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-72 max-h-64 overflow-y-auto bg-slate-800 border border-slate-700 rounded shadow-lg z-50">
                  {userRepos.map((repo) => (
                    <button
                      key={repo.full_name}
                      className="w-full text-left px-3 py-2 hover:bg-slate-700 text-sm border-b border-slate-700 last:border-b-0"
                      onClick={() => {
                        setGithubUrl(`github.com/${repo.full_name}`);
                        setShowRepoDropdown(false);
                        importGithubRepo();
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Github size={14} className="text-slate-500" />
                        <span className="font-medium text-slate-200">{repo.name}</span>
                        {repo.private && <span className="text-[10px] px-1 bg-amber-500/20 text-amber-300 rounded">Private</span>}
                      </div>
                      {repo.description && <p className="text-xs text-slate-400 truncate mt-0.5">{repo.description}</p>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Phase 1: Framework Badge */}
          {frameworkStatus === 'detecting' && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 size={14} className="animate-spin" />
              <span>Detecting framework...</span>
            </div>
          )}
          {detectedFramework && frameworkStatus === 'done' && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 border border-indigo-500/30 rounded text-xs text-indigo-200">
              <Sparkles size={14} className="text-indigo-400" />
              <span className="font-medium capitalize">{detectedFramework.name}</span>
              <span className="text-indigo-400/60">({Math.round(detectedFramework.confidence * 100)}%)</span>
            </div>
          )}
        </div>

        {/* AI Query Bar */}
        <div className="flex-1 max-w-xl mx-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Ask AI: 'Where is the user authentication logic?'"
              className="w-full bg-slate-950 border border-slate-700 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-slate-200 placeholder-slate-500"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              onKeyDown={event => event.key === 'Enter' && searchRelevantFiles()}
            />
            <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
            {status === AppStatus.ANALYZING_QUERY && (
              <div className="absolute right-3 top-2.5">
                <Loader2 className="animate-spin text-indigo-400" size={16} />
              </div>
            )}
          </div>
        </div>

        {/* Sidebars and Navigation Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => toggleSidebar('prompt')}
            className={`p-2 rounded-lg transition-colors relative ${isPromptOpen && sidebarTab === 'prompt' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
            title="Prompt Builder"
          >
            <FileText size={20} />
            {promptItems.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full">
                {promptItems.length}
              </span>
            )}
          </button>
          <button
            onClick={() => toggleSidebar('summary')}
            className={`p-2 rounded-lg transition-colors ${isPromptOpen && sidebarTab === 'summary' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
            aria-label="Open project summary"
            title="Project Summary"
          >
            <Network size={20} />
          </button>
          <button
            onClick={() => toggleSidebar('flow')}
            className={`p-2 rounded-lg transition-colors ${isPromptOpen && sidebarTab === 'flow' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
            aria-label="Open flow query"
            title="Flow Query"
          >
            <Route size={20} />
          </button>
          <button
            onClick={() => toggleSidebar('recommendations')}
            className={`p-2 rounded-lg transition-colors ${isPromptOpen && sidebarTab === 'recommendations' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
            aria-label="Open module recommendations"
            title="Recommendations"
          >
            <Lightbulb size={20} />
          </button>
          <button
            onClick={() => toggleSidebar('library')}
            className={`p-2 rounded-lg transition-colors ${isPromptOpen && sidebarTab === 'library' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
            aria-label="Open thread library"
            title="Thread Library"
          >
            <BookOpen size={20} />
          </button>
          <button
            onClick={() => toggleSidebar('github-pr')}
            className={`p-2 rounded-lg transition-colors relative ${isPromptOpen && sidebarTab === 'github-pr' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
            aria-label="Open GitHub PRs & Commits"
            title="GitHub Pull Requests & Commits"
          >
            <GitPullRequest size={20} />
            {activePullRequest && (
              <span className="absolute -top-1 -right-1 px-1 bg-emerald-500 text-white text-[9px] font-bold rounded-full">
                PR
              </span>
            )}
          </button>
          <button
            onClick={() => toggleSidebar('metrics')}
            className={`p-2 rounded-lg transition-colors ${isPromptOpen && sidebarTab === 'metrics' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
            aria-label="Open AI metrics"
            title="AI Metrics"
          >
            <BarChart3 size={20} />
          </button>
        </div>

        {/* View mode & Rate Limit & session buttons */}
        <div className="ml-2 flex items-center gap-2">
          {githubRateLimit && (
            <div
              className="flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-400"
              title={`Limite da API GitHub: ${githubRateLimit.remaining}/${githubRateLimit.limit} requisições restantes`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${githubRateLimit.remaining < 50 ? 'bg-rose-400 animate-pulse' : 'bg-emerald-400'}`} />
              <span>{githubRateLimit.remaining}</span>
            </div>
          )}

          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-full p-1 text-xs">
            <button
              onClick={() => setGraphViewMode('structural')}
              className={`px-3 py-1 rounded-full transition-colors ${graphViewMode === 'structural' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Estrutural
            </button>
            <button
              onClick={() => setGraphViewMode('semantic')}
              className={`px-3 py-1 rounded-full transition-colors ${graphViewMode === 'semantic' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              Semântico
            </button>
          </div>

          <button
            onClick={handleSaveSession}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded text-sm transition-colors text-slate-200"
          >
            <Save size={14} /> Save Session
          </button>

          <button
            onClick={() => {
              const { threads, maxTokens, warningThreshold, dangerThreshold } = useBasketStore.getState();
              const md = generateMarkdownExport(threads, { maxTokens, warningThreshold, dangerThreshold });
              downloadMarkdown(md, `codemind-session-${new Date().toISOString().slice(0, 10)}.md`);
            }}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded text-sm transition-colors text-slate-200"
          >
            <FileDown size={14} /> Export MD
          </button>

          <button
            onClick={handleOpenSession}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded text-sm transition-colors text-slate-200"
          >
            <FolderOpen size={14} /> Open Session
          </button>

          <div className="flex items-center gap-2 border-l border-slate-700 ml-2 pl-2">
            {isAuthenticated || githubPat ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setImportModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs transition-colors text-slate-200"
                  title="Abrir gerenciador de repositórios do GitHub"
                >
                  {userProfile?.avatar_url ? (
                    <img src={userProfile.avatar_url} alt="" className="w-4 h-4 rounded-full" />
                  ) : (
                    <Github size={13} className="text-indigo-400" />
                  )}
                  <span className="max-w-[90px] truncate">{userProfile?.login || 'Conectado'}</span>
                </button>
                <button
                  onClick={logout}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs transition-colors text-slate-400 hover:text-rose-300"
                  title="Sair / Desconectar"
                >
                  <LogOut size={13} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setImportModalOpen(true)}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 rounded text-xs font-medium transition-colors text-white shadow-sm"
              >
                <Github size={14} /> Conectar GitHub
              </button>
            )}
          </div>
        </div>
      </div>

      {authNotice && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-200 text-xs px-6 py-2">
          {authNotice}
        </div>
      )}

      {/* GitHub Personal Access Token (PAT) Modal */}
      {showPatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold text-base">
                <Key size={18} />
                <span>GitHub Personal Access Token (PAT)</span>
              </div>
              <button
                onClick={() => setShowPatModal(false)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              To analyze <strong>private repositories</strong> and avoid API rate limiting, provide a GitHub Personal Access Token with <code className="bg-slate-800 px-1 py-0.5 rounded text-indigo-300">repo</code> scope. Your token is stored locally in memory / localStorage only and never leaves your browser.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400">Token (ghp_... or github_pat_...)</label>
              <input
                type="password"
                placeholder="Paste your GitHub PAT here"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                value={patInputValue}
                onChange={(e) => setPatInputValue(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              {githubPat ? (
                <button
                  onClick={() => {
                    clearGithubPat();
                    setPatInputValue('');
                    setShowPatModal(false);
                  }}
                  className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                >
                  Clear Token
                </button>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowPatModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 rounded border border-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (patInputValue.trim()) {
                      setGithubPat(patInputValue.trim());
                    } else {
                      clearGithubPat();
                    }
                    setShowPatModal(false);
                  }}
                  className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded transition-colors"
                >
                  Save Token
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AppTopBar;

