import { Parser, Language, type Tree } from 'web-tree-sitter';

let isInitialized = false;
let initPromise: Promise<boolean> | null = null;
let tsxLanguage: Language | null = null;
let jsLanguage: Language | null = null;
let parserInstance: Parser | null = null;

export async function initTreeSitter(): Promise<boolean> {
  if (isInitialized && (tsxLanguage !== null || jsLanguage !== null)) {
    return true;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      await Parser.init({
        locateFile(scriptName: string) {
          return `/wasm/${scriptName}`;
        },
      });

      try {
        tsxLanguage = await Language.load('/wasm/tree-sitter-tsx.wasm');
      } catch (e) {
        console.warn('Could not load TSX WASM grammar:', e);
      }

      try {
        jsLanguage = await Language.load('/wasm/tree-sitter-javascript.wasm');
      } catch (e) {
        console.warn('Could not load JS WASM grammar:', e);
      }

      isInitialized = true;
      return tsxLanguage !== null || jsLanguage !== null;
    } catch (err) {
      console.warn('Tree-sitter init error, will use Babel AST parser fallback:', err);
      isInitialized = false;
      return false;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

export function parseWithTreeSitter(content: string, isTsx = true): Tree | null {
  if (typeof content !== 'string' || content.length === 0) {
    return null;
  }
  if (!isInitialized) {
    return null;
  }

  const lang = isTsx ? (tsxLanguage || jsLanguage) : (jsLanguage || tsxLanguage);
  if (!lang) {
    return null;
  }

  try {
    if (!parserInstance) {
      parserInstance = new Parser();
    }
    parserInstance.setLanguage(lang);
    return parserInstance.parse(content);
  } catch (e) {
    console.warn('Tree-sitter parse error, deterministic fallback activated:', e);
    return null;
  }
}

export function isTreeSitterReady(): boolean {
  return isInitialized && (tsxLanguage !== null || jsLanguage !== null);
}

export function resetTreeSitterForTesting(): void {
  isInitialized = false;
  initPromise = null;
  tsxLanguage = null;
  jsLanguage = null;
  if (parserInstance) {
    try {
      parserInstance.delete();
    } catch {
      // ignore
    }
    parserInstance = null;
  }
}

