import React, { useEffect, useRef } from 'react';
import {
  BarChart3,
  BookOpen,
  FileDown,
  FileText,
  FolderOpen,
  Github,
  Lightbulb,
  Loader2,
  LogOut,
  Network,
  Route,
  Save,
  Search,
  Sparkles
} from 'lucide-react';
import { useBasketStore } from '../stores/basketStore';
import { generateMarkdownExport, downloadMarkdown } from '../utils/exportUtils';
import { useGraphStore } from '../stores/graphStore';
import {
  selectAuthNotice,
  selectIsPromptOpen,
  selectIsAuthenticated,
  selectPromptItems,
  selectSearchQuery,
  selectSidebarTab,
  selectStatus,
  selectGithubUrl
} from '../stores/graphSelectors';
import { AppStatus } from '../types';

const AppTopBar: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const status = useGraphStore(selectStatus);
  const isAuthenticated = useGraphStore(selectIsAuthenticated);
  const authNotice = useGraphStore(selectAuthNotice);
  const promptItems = useGraphStore(selectPromptItems);
  const searchQuery = useGraphStore(selectSearchQuery);
  const sidebarTab = useGraphStore(selectSidebarTab);
  const isPromptOpen = useGraphStore(selectIsPromptOpen);
  const githubUrl = useGraphStore(selectGithubUrl);
  const graphViewMode = useGraphStore((state) => state.graphViewMode);
  const setGraphViewMode = useGraphStore((state) => state.setGraphViewMode);
  const setSearchQuery = useGraphStore((state) => state.setSearchQuery);
  const setGithubUrl = useGraphStore((state) => state.setGithubUrl);
  const setPromptOpen = useGraphStore((state) => state.setPromptOpen);
  const setSidebarTab = useGraphStore((state) => state.setSidebarTab);
  const processFiles = useGraphStore((state) => state.processFiles);
  const importGithubRepo = useGraphStore((state) => state.importGithubRepo);
  const searchRelevantFiles = useGraphStore((state) => state.searchRelevantFiles);
  const handleSaveSession = useGraphStore((state) => state.handleSaveSession);
  const restoreSessionById = useGraphStore((state) => state.restoreSessionById);
  const sessionId = useGraphStore((state) => state.sessionId);
  const refreshAuthSession = useGraphStore((state) => state.refreshAuthSession);
  const logout = useGraphStore((state) => state.logout);

  useEffect(() => {
    refreshAuthSession();
  }, [refreshAuthSession]);

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

  const toggleSidebar = (tab: 'prompt' | 'summary' | 'flow' | 'recommendations' | 'metrics' | 'library') => {
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
            <span>CodeMind AI</span>
          </div>

          <div className="flex items-center gap-2 ml-8">
            <div className="relative group">
              <button className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded text-sm transition-colors">
                <FolderOpen size={14} /> Local Dir
              </button>
              <input
                type="file"
                ref={fileInputRef}
                // @ts-ignore
                webkitdirectory="" directory="" multiple=""
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(event) => {
                  if (event.target.files && event.target.files.length > 0) {
                    processFiles(event.target.files);
                  }
                }}
              />
            </div>
            <span className="text-slate-600 text-xs">OR</span>
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded overflow-hidden">
              <div className="px-2 text-slate-500"><Github size={14} /></div>
              <input
                type="text"
                placeholder="github.com/owner/repo"
                className="bg-transparent border-none text-sm px-2 py-1.5 w-48 focus:outline-none text-slate-300"
                value={githubUrl}
                onChange={event => setGithubUrl(event.target.value)}
                onKeyDown={event => event.key === 'Enter' && importGithubRepo()}
              />
              <button onClick={importGithubRepo} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-xs font-medium">Load</button>
            </div>
          </div>
        </div>

        <div className="flex-1 max-w-xl mx-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Ask AI: 'Where is the user authentication logic?'"
              className="w-full bg-slate-950 border border-slate-700 rounded-full pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
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
            onClick={() => toggleSidebar('metrics')}
            className={`p-2 rounded-lg transition-colors ${isPromptOpen && sidebarTab === 'metrics' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
            aria-label="Open AI metrics"
            title="AI Metrics"
          >
            <BarChart3 size={20} />
          </button>
        </div>

        <div className="ml-2 flex items-center gap-2">
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
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded text-sm transition-colors"
          >
            <Save size={14} /> Save Session
          </button>

          <button
            onClick={() => {
              const { threads, maxTokens, warningThreshold, dangerThreshold } = useBasketStore.getState();
              const md = generateMarkdownExport(threads, { maxTokens, warningThreshold, dangerThreshold });
              downloadMarkdown(md, `codemind-session-${new Date().toISOString().slice(0, 10)}.md`);
            }}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded text-sm transition-colors"
          >
            <FileDown size={14} /> Export MD
          </button>

          <button
            onClick={handleOpenSession}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded text-sm transition-colors"
          >
            <FolderOpen size={14} /> Open Session
          </button>

          <div className="flex items-center gap-2 border-l border-slate-700 ml-2 pl-2">
            {isAuthenticated ? (
              <>
                <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  Conectado
                </span>
                <button
                  onClick={logout}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded text-sm transition-colors"
                >
                  <LogOut size={14} /> Sair
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  window.location.href = '/api/auth/login';
                }}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded text-sm transition-colors"
              >
                <Github size={14} /> Entrar com GitHub
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
    </>
  );
};

export default AppTopBar;
