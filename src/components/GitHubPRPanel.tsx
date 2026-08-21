import React, { useState } from 'react';
import {
  GitPullRequest,
  GitCommit,
  ExternalLink,
  Plus,
  Minus,
  User,
  ArrowLeft,
  Search,
  RefreshCw,
  X
} from 'lucide-react';
import { useGraphStore } from '../stores/graphStore';
import {
  selectActivePullRequest,
  selectAvailablePullRequests,
  selectGithubOwnerRepo,
  selectRecentCommits,
  selectStatus
} from '../stores/graphSelectors';
import { AppStatus } from '../types';

interface GitHubPRPanelProps {
  onClose?: () => void;
}

export const GitHubPRPanel: React.FC<GitHubPRPanelProps> = ({ onClose }) => {
  const ownerRepo = useGraphStore(selectGithubOwnerRepo);
  const availablePullRequests = useGraphStore(selectAvailablePullRequests);
  const activePullRequest = useGraphStore(selectActivePullRequest);
  const recentCommits = useGraphStore(selectRecentCommits);
  const status = useGraphStore(selectStatus);

  const loadPullRequest = useGraphStore((state) => state.loadPullRequest);
  const clearPullRequestMode = useGraphStore((state) => state.clearPullRequestMode);
  const fetchPullRequests = useGraphStore((state) => state.fetchPullRequests);
  const fetchCommits = useGraphStore((state) => state.fetchCommits);
  const selectNode = useGraphStore((state) => state.selectNode);

  const [activeTab, setActiveTab] = useState<'prs' | 'commits'>('prs');
  const [filterState, setFilterState] = useState<'all' | 'open' | 'closed'>('open');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilePatch, setSelectedFilePatch] = useState<{ filename: string; patch?: string } | null>(null);

  if (!ownerRepo) {
    return (
      <div className="p-6 text-center text-slate-400 space-y-3">
        <GitPullRequest size={36} className="mx-auto text-slate-600 opacity-60" />
        <p className="text-sm">Nenhum repositório do GitHub carregado no momento.</p>
        <p className="text-xs text-slate-500">
          Insira uma URL do GitHub na barra superior para explorar Pull Requests, branches e diffs.
        </p>
      </div>
    );
  }

  const filteredPRs = availablePullRequests.filter((pr) => {
    if (filterState !== 'all' && pr.state !== filterState) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        pr.title.toLowerCase().includes(q) ||
        String(pr.number).includes(q) ||
        pr.user.login.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredCommits = recentCommits.filter((commit) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        commit.commit.message.toLowerCase().includes(q) ||
        commit.sha.toLowerCase().includes(q) ||
        (commit.author?.login && commit.author.login.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitPullRequest size={18} className="text-indigo-400" />
            <span className="font-semibold text-sm text-slate-100">
              {ownerRepo.owner}/{ownerRepo.repo}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                fetchPullRequests();
                fetchCommits();
              }}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
              title="Atualizar dados do GitHub"
            >
              <RefreshCw size={14} className={status === AppStatus.LOADING_FILES ? 'animate-spin' : ''} />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
                title="Fechar painel"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('prs')}
            className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 font-medium transition-colors ${
              activeTab === 'prs'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitPullRequest size={13} />
            Pull Requests ({availablePullRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('commits')}
            className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 font-medium transition-colors ${
              activeTab === 'commits'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitCommit size={13} />
            Commits ({recentCommits.length})
          </button>
        </div>
      </div>

      {/* Active PR Detail View */}
      {activePullRequest ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <button
            onClick={clearPullRequestMode}
            className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
          >
            <ArrowLeft size={14} /> Voltar à lista de PRs
          </button>

          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-xs font-mono text-slate-500">#{activePullRequest.number}</span>
                <h3 className="text-sm font-semibold text-slate-100 mt-0.5">
                  {activePullRequest.title}
                </h3>
              </div>
              <a
                href={activePullRequest.html_url}
                target="_blank"
                rel="noreferrer"
                className="text-slate-400 hover:text-slate-200 p-1"
                title="Abrir no GitHub"
              >
                <ExternalLink size={14} />
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <User size={12} className="text-slate-500" />
                {activePullRequest.user.login}
              </span>
              <span className="flex items-center gap-1 text-emerald-400 font-mono">
                <Plus size={11} />
                {activePullRequest.totalAdditions}
              </span>
              <span className="flex items-center gap-1 text-rose-400 font-mono">
                <Minus size={11} />
                {activePullRequest.totalDeletions}
              </span>
              <span className="text-[11px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
                {activePullRequest.head.ref} → {activePullRequest.base.ref}
              </span>
            </div>
          </div>

          {/* Files Changed in PR */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-medium">
              <span>Arquivos Alterados ({activePullRequest.files.length})</span>
              <span className="text-[11px] text-slate-500">Clique para focar no Grafo</span>
            </div>

            <div className="space-y-1.5">
              {activePullRequest.files.map((file) => (
                <div
                  key={file.filename}
                  className="bg-slate-800/40 hover:bg-slate-800 border border-slate-700/60 rounded-lg p-2.5 transition-all text-xs cursor-pointer group"
                  onClick={() => selectNode(file.filename)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          file.status === 'added'
                            ? 'bg-emerald-400'
                            : file.status === 'removed'
                            ? 'bg-rose-400'
                            : 'bg-amber-400'
                        }`}
                      />
                      <span className="font-mono text-slate-200 truncate" title={file.filename}>
                        {file.filename}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-emerald-400 font-mono text-[11px]">+{file.additions}</span>
                      <span className="text-rose-400 font-mono text-[11px]">-{file.deletions}</span>
                      {file.patch && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFilePatch(
                              selectedFilePatch?.filename === file.filename ? null : { filename: file.filename, patch: file.patch }
                            );
                          }}
                          className="px-1.5 py-0.5 text-[10px] bg-slate-700 hover:bg-slate-600 rounded text-slate-300 transition-colors"
                        >
                          Diff
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Patch preview */}
                  {selectedFilePatch?.filename === file.filename && file.patch && (
                    <div className="mt-2 p-2 bg-slate-950 rounded border border-slate-800 font-mono text-[10px] overflow-x-auto max-h-48 whitespace-pre leading-relaxed text-slate-300">
                      {file.patch.split('\n').map((line, idx) => (
                        <div
                          key={idx}
                          className={
                            line.startsWith('+')
                              ? 'text-emerald-300 bg-emerald-950/40'
                              : line.startsWith('-')
                              ? 'text-rose-300 bg-rose-950/40'
                              : line.startsWith('@@')
                              ? 'text-cyan-400 bg-cyan-950/30 font-semibold'
                              : 'text-slate-400'
                          }
                        >
                          {line}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeTab === 'prs' ? (
        /* PRs List View */
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Filters & Search */}
          <div className="space-y-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar PR por título ou número..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="absolute left-2.5 top-2 text-slate-500" size={13} />
            </div>

            <div className="flex items-center gap-1 text-[11px]">
              <button
                onClick={() => setFilterState('open')}
                className={`px-2.5 py-1 rounded-full border transition-colors ${
                  filterState === 'open'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                Abertos
              </button>
              <button
                onClick={() => setFilterState('closed')}
                className={`px-2.5 py-1 rounded-full border transition-colors ${
                  filterState === 'closed'
                    ? 'bg-purple-500/10 border-purple-500/40 text-purple-300'
                    : 'border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                Fechados / Merged
              </button>
              <button
                onClick={() => setFilterState('all')}
                className={`px-2.5 py-1 rounded-full border transition-colors ${
                  filterState === 'all'
                    ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300'
                    : 'border-slate-800 text-slate-500 hover:text-slate-300'
                }`}
              >
                Todos
              </button>
            </div>
          </div>

          {/* List */}
          {filteredPRs.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs space-y-2">
              <GitPullRequest size={28} className="mx-auto opacity-30" />
              <p>Nenhum Pull Request encontrado com os filtros atuais.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPRs.map((pr) => (
                <div
                  key={pr.id}
                  onClick={() => loadPullRequest(pr.number)}
                  className="bg-slate-800/40 hover:bg-slate-800 border border-slate-700/60 hover:border-indigo-500/50 rounded-xl p-3 cursor-pointer transition-all space-y-2 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {pr.state === 'open' ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                        )}
                        <span className="text-[11px] font-mono text-slate-400">#{pr.number}</span>
                      </div>
                      <h4 className="text-xs font-medium text-slate-100 group-hover:text-indigo-300 transition-colors line-clamp-2">
                        {pr.title}
                      </h4>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800">
                    <span>@{pr.user.login}</span>
                    <span className="font-mono text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-slate-400">
                      {pr.head.ref}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Commits List View */
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar commits..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="absolute left-2.5 top-2 text-slate-500" size={13} />
          </div>

          {filteredCommits.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs space-y-2">
              <GitCommit size={28} className="mx-auto opacity-30" />
              <p>Nenhum commit carregado para esta branch.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCommits.map((item) => (
                <div
                  key={item.sha}
                  className="bg-slate-800/40 border border-slate-700/60 rounded-xl p-3 space-y-2 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-slate-200 line-clamp-2 leading-relaxed">
                      {item.commit.message}
                    </p>
                    <a
                      href={item.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-500 hover:text-slate-300 flex-shrink-0"
                      title="Ver no GitHub"
                    >
                      <ExternalLink size={12} />
                    </a>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>{item.author?.login || item.commit.author.name}</span>
                    <span className="font-mono text-[10px] bg-slate-900 px-1.5 py-0.5 rounded text-indigo-400">
                      {item.sha.slice(0, 7)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GitHubPRPanel;
