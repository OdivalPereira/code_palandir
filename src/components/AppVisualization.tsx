import React from 'react';
import { Loader2, Plus } from 'lucide-react';
import { useGraphStore } from '../stores/graphStore';
import { selectSelectedNode, selectStatus } from '../stores/graphSelectors';
import { AppStatus, CodeNode, FileSystemNode } from '../types';
import CodeVisualizer from './CodeVisualizer';
import { ErrorBoundary } from './ErrorBoundary';

const AppVisualization: React.FC = () => {
  const status = useGraphStore(selectStatus);
  const selectedNode = useGraphStore(selectSelectedNode);
  const selectNode = useGraphStore((state) => state.selectNode);
  const ensureFileContent = useGraphStore((state) => state.ensureFileContent);
  const addPromptItem = useGraphStore((state) => state.addPromptItem);
  const setPromptOpen = useGraphStore((state) => state.setPromptOpen);
  const setSidebarTab = useGraphStore((state) => state.setSidebarTab);

  const addToPrompt = (title: string, content: string) => {
    addPromptItem({
      id: Date.now().toString(),
      title,
      content,
      type: 'code'
    });
    setPromptOpen(true);
    setSidebarTab('prompt');
  };

  return (
    <div className="flex-1 relative overflow-hidden">
      {status === AppStatus.LOADING_FILES ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-20">
          <Loader2 className="animate-spin text-indigo-500 mb-4" size={40} />
          <p className="text-slate-400">Parsing project structure...</p>
        </div>
      ) : (
        <ErrorBoundary name="CodeVisualizer">
          <CodeVisualizer />
        </ErrorBoundary>
      )}

      {selectedNode && (
        <div className="absolute top-4 left-4 w-80 bg-slate-900/90 backdrop-blur border border-slate-700 rounded-lg shadow-xl p-4 max-h-[80%] overflow-y-auto">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-bold text-slate-200 break-all">{selectedNode.name}</h3>
            <button onClick={() => selectNode(null)} className="text-slate-500 hover:text-slate-300">×</button>
          </div>
          <div className="text-xs text-slate-400 mb-4 font-mono bg-slate-950 p-1 rounded">{selectedNode.path}</div>

          {selectedNode.type === 'file' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-300">
                {(selectedNode.data as FileSystemNode).codeStructure ?
                  'Structure analyzed. See graph for children.' :
                  'Click to analyze structure.'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const content = await ensureFileContent(selectedNode.path);
                    if (content) addToPrompt(`File: ${selectedNode.name}`, content);
                  }}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-2 rounded flex items-center justify-center gap-1"
                >
                  <Plus size={14} /> Add File to Prompt
                </button>
              </div>
            </div>
          )}

          {(selectedNode.type === 'function' || selectedNode.type === 'class') && (
            <div>
              <p className="text-sm text-slate-300 mb-2">{(selectedNode.data as CodeNode).description}</p>
              <pre className="text-xs bg-slate-950 p-2 rounded overflow-x-auto mb-3 border border-slate-800">
                {(selectedNode.data as CodeNode).codeSnippet}
              </pre>
              <button
                onClick={() => addToPrompt(`${selectedNode.type}: ${selectedNode.name}`, (selectedNode.data as CodeNode).codeSnippet || '')}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-2 rounded flex items-center justify-center gap-1"
              >
                <Plus size={14} /> Add to Prompt
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AppVisualization;
