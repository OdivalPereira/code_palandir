import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGraphStore } from '../graphStore';

describe('GitHub Advanced Integration in GraphStore', () => {
  beforeEach(() => {
    window.alert = vi.fn();
    useGraphStore.setState({
      rootNode: null,
      expandedDirectories: new Set(),
      githubOwnerRepo: { owner: 'testowner', repo: 'testrepo', branch: 'main' },
      currentBranch: 'main',
      availableBranches: [{ name: 'main', commit: { sha: '111', url: '' } }],
      availablePullRequests: [
        {
          id: 42,
          number: 42,
          title: 'PR #42',
          state: 'open',
          user: { login: 'octocat', avatar_url: '' },
          created_at: '2026-08-01T00:00:00Z',
          updated_at: '2026-08-01T00:00:00Z',
          html_url: 'https://github.com/testowner/testrepo/pull/42',
          head: { ref: 'feat', sha: 'abc' },
          base: { ref: 'main', sha: 'def' },
        },
      ],
      activePullRequest: null,
      diffStatusByPath: new Map(),
      allFilePaths: ['src/index.ts', 'src/App.tsx'],
      nodes: [
        { id: 'src/index.ts', name: 'index.ts', path: 'src/index.ts', type: 'file', group: 1 },
        { id: 'src/App.tsx', name: 'App.tsx', path: 'src/App.tsx', type: 'file', group: 1 },
      ],
      nodesById: {
        'src/index.ts': { id: 'src/index.ts', name: 'index.ts', path: 'src/index.ts', type: 'file', group: 1 },
        'src/App.tsx': { id: 'src/App.tsx', name: 'App.tsx', path: 'src/App.tsx', type: 'file', group: 1 },
      },
    });
    vi.restoreAllMocks();
  });

  it('should switch branch and reset diff state', async () => {
    const mockTree = {
      tree: [
        { type: 'blob', path: 'src/index.ts' },
        { type: 'blob', path: 'src/components/NewFeature.tsx' },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/git/trees/')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => mockTree,
        } as any;
      }
      if (urlStr.includes('/commits')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => [],
        } as any;
      }
      if (urlStr.includes('/rate_limit')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ resources: { core: { limit: 5000, remaining: 5000, reset: 0, used: 0 } } }),
        } as any;
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({}),
      } as any;
    });

    await useGraphStore.getState().switchBranch('feature-xyz');

    expect(useGraphStore.getState().currentBranch).toBe('feature-xyz');
    expect(useGraphStore.getState().allFilePaths).toContain('src/components/NewFeature.tsx');
    expect(useGraphStore.getState().activePullRequest).toBeNull();
  });

  it('should load pull request, calculate diffs, and update node styling', async () => {
    const mockPRFiles = [
      {
        sha: '123',
        filename: 'src/index.ts',
        status: 'modified',
        additions: 15,
        deletions: 3,
        changes: 18,
        patch: '@@ ... @@',
      },
    ];

    const fetchMock = vi.fn().mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes('/pulls/42/files')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => mockPRFiles,
        } as any;
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => [],
      } as any;
    });
    globalThis.fetch = fetchMock;
    window.fetch = fetchMock;

    await useGraphStore.getState().loadPullRequest(42);

    const state = useGraphStore.getState();
    expect(state.activePullRequest).not.toBeNull();
    expect(state.activePullRequest?.number).toBe(42);
    expect(state.activePullRequest?.totalAdditions).toBe(15);
    expect(state.activePullRequest?.totalDeletions).toBe(3);

    const modifiedNode = state.nodes.find((n) => n.path === 'src/index.ts');
    expect(modifiedNode?.diffStatus).toBe('modified');
    expect(modifiedNode?.diffAdditions).toBe(15);
    expect(modifiedNode?.diffDeletions).toBe(3);

    // Test clearPullRequestMode
    useGraphStore.getState().clearPullRequestMode();
    const clearedState = useGraphStore.getState();
    expect(clearedState.activePullRequest).toBeNull();
    const clearedNode = clearedState.nodes.find((n) => n.path === 'src/index.ts');
    expect(clearedNode?.diffStatus).toBeUndefined();
  });
});
