import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PergaminhoAbertura } from '../painel/mensagem/PergaminhoAbertura';
import { cenarioSoDesconhecidos, exemploOficial } from '../painel/fixtures/cenarios';
import type { ItemCardapio } from '../painel/contrato/painel1.types';
import { usePainelStore } from '../stores/painelStore';
import * as clipboardService from '@/services/clipboard';

const cardapioOficial = exemploOficial.cardapio ?? [];

function opcoesDe(id: string): string[] {
  const sel = document.getElementById(id) as HTMLSelectElement;
  return Array.from(sel.options).map((o) => o.value);
}

function previa(): string {
  return screen.getByLabelText(/Pré-visualização da mensagem de abertura/i).textContent ?? '';
}

function esperarCopiaBloqueada(motivo: RegExp) {
  const botao = screen.getByRole('button', { name: /Copiar mensagem/i }) as HTMLButtonElement;
  expect(botao.disabled).toBe(true);
  expect(botao.getAttribute('aria-disabled')).toBe('true');
  const idMotivo = botao.getAttribute('aria-describedby');
  expect(idMotivo).toBeTruthy();
  expect(document.getElementById(idMotivo as string)?.textContent).toMatch(motivo);
  expect(previa()).toMatch(/Prévia indisponível/);
  expect(previa()).not.toContain('Para:');
}

describe('PergaminhoAbertura — só copia escala válida do instantâneo (A2, A3, A4)', () => {
  beforeEach(() => {
    usePainelStore.getState().resetar();
  });

  it('A2: diario-campo sem etapas mostra "nenhuma etapa coletada", sem ID inventado e com cópia bloqueada', () => {
    const spyCopy = vi.spyOn(clipboardService, 'copyToClipboard').mockResolvedValue(true);
    render(<PergaminhoAbertura projetos={exemploOficial.projetos} cardapio={cardapioOficial} />);

    fireEvent.change(screen.getByLabelText('Projeto'), { target: { value: 'diario-campo' } });

    const etapa = screen.getByLabelText('Etapa') as HTMLSelectElement;
    expect(etapa.disabled).toBe(true);
    expect(etapa.textContent).toContain('nenhuma etapa coletada');
    expect(opcoesDe('pergaminho-etapa')).toEqual(['']);
    expect(document.body.textContent).not.toContain('e1-inicial');
    esperarCopiaBloqueada(/Nenhuma etapa coletada/);

    fireEvent.click(screen.getByRole('button', { name: /Copiar mensagem/i }));
    expect(spyCopy).not.toHaveBeenCalled();
    spyCopy.mockRestore();
  });

  it('A2: sem projetos nenhum ID padrão é inventado', () => {
    render(<PergaminhoAbertura projetos={[]} cardapio={cardapioOficial} />);
    expect(opcoesDe('pergaminho-projeto')).toEqual(['']);
    expect(document.body.textContent).not.toContain('loja-exemplo');
    esperarCopiaBloqueada(/Nenhum projeto coletado/);
  });

  it('A3: fixture so_desconhecidos (cardápio vazio) mostra "cardápio indisponível" e bloqueia a cópia', () => {
    render(
      <PergaminhoAbertura
        projetos={cenarioSoDesconhecidos.projetos}
        cardapio={cenarioSoDesconhecidos.cardapio}
      />
    );
    const plataforma = screen.getByLabelText('Plataforma') as HTMLSelectElement;
    expect(plataforma.disabled).toBe(true);
    expect(plataforma.textContent).toContain('cardápio indisponível');
    expect(opcoesDe('pergaminho-plataforma')).toEqual(['']);
    expect(document.body.textContent).not.toContain('Antigravity');
    esperarCopiaBloqueada(/Cardápio indisponível/);
  });

  it('A3: cardápio [] e cardápio ausente bloqueiam a cópia', () => {
    const { unmount } = render(
      <PergaminhoAbertura projetos={exemploOficial.projetos} cardapio={[]} />
    );
    esperarCopiaBloqueada(/Cardápio indisponível/);
    unmount();

    usePainelStore.setState({ dados: null });
    render(<PergaminhoAbertura projetos={exemploOficial.projetos} />);
    esperarCopiaBloqueada(/Cardápio indisponível/);
  });

  it('A4: cardápio de uma plataforma só oferece por nível apenas as linhas dela e tira subagentes sem opção', () => {
    const umaPlataforma: ItemCardapio[] = [
      { plataforma: 'Codex', fornecedor: 'OpenAI', nivel: 'alta', modelo: 'GPT-6-Astra', esforco: 'high' },
      { plataforma: 'Codex', fornecedor: 'OpenAI', nivel: 'moderada', modelo: 'GPT-6.1-Sol', esforco: 'medium' },
    ];
    render(<PergaminhoAbertura projetos={exemploOficial.projetos} cardapio={umaPlataforma} />);

    expect(opcoesDe('pergaminho-plataforma')).toEqual(['Codex']);
    expect(opcoesDe('pergaminho-subagente-alta')).toEqual(['GPT-6-Astra']);
    expect(opcoesDe('pergaminho-subagente-moderada')).toEqual(['GPT-6.1-Sol']);
    expect(opcoesDe('pergaminho-subagente-simples')).toEqual(['']);

    const aviso = screen.getByText(/Subagentes fora da mensagem/);
    expect(aviso.textContent).toContain('simples');
    const texto = previa();
    expect(texto).toContain('Para: coordenador (Codex, GPT-6.1-Sol, esforço medium) · Etapa: e3-carrinho');
    expect(texto).not.toContain('subagentes');
    const botao = screen.getByRole('button', { name: /Copiar mensagem/i }) as HTMLButtonElement;
    expect(botao.disabled).toBe(false);
  });

  it('A4: trocar plataforma revalida escala e subagentes, sem modelo de outra plataforma', () => {
    render(<PergaminhoAbertura projetos={exemploOficial.projetos} cardapio={cardapioOficial} />);

    expect(opcoesDe('pergaminho-subagente-alta')).toEqual(['Gemini 4 Argon']);
    expect(opcoesDe('pergaminho-subagente-simples')).toEqual(['Gemini 3.8 Flash']);

    fireEvent.change(screen.getByLabelText('Plataforma'), { target: { value: 'Codex' } });

    expect(opcoesDe('pergaminho-subagente-alta')).toEqual(['GPT-6-Astra']);
    expect(opcoesDe('pergaminho-subagente-moderada')).toEqual(['GPT-6.1-Sol']);
    expect(opcoesDe('pergaminho-subagente-simples')).toEqual(['GPT-6-Luna']);
    const todas = [
      ...opcoesDe('pergaminho-escala'),
      ...opcoesDe('pergaminho-subagente-alta'),
      ...opcoesDe('pergaminho-subagente-moderada'),
      ...opcoesDe('pergaminho-subagente-simples'),
    ].join(' ');
    expect(todas).not.toMatch(/Gemini|Claude/);

    const texto = previa();
    expect(texto).toContain('Para: coordenador (Codex, GPT-6.1-Sol, esforço medium)');
    expect(texto).toContain('subagentes: alta=GPT-6-Astra,moderada=GPT-6.1-Sol,simples=GPT-6-Luna');
    expect(texto).not.toMatch(/Gemini/);
  });

  it('mantém a saída-ouro de loja-exemplo/e3-carrinho no estado padrão e copia', async () => {
    const spyCopy = vi.spyOn(clipboardService, 'copyToClipboard').mockResolvedValue(true);
    render(<PergaminhoAbertura projetos={exemploOficial.projetos} cardapio={cardapioOficial} />);
    expect(previa()).toBe(
      [
        'Para: coordenador (Antigravity, Gemini 3.8 Flash, esforço medium) · Etapa: e3-carrinho · CONVERSA NOVA',
        'Worktree: ~/.sociedade/trabalho/loja-exemplo/e3-carrinho',
        'Escala: papel=coordenador, plataforma=Antigravity, modelo=Gemini 3.8 Flash, esforço=medium, subagentes: alta=Gemini 4 Argon,moderada=Gemini 3.8 Flash,simples=Gemini 3.8 Flash',
        'Assumir: sc.py assumir coordenador --etapa e3-carrinho --plataforma "Antigravity" --modelo "Gemini 3.8 Flash" --esforco "medium" --subagentes "alta=Gemini 4 Argon,moderada=Gemini 3.8 Flash,simples=Gemini 3.8 Flash"',
        'Ação: leia a ordem da etapa (sociedade/ordens/e3-carrinho.md).',
      ].join('\n')
    );
    const botao = screen.getByRole('button', { name: /Copiar mensagem/i });
    expect(botao.getAttribute('aria-disabled')).toBe('false');
    fireEvent.click(botao);
    expect(await screen.findByText(/Mensagem copiada!/i)).toBeTruthy();
    expect(spyCopy).toHaveBeenCalledTimes(1);
    spyCopy.mockRestore();
  });
});
