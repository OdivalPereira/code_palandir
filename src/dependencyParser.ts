import { CodeNode, SemanticLink } from './types';

const IMPORT_PATTERNS = [
  /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]/g,
  /import\s*['"]([^'"]+)['"]/g,
  /require\(\s*['"]([^'"]+)['"]\s*\)/g,
  /import\(\s*['"]([^'"]+)['"]\s*\)/g
];

const CALL_PATTERN = /\b([A-Za-z_$][\w$]*)\s*\(/g;

const IGNORED_CALLS = new Set([
  'if',
  'for',
  'while',
  'switch',
  'catch',
  'function',
  'class',
  'return',
  'import',
  'export',
  'await',
  'new',
  'super',
  'this',
  'typeof',
  'console',
  'setTimeout',
  'setInterval',
  'clearTimeout',
  'clearInterval'
]);

const FILE_EXTENSIONS = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.json'
];

const normalizePath = (path: string) => {
  const parts = path.split('/').filter(Boolean);
  const resolved: string[] = [];
  parts.forEach((part) => {
    if (part === '.') return;
    if (part === '..') {
      resolved.pop();
      return;
    }
    resolved.push(part);
  });
  return resolved.join('/');
};

const getDirname = (path: string) => {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
};

const resolveImportTarget = (
  sourcePath: string,
  specifier: string,
  filePaths: Set<string>
) => {
  if (!specifier || specifier.startsWith('http')) return null;
  const baseDir = getDirname(sourcePath);
  let rawPath = specifier;
  if (specifier.startsWith('/')) {
    rawPath = specifier.slice(1);
  } else if (specifier.startsWith('.')) {
    rawPath = normalizePath(`${baseDir}/${specifier}`);
  } else {
    return null;
  }

  for (const ext of FILE_EXTENSIONS) {
    const candidate = `${rawPath}${ext}`;
    if (filePaths.has(candidate)) return candidate;
  }

  for (const ext of FILE_EXTENSIONS) {
    const candidate = `${rawPath}/index${ext}`;
    if (filePaths.has(candidate)) return candidate;
  }

  return null;
};

const extractImportSpecifiers = (content: string) => {
  const matches: string[] = [];
  IMPORT_PATTERNS.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      if (match[1]) matches.push(match[1]);
    }
  });
  return matches;
};

const extractCallIdentifiers = (content: string) => {
  const identifiers: string[] = [];
  let match;
  while ((match = CALL_PATTERN.exec(content)) !== null) {
    const name = match[1];
    if (!name || IGNORED_CALLS.has(name)) continue;
    const index = match.index;
    if (index > 0 && content[index - 1] === '.') continue;
    identifiers.push(name);
  }
  return identifiers;
};

export const buildCodeNodeId = (filePath: string, codeNode: CodeNode) => `${filePath}#${codeNode.name}`;

export type SymbolIndex = Map<string, string[]>;

const resolveCallTargets = (callName: string, symbolIndex: SymbolIndex) => symbolIndex.get(callName) ?? [];

const flattenCodeNodes = (nodes: CodeNode[]) => {
  const result: CodeNode[] = [];
  const visit = (node: CodeNode) => {
    result.push(node);
    if (node.children) {
      node.children.forEach(visit);
    }
  };
  nodes.forEach(visit);
  return result;
};

export const buildSemanticLinksForFile = ({
  sourcePath,
  content,
  codeStructure,
  filePaths,
  symbolIndex
}: {
  sourcePath: string;
  content: string;
  codeStructure?: CodeNode[];
  filePaths: Set<string>;
  symbolIndex: SymbolIndex;
}) => {
  const links: SemanticLink[] = [];
  const sourceIds = new Set<string>();
  sourceIds.add(sourcePath);

  const importSpecifiers = extractImportSpecifiers(content);
  const resolvedImports = new Set<string>();
  importSpecifiers.forEach((specifier) => {
    const resolved = resolveImportTarget(sourcePath, specifier, filePaths);
    if (resolved) resolvedImports.add(resolved);
  });
  resolvedImports.forEach((target) => {
    links.push({ source: sourcePath, target, kind: 'import' });
  });

  const addCallLinks = (sourceId: string, snippet: string) => {
    const callNames = extractCallIdentifiers(snippet);
    const targets = new Set<string>();
    callNames.forEach((callName) => {
      resolveCallTargets(callName, symbolIndex).forEach((targetId) => {
        if (targetId !== sourceId) targets.add(targetId);
      });
    });
    targets.forEach((targetId) => {
      links.push({ source: sourceId, target: targetId, kind: 'call' });
    });
  };

  if (codeStructure && codeStructure.length > 0) {
    flattenCodeNodes(codeStructure).forEach((codeNode) => {
      const sourceId = buildCodeNodeId(sourcePath, codeNode);
      sourceIds.add(sourceId);
      if (codeNode.codeSnippet) {
        addCallLinks(sourceId, codeNode.codeSnippet);
      }
    });
  } else {
    addCallLinks(sourcePath, content);
  }

  return { links, sourceIds };
};
