import { describe, it, expect } from 'vitest';
import { convertUIGraphToFlatNodes } from '../uiGraphTransformer';
import { UINode } from '../../types';

describe('uiGraphTransformer', () => {
  it('should transform tree into flat nodes and links', () => {
    const root: UINode = {
      id: 'app-root',
      name: 'App',
      label: 'App',
      type: 'app',
      sourceFile: 'src/App.tsx',
      children: [
        {
          id: 'btn-1',
          name: 'Button',
          label: 'Button',
          type: 'component',
          sourceFile: 'src/components/Button.tsx',
          children: []
        }
      ]
    };

    const { nodes, links } = convertUIGraphToFlatNodes(root);
    expect(nodes.length).toBe(2);
    expect(links.length).toBe(1);
    expect(links[0].source).toBe('app-root');
    expect(links[0].target).toBe('btn-1');
  });

  it('should prevent infinite loops on circular children references', () => {
    const nodeA: UINode = {
      id: 'node-a',
      name: 'NodeA',
      label: 'NodeA',
      type: 'component',
      sourceFile: 'src/A.tsx',
      children: []
    };
    const nodeB: UINode = {
      id: 'node-b',
      name: 'NodeB',
      label: 'NodeB',
      type: 'component',
      sourceFile: 'src/B.tsx',
      children: [nodeA]
    };
    // Circular reference
    nodeA.children = [nodeB];

    const { nodes, links } = convertUIGraphToFlatNodes(nodeA);
    expect(nodes.length).toBe(2);
    expect(links.length).toBe(2);
  });

  it('should generate ghost nodes and link to requiring sources', () => {
    const root: UINode = {
      id: 'user-list',
      name: 'UserList',
      label: 'UserList',
      type: 'component',
      sourceFile: 'src/UserList.tsx',
      children: []
    };

    const missingDeps = [
      {
        id: 'users-table',
        name: 'users_table',
        type: 'table' as const,
        requiredBy: ['src/UserList.tsx'],
        description: 'Postgres table for users'
      }
    ];

    const { nodes, links } = convertUIGraphToFlatNodes(root, missingDeps);
    expect(nodes.length).toBe(2);
    const ghost = nodes.find(n => n.isGhost);
    expect(ghost).toBeDefined();
    expect(ghost?.type).toBe('ghost_table');
    expect(links.length).toBe(1);
    expect(links[0].source).toBe('user-list');
    expect(links[0].target).toBe('ghost-users-table');
  });
});
