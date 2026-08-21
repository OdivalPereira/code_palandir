import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getGitHubPat,
  setGitHubPat,
  clearGitHubPat,
  listRepoBranches,
  listRepoTags,
  listRepoPullRequests,
  getPullRequestFiles,
  listRepoCommits,
  getRateLimitStatus,
} from '../githubClient';

describe('githubClient', () => {
  beforeEach(() => {
    clearGitHubPat();
    vi.restoreAllMocks();
  });

  it('should store and retrieve PAT in memory and localStorage', () => {
    expect(getGitHubPat()).toBeNull();
    setGitHubPat('ghp_test1234567890');
    expect(getGitHubPat()).toBe('ghp_test1234567890');
    clearGitHubPat();
    expect(getGitHubPat()).toBeNull();
  });

  it('should fetch branches for a repository', async () => {
    const mockBranches = [{ name: 'main', commit: { sha: '123456', url: 'https://...' } }];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => mockBranches,
    });
    globalThis.fetch = fetchMock;
    window.fetch = fetchMock;

    const branches = await listRepoBranches('facebook', 'react');
    expect(branches).toEqual(mockBranches);
  });

  it('should fetch pull requests for a repository', async () => {
    const mockPRs = [
      {
        id: 1,
        number: 42,
        title: 'Fix typo',
        state: 'open',
        user: { login: 'octocat', avatar_url: '' },
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
        html_url: 'https://github.com/facebook/react/pull/42',
        head: { ref: 'fix', sha: 'abc' },
        base: { ref: 'main', sha: 'def' },
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => mockPRs,
    });
    globalThis.fetch = fetchMock;
    window.fetch = fetchMock;

    const prs = await listRepoPullRequests('facebook', 'react', 'open');
    expect(prs).toEqual(mockPRs);
  });

  it('should fetch files changed in a PR', async () => {
    const mockFiles = [
      {
        sha: 'abc',
        filename: 'src/index.ts',
        status: 'modified',
        additions: 10,
        deletions: 2,
        changes: 12,
        patch: '@@ -1,2 +1,10 @@',
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => mockFiles,
    });
    globalThis.fetch = fetchMock;
    window.fetch = fetchMock;

    const files = await getPullRequestFiles('facebook', 'react', 42);
    expect(files).toEqual(mockFiles);
  });

  it('should fetch tags for a repository', async () => {
    const mockTags = [{ name: 'v1.0.0', commit: { sha: '123', url: '' }, zipball_url: '', tarball_url: '', node_id: '' }];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => mockTags,
    });
    globalThis.fetch = fetchMock;
    window.fetch = fetchMock;

    const tags = await listRepoTags('facebook', 'react');
    expect(tags).toEqual(mockTags);
  });

  it('should fetch commits for a repository', async () => {
    const mockCommits = [{ sha: 'abcdef', commit: { message: 'feat: init', author: { name: 'dev', date: '' } }, html_url: '' }];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => mockCommits,
    });
    globalThis.fetch = fetchMock;
    window.fetch = fetchMock;

    const commits = await listRepoCommits('facebook', 'react', 'main');
    expect(commits).toEqual(mockCommits);
  });

  it('should fetch rate limit status', async () => {
    const mockRateLimit = {
      resources: {
        core: { limit: 5000, remaining: 4999, reset: 1700000000, used: 1 },
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => mockRateLimit,
    });
    globalThis.fetch = fetchMock;
    window.fetch = fetchMock;

    const rateLimit = await getRateLimitStatus();
    expect(rateLimit).toEqual(mockRateLimit.resources.core);
  });
});

