/**
 * Browser polyfills for Node-targeted dependencies (Babel generator, Dagre, JSZip).
 * Bundled in module scope so index.html requires zero inline scripts under strict Content Security Policy.
 */
if (typeof window !== 'undefined') {
  // Polyfill 'global'
  (window as unknown as { global: unknown }).global = window;

  // Polyfill minimal 'process'
  const win = window as unknown as {
    process?: {
      env: Record<string, string>;
      nextTick: (cb: (...args: unknown[]) => void) => void;
      emitWarning: () => void;
    };
  };

  win.process = win.process || {
    env: {},
    nextTick: function (cb: (...args: unknown[]) => void) {
      setTimeout(cb, 0);
    },
    emitWarning: function () {},
  };
}

export {};
