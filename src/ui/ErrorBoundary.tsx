import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-950 p-6 text-center text-slate-100">
          <div className="max-w-md space-y-4 rounded-2xl border border-rose-900/60 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-md">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">Algo deu errado ao carregar</h2>
              <p className="text-xs text-slate-400">
                Ocorreu um erro durante a renderização do aplicativo.
              </p>
            </div>

            {this.state.error && (
              <div className="rounded-lg bg-slate-950 p-3 text-left font-mono text-[11px] text-rose-300 border border-slate-800 overflow-x-auto max-h-40">
                {this.state.error.message}
              </div>
            )}

            <Button
              onClick={this.handleReload}
              className="w-full justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Recarregar Aplicação</span>
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
