export type SupportedFramework =
  | 'react'
  | 'nextjs'
  | 'vue'
  | 'nuxtjs'
  | 'angular'
  | 'svelte'
  | 'unknown';

export interface ProjectFile {
  path: string;           // Relative path inside project, e.g. "src/components/LoginForm.tsx"
  content: string;        // Text content
  size: number;
  language: 'typescript' | 'tsx' | 'javascript' | 'jsx' | 'vue' | 'html' | 'css' | 'json' | 'other';
}

export interface ProjectMeta {
  name: string;
  framework: SupportedFramework;
  version?: string;
  entryPoint?: string;
  sourceType: 'local-folder' | 'zip' | 'github';
  sourceName: string;     // e.g. "repo-name" or folder name
  fileCount: number;
  totalSize: number;
  createdAt: number;
}
