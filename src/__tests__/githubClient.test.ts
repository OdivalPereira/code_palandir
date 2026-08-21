import { describe, it, expect, beforeEach } from 'vitest';
import { getGitHubPat, setGitHubPat, clearGitHubPat } from '../githubClient';

describe('githubClient PAT management', () => {
  beforeEach(() => {
    clearGitHubPat();
  });

  it('should store and retrieve PAT in memory and localStorage', () => {
    expect(getGitHubPat()).toBeNull();
    setGitHubPat('ghp_test1234567890');
    expect(getGitHubPat()).toBe('ghp_test1234567890');
    clearGitHubPat();
    expect(getGitHubPat()).toBeNull();
  });
});
