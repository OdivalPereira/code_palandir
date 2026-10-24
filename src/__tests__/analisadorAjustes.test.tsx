import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { DetailSidebar } from '../features/detail/DetailSidebar';
import { useGraphStore } from '../stores/graphStore';
import type { FlowUINode } from '../types/graph';

const noPagina = {
  id: 'node-page-login',
  type: 'page',
  position: { x: 0, y: 0 },
  data: {
    id: 'node-page-login',
    label: 'LoginPage',
    nodeType: 'page',
    filePath: 'src/pages/LoginPage.tsx',
    codeSnippet: 'export function LoginPage() { return <form />; }',
  },
} as unknown as FlowUINode;

describe('DetailSidebar', () => {
  beforeEach(() => {
    act(() => useGraphStore.setState({ selectedNode: null }));
  });

  it('troca entre vazio e um nó sem quebrar a ordem dos hooks', () => {
    render(<DetailSidebar />);
    expect(screen.getByText('Nenhum elemento selecionado')).toBeTruthy();

    act(() => useGraphStore.setState({ selectedNode: noPagina }));
    expect(screen.getByRole('heading', { name: 'LoginPage' })).toBeTruthy();

    act(() => useGraphStore.setState({ selectedNode: null }));
    expect(screen.getByText('Nenhum elemento selecionado')).toBeTruthy();
  });
});
