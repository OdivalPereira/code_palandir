import React from 'react';
import { Loader2 } from 'lucide-react';
import { useGraphStore } from '../stores/graphStore';
import { selectStatus } from '../stores/graphSelectors';
import { AppStatus } from '../types';
import TrailVisualizer from './TrailVisualizer';
import { ErrorBoundary } from './ErrorBoundary';

export const AppVisualization: React.FC = () => {
  const status = useGraphStore(selectStatus);

  return (
    <div className="flex-1 relative overflow-hidden h-full">
      {status === AppStatus.LOADING_FILES ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 z-20">
          <Loader2 className="animate-spin text-indigo-500 mb-4" size={40} />
          <p className="text-slate-400 text-sm font-medium">Carregando estrutura e rastreando dependências...</p>
        </div>
      ) : (
        <ErrorBoundary name="TrailVisualizer">
          <TrailVisualizer />
        </ErrorBoundary>
      )}
    </div>
  );
};

export default AppVisualization;
