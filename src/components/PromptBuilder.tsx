import React from 'react';
import { PromptItem } from '../types';
import { Trash2, Copy, MessageSquarePlus } from 'lucide-react';

interface PromptBuilderProps {
  items: PromptItem[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

const PromptBuilder: React.FC<PromptBuilderProps> = ({ items, onRemove, onClear }) => {
  
  const generateFinalPrompt = () => {
    let prompt = "I need help understanding and modifying this code.\n\n";
    
    const contextItems = items.filter(i => i.type === 'context');
    if (contextItems.length > 0) {
        prompt += "CONTEXT:\n" + contextItems.map(i => `- ${i.content}`).join('\n') + "\n\n";
    }

    const codeItems = items.filter(i => i.type === 'code');
    if (codeItems.length > 0) {
        prompt += "RELEVANT CODE SNIPPETS:\n";
        codeItems.forEach(item => {
            prompt += `\n// ${item.title}\n${item.content}\n`;
        });
    }
    
    const comments = items.filter(i => i.type === 'comment');
    if (comments.length > 0) {
        prompt += "\nMY QUESTIONS/COMMENTS:\n";
        comments.forEach(item => {
            prompt += `- ${item.content}\n`;
        });
    }

    return prompt;
  };

  const handleCopy = () => {
    const text = generateFinalPrompt();
    navigator.clipboard.writeText(text);
    alert("Prompt copied to clipboard!");
  };

  return (
    <div className="flex flex-col h-full bg-slate-800 border-l border-slate-700">
      <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
        <h2 className="font-semibold text-slate-100 flex items-center gap-2">
          <MessageSquarePlus size={18} className="text-indigo-400" />
          Prompt Builder
        </h2>
        <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded-full">
          {items.length} items
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.length === 0 ? (
          <div className="text-center text-slate-500 mt-10 text-sm">
            <p>Your prompt basket is empty.</p>
            <p className="mt-2">Click nodes in the graph or add comments to build your prompt.</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="bg-slate-700/50 rounded-lg border border-slate-600 p-3 group hover:border-indigo-500/50 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase ${
                  item.type === 'code' ? 'bg-blue-500/20 text-blue-300' :
                  item.type === 'context' ? 'bg-purple-500/20 text-purple-300' :
                  'bg-green-500/20 text-green-300'
                }`}>
                  {item.type}
                </span>
                <button 
                  onClick={() => onRemove(item.id)}
                  className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              
              <h3 className="text-sm font-medium text-slate-200 mb-1">{item.title}</h3>
              
              {item.type === 'code' ? (
                <pre className="bg-slate-950 p-2 rounded text-xs text-slate-400 overflow-x-auto font-mono border border-slate-800">
                  {item.content.slice(0, 150)}{item.content.length > 150 ? '...' : ''}
                </pre>
              ) : (
                <p className="text-xs text-slate-400">{item.content}</p>
              )}
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-slate-700 bg-slate-900/50 space-y-2">
        <button 
          onClick={handleCopy}
          disabled={items.length === 0}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white py-2.5 rounded-lg font-medium transition-colors"
        >
          <Copy size={16} />
          Copy Optimized Prompt
        </button>
        <button 
          onClick={onClear}
          disabled={items.length === 0}
          className="w-full text-xs text-slate-500 hover:text-slate-300 py-1"
        >
          Clear All
        </button>
      </div>
    </div>
  );
};

export default PromptBuilder;
