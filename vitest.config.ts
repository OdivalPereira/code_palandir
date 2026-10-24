import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // supabase/ roda por `node --test supabase/functions/` (inclui a integração com o Supabase local).
    exclude: [...configDefaults.exclude, 'supabase/**'],
  },
});
