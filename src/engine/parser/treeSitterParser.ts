import { Parser, Language, type Tree } from 'web-tree-sitter';

let isInitialized = false;
let tsxLanguage: Language | null = null;
let jsLanguage: Language | null = null;

export async function initTreeSitter(): Promise<boolean> {
  if (isInitialized) return true;
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
    return true;
  } catch (err) {
    console.warn('Tree-sitter init error, will use Babel AST parser fallback:', err);
    return false;
  }
}

export function parseWithTreeSitter(content: string, isTsx = true): Tree | null {
  if (!isInitialized) return null;
  const lang = isTsx ? tsxLanguage : (jsLanguage || tsxLanguage);
  if (!lang) return null;

  try {
    const parser = new Parser();
    parser.setLanguage(lang);
    return parser.parse(content);
  } catch (e) {
    console.warn('Tree-sitter parse error:', e);
    return null;
  }
}
