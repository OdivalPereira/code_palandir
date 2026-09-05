import React, { useState } from 'react';
import { Folder, Upload, Play, AlertCircle } from 'lucide-react';
import { Button } from '@/ui/Button';
import { readDirectoryWithPicker, extractZipArchive } from '@/services/fileSystem';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { createDemoProjectFiles } from '@/services/demoProject';

export const LocalImport: React.FC = () => {
  const setProject = useProjectStore((state) => state.setProject);
  const setImportModalOpen = useUIStore((state) => state.setImportModalOpen);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePickDirectory = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const files = await readDirectoryWithPicker();
      if (files.length === 0) {
        throw new Error('Nenhum arquivo de código suportado foi encontrado nesta pasta.');
      }

      setProject(
        {
          name: 'Projeto Local',
          framework: 'react',
          sourceType: 'local-folder',
          sourceName: 'pasta-local',
          fileCount: files.length,
          totalSize: files.reduce((acc, f) => acc + f.size, 0),
          createdAt: Date.now(),
        },
        files
      );

      setImportModalOpen(false);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setErrorMessage(err?.message || 'Erro ao ler pasta do computador.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setErrorMessage(null);
    try {
      const buffer = await file.arrayBuffer();
      const files = await extractZipArchive(buffer);

      if (files.length === 0) {
        throw new Error('O arquivo ZIP não contém arquivos de código suportados.');
      }

      setProject(
        {
          name: file.name.replace(/\.zip$/i, ''),
          framework: 'react',
          sourceType: 'zip',
          sourceName: file.name,
          fileCount: files.length,
          totalSize: file.size,
          createdAt: Date.now(),
        },
        files
      );

      setImportModalOpen(false);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erro ao descompactar arquivo ZIP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadDemo = () => {
    setIsLoading(true);
    const demo = createDemoProjectFiles();
    setProject(
      {
        name: 'Demo: SaaS Multi-Abas',
        framework: 'react',
        sourceType: 'local-folder',
        sourceName: 'demo-app',
        fileCount: demo.length,
        totalSize: demo.reduce((acc, f) => acc + f.size, 0),
        createdAt: Date.now(),
      },
      demo
    );
    setIsLoading(false);
    setImportModalOpen(false);
  };

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="flex items-start gap-2 rounded-xl bg-rose-950/40 border border-rose-800 p-3 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 text-rose-400 mt-0.5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Option 1: Open Local Folder */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-indigo-400" />
          <h4 className="text-xs font-semibold text-slate-200">Pasta do Computador</h4>
        </div>
        <p className="text-xs text-slate-400">
          Selecione a pasta raiz do seu projeto. O parsing ocorre 100% no seu navegador sem enviar código para servidores.
        </p>
        <Button
          onClick={handlePickDirectory}
          disabled={isLoading}
          className="w-full justify-center gap-2 h-9"
        >
          <Folder className="h-4 w-4" />
          <span>{isLoading ? 'Lendo arquivos...' : 'Selecionar Pasta Local'}</span>
        </Button>
      </div>

      {/* Option 2: Upload ZIP */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Upload className="h-4 w-4 text-purple-400" />
          <h4 className="text-xs font-semibold text-slate-200">Arquivo ZIP</h4>
        </div>
        <p className="text-xs text-slate-400">
          Envie o arquivo compactado de um projeto ou release.
        </p>
        <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 bg-slate-800/40 px-4 py-3 text-xs text-slate-300 hover:border-indigo-500 hover:text-white cursor-pointer transition-colors">
          <Upload className="h-4 w-4 text-slate-400" />
          <span>Clique para escolher arquivo .zip</span>
          <input
            type="file"
            accept=".zip"
            onChange={handleZipUpload}
            disabled={isLoading}
            className="hidden"
          />
        </label>
      </div>

      {/* Option 3: Instant Demo */}
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Play className="h-4 w-4 text-indigo-400" />
          <h4 className="text-xs font-semibold text-indigo-200">Explorar com Projeto Demo</h4>
        </div>
        <p className="text-xs text-slate-400">
          Carregue instantaneamente um WebApp completo com Login, Dashboard, Abas de Relatórios, Cards, Botões e Zustand.
        </p>
        <Button
          onClick={handleLoadDemo}
          disabled={isLoading}
          variant="secondary"
          className="w-full justify-center gap-2 h-9 border border-indigo-500/30 hover:bg-indigo-900/40 text-indigo-200"
        >
          <Play className="h-3.5 w-3.5 fill-indigo-400" />
          <span>Carregar Projeto Demo (Instantâneo)</span>
        </Button>
      </div>
    </div>
  );
};
