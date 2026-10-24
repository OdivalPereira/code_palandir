import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const CAPTURAS_DIR = path.resolve('e2e/capturas');

test.beforeAll(() => {
  if (!fs.existsSync(CAPTURAS_DIR)) {
    fs.mkdirSync(CAPTURAS_DIR, { recursive: true });
  }
});

test.describe('Code Palandir — Acessibilidade, Layout Responsivo e Capturas E2E', () => {
  /* =========================================================================
     1. TELA CONSELHO (HOJE) — '/'
     ========================================================================= */
  test('Conselho (Hoje) — 1280x800 (Desktop)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // 1. Selo Dados de exemplo no topo
    await expect(page.getByText('Dados de exemplo')).toBeVisible();

    // 2. Seções I a IV do Conselho
    await expect(page.getByRole('heading', { name: /I\. Espera pelo Conselho/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /II\. Terras em Névoa · Desconhecido/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /III\. Forjas e Núcleos/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /IV\. Pergaminho de Abertura/i })).toBeVisible();

    // 3. Selo "NUNCA EM DIA" e menção a Diário de Campo
    await expect(page.getByText('NUNCA EM DIA').first()).toBeVisible();
    await expect(page.getByText('Diário de Campo').first()).toBeVisible();

    // 4. Saída-ouro no Pergaminho de Abertura (seção 5.3)
    const preAbertura = page.locator('pre[aria-label="Pré-visualização da mensagem de abertura"]');
    await expect(preAbertura).toBeVisible();
    const textoPre = await preAbertura.innerText();
    expect(textoPre).toContain('Para: coordenador (Antigravity');
    expect(textoPre).toContain('Etapa: e3-carrinho');
    expect(textoPre).toContain('Worktree: ~/.sociedade/trabalho/loja-exemplo/e3-carrinho');
    expect(textoPre).toContain('Assumir: sc.py assumir coordenador');

    // Botão de cópia acessível
    await expect(page.getByRole('button', { name: /Copiar mensagem/i })).toBeVisible();

    // 5. Alvos de toque na navegação principal (>= 44px)
    const navLinks = page.locator('aside[aria-label="Navegação Principal"] a');
    const count = await navLinks.count();
    expect(count).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < count; i++) {
      const box = await navLinks.nth(i).boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }

    // 6. Captura de tela 1280x800
    const screenshotPath = path.join(CAPTURAS_DIR, 'conselho-1280x800.png');
    await page.screenshot({ path: screenshotPath });
    expect(fs.existsSync(screenshotPath)).toBe(true);
    expect(fs.statSync(screenshotPath).size).toBeGreaterThan(1024);
  });

  test('Conselho (Hoje) — 360x820 (Mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 820 });
    await page.goto('/');

    // 1. Selo Dados de exemplo
    await expect(page.getByText('Dados de exemplo')).toBeVisible();

    // 2. Ausência de rolagem horizontal em 360px
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(360);

    // 3. Alvos de toque na navegação móvel (>= 44px)
    const mobileLinks = page.locator('nav[aria-label="Navegação Móvel"] a');
    const count = await mobileLinks.count();
    expect(count).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < count; i++) {
      const box = await mobileLinks.nth(i).boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }

    // 4. "NUNCA EM DIA" presente
    await expect(page.getByText('NUNCA EM DIA').first()).toBeVisible();

    // 5. Captura de tela 360x820
    const screenshotPath = path.join(CAPTURAS_DIR, 'conselho-360x820.png');
    await page.screenshot({ path: screenshotPath });
    expect(fs.existsSync(screenshotPath)).toBe(true);
    expect(fs.statSync(screenshotPath).size).toBeGreaterThan(1024);
  });

  /* =========================================================================
     2. TELA REGIÕES (PROJETOS) — '/projetos'
     ========================================================================= */
  test('Regiões (Projetos) — 1280x800 (Desktop)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/projetos');

    // 1. Selo Dados de exemplo
    await expect(page.getByText('Dados de exemplo')).toBeVisible();

    // 2. Lista de Regiões
    await expect(page.getByRole('complementary', { name: /Lista de Regiões/i })).toBeVisible();
    await expect(page.getByText('Loja Exemplo').first()).toBeVisible();
    await expect(page.getByText('App Receitas').first()).toBeVisible();
    await expect(page.getByText('Diário de Campo').first()).toBeVisible();

    // 3. Marcos da Jornada e seções
    await expect(page.getByRole('group', { name: /Marcos da etapa/i }).first()).toBeVisible();

    // 4. Alvos de toque na navegação (>= 44px)
    const navLinks = page.locator('aside[aria-label="Navegação Principal"] a');
    const count = await navLinks.count();
    expect(count).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < count; i++) {
      const box = await navLinks.nth(i).boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }

    // 5. Captura de tela 1280x800
    const screenshotPath = path.join(CAPTURAS_DIR, 'regioes-1280x800.png');
    await page.screenshot({ path: screenshotPath });
    expect(fs.existsSync(screenshotPath)).toBe(true);
    expect(fs.statSync(screenshotPath).size).toBeGreaterThan(1024);
  });

  test('Regiões (Projetos) — 360x820 (Mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 820 });
    await page.goto('/projetos');

    // 1. Selo Dados de exemplo
    await expect(page.getByText('Dados de exemplo')).toBeVisible();

    // 2. Ausência de rolagem horizontal em 360px
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(360);

    // 3. Alvos de toque na navegação móvel (>= 44px)
    const mobileLinks = page.locator('nav[aria-label="Navegação Móvel"] a');
    const count = await mobileLinks.count();
    expect(count).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < count; i++) {
      const box = await mobileLinks.nth(i).boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }

    // 4. Captura de tela 360x820
    const screenshotPath = path.join(CAPTURAS_DIR, 'regioes-360x820.png');
    await page.screenshot({ path: screenshotPath });
    expect(fs.existsSync(screenshotPath)).toBe(true);
    expect(fs.statSync(screenshotPath).size).toBeGreaterThan(1024);
  });

  /* =========================================================================
     3. TELA PALANTÍR (ANALISADOR) — '/analisador'
     ========================================================================= */
  test('Palantír (Analisador) — 1280x800 (Desktop)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/analisador');

    // 1. Selo Dados de exemplo
    await expect(page.getByText('Dados de exemplo')).toBeVisible();

    // 2. Presença do analisador (barra superior ou área principal)
    await expect(page.locator('main').first()).toBeVisible();

    // 3. Alvos de toque na navegação (>= 44px)
    const navLinks = page.locator('aside[aria-label="Navegação Principal"] a');
    const count = await navLinks.count();
    expect(count).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < count; i++) {
      const box = await navLinks.nth(i).boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }

    // 4. Captura de tela 1280x800
    const screenshotPath = path.join(CAPTURAS_DIR, 'palantir-1280x800.png');
    await page.screenshot({ path: screenshotPath });
    expect(fs.existsSync(screenshotPath)).toBe(true);
    expect(fs.statSync(screenshotPath).size).toBeGreaterThan(1024);
  });

  test('Palantír (Analisador) — 360x820 (Mobile)', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 820 });
    await page.goto('/analisador');

    // 1. Selo Dados de exemplo
    await expect(page.getByText('Dados de exemplo')).toBeVisible();

    // 2. Ausência de rolagem horizontal em 360px
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(360);

    // 3. Alvos de toque na navegação móvel (>= 44px)
    const mobileLinks = page.locator('nav[aria-label="Navegação Móvel"] a');
    const count = await mobileLinks.count();
    expect(count).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < count; i++) {
      const box = await mobileLinks.nth(i).boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }

    // 4. Captura de tela 360x820
    const screenshotPath = path.join(CAPTURAS_DIR, 'palantir-360x820.png');
    await page.screenshot({ path: screenshotPath });
    expect(fs.existsSync(screenshotPath)).toBe(true);
    expect(fs.statSync(screenshotPath).size).toBeGreaterThan(1024);
  });
});
