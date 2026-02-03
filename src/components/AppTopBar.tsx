import React, { useRef } from 'react';
import { BarChart3, FileText, FolderOpen, Github, Lightbulb, Loader2, Network, Route, Save, Search, Sparkles } from 'lucide-react';
import { useGraphStore } from '../stores/graphStore';
import {
  selectIsPromptOpen,
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

  return (
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

      <button
        onClick={() => {
          setPromptOpen(isPromptOpen && sidebarTab === 'prompt' ? false : true);
          setSidebarTab('prompt');
        }}
        className={`p-2 rounded-lg transition-colors relative ${isPromptOpen && sidebarTab === 'prompt' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
      >
        <FileText size={20} />
        {promptItems.length > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] flex items-center justify-center rounded-full">
            {promptItems.length}
          </span>
        )}
      </button>
      <button
        onClick={() => {
          setPromptOpen(isPromptOpen && sidebarTab === 'summary' ? false : true);
          setSidebarTab('summary');
        }}
        className={`p-2 rounded-lg transition-colors ${isPromptOpen && sidebarTab === 'summary' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
        aria-label="Open project summary"
      >
        <Network size={20} />
      </button>
      <button
        onClick={() => {
          setPromptOpen(isPromptOpen && sidebarTab === 'flow' ? false : true);
          setSidebarTab('flow');
        }}
        className={`p-2 rounded-lg transition-colors ${isPromptOpen && sidebarTab === 'flow' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
        aria-label="Open flow query"
      >
        <Route size={20} />
      </button>
      <button
        onClick={() => {
          setPromptOpen(isPromptOpen && sidebarTab === 'recommendations' ? false : true);
          setSidebarTab('recommendations');
        }}
        className={`p-2 rounded-lg transition-colors ${isPromptOpen && sidebarTab === 'recommendations' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
        aria-label="Open module recommendations"
      >
        <Lightbulb size={20} />
      </button>
      <button
        onClick={() => {
          setPromptOpen(isPromptOpen && sidebarTab === 'metrics' ? false : true);
          setSidebarTab('metrics');
        }}
        className={`p-2 rounded-lg transition-colors ${isPromptOpen && sidebarTab === 'metrics' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400'}`}
        aria-label="Open AI metrics"
      >
        <BarChart3 size={20} />
      </button>

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
          onClick={handleOpenSession}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded text-sm transition-colors"
        >
          <FolderOpen size={14} /> Open Session
        </button>
      </div>
    </div>
  );
};

export default AppTopBar;
