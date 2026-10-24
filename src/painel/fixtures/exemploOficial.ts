import type { Painel1 } from '../contrato/painel1.types';

/**
 * Literal TypeScript do exemplo oficial (sociedade/central/painel-1.exemplo.json).
 * `satisfies Painel1` faz o tsc falhar se um campo obrigatório faltar ou tiver tipo errado;
 * o teste painelContrato.test.ts confere a igualdade com o JSON oficial.
 */
export const exemploOficialLiteral = {
  "esquema": "painel/1",
  "coletado_em": "2026-10-23T15:00:00Z",
  "maquina": "notebook-exemplo",
  "pacote": {
    "fonte_versao": "3.4.0",
    "instalacoes": [
      {"ferramenta": "claude", "versao": "3.4.0", "origem": "pacote-exemplo@a1b2c3d", "alteracao_local": false},
      {"ferramenta": "codex", "versao": "3.4.0", "origem": "pacote-exemplo@a1b2c3d", "alteracao_local": false},
      {"ferramenta": "antigravity", "versao": "3.3.0", "origem": null, "alteracao_local": true}
    ]
  },
  "cardapio": [
    {"plataforma": "Claude Code", "fornecedor": "Anthropic", "nivel": "alta", "modelo": "Claude Opus 5.5", "esforco": "high"},
    {"plataforma": "Claude Code", "fornecedor": "Anthropic", "nivel": "moderada", "modelo": "Claude Sonnet 5.5", "esforco": "medium"},
    {"plataforma": "Claude Code", "fornecedor": "Anthropic", "nivel": "simples", "modelo": "Claude Haiku 5.5", "esforco": "low"},
    {"plataforma": "Codex", "fornecedor": "OpenAI", "nivel": "alta", "modelo": "GPT-6-Astra", "esforco": "high"},
    {"plataforma": "Codex", "fornecedor": "OpenAI", "nivel": "moderada", "modelo": "GPT-6.1-Sol", "esforco": "medium"},
    {"plataforma": "Codex", "fornecedor": "OpenAI", "nivel": "simples", "modelo": "GPT-6-Luna", "esforco": "low"},
    {"plataforma": "Antigravity", "fornecedor": "Google", "nivel": "alta", "modelo": "Gemini 4 Argon", "esforco": "high"},
    {"plataforma": "Antigravity", "fornecedor": "Google", "nivel": "moderada", "modelo": "Gemini 3.8 Flash", "esforco": "medium"},
    {"plataforma": "Antigravity", "fornecedor": "Google", "nivel": "simples", "modelo": "Gemini 3.8 Flash", "esforco": "low"}
  ],
  "projetos": [
    {
      "id": "loja-exemplo",
      "nome": "Loja Exemplo",
      "envio_ligado": true,
      "pastas": [
        {"ferramenta": "claude", "caminho": "/home/dono/Projetos/loja-exemplo", "tipo": "canonica", "ramo": "main", "sha": "abc1234", "limpa": true},
        {"ferramenta": "codex", "caminho": "/home/dono/Projetos/loja-exemplo-codex", "tipo": "clone", "ramo": "main", "sha": "9f8e7d6", "limpa": false},
        {"ferramenta": "antigravity", "caminho": "/home/dono/.sociedade/trabalho/loja-exemplo/e3-carrinho", "tipo": "worktree", "ramo": "etapa/e3-carrinho", "sha": "1a2b3c4", "limpa": true}
      ],
      "nucleo": "3.4.0",
      "formato_registro": "2.1.0-cadeia",
      "etapas": [
        {
          "id": "e2-catalogo",
          "estacao": "encerrada",
          "decisao": "aceitar",
          "grau": "A",
          "interacoes": [],
          "passagens": []
        },
        {
          "id": "e3-carrinho",
          "estacao": "revisao",
          "decisao": null,
          "grau": null,
          "interacoes": [
            {
              "escala": {"papel": "arquiteto", "plataforma": "Claude Code", "fornecedor": "Anthropic", "modelo": "Claude Opus 5.5", "esforco": "high", "subagentes": {"simples": "Claude Haiku 5.5", "moderada": "Claude Sonnet 5.5"}},
              "inicio": "2026-10-22T13:10:00Z",
              "modelo_no_log": "Claude Opus 5.5",
              "avisos": []
            },
            {
              "escala": {"papel": "coordenador", "plataforma": "Antigravity", "fornecedor": "Google", "modelo": "Gemini 3.8 Flash", "esforco": "medium", "subagentes": {"simples": "Gemini 3.8 Flash", "moderada": "Gemini 3.8 Flash", "alta": "Gemini 4 Argon"}},
              "inicio": "2026-10-22T15:40:00Z",
              "modelo_no_log": "Gemini 3.8 Flash",
              "avisos": []
            },
            {
              "escala": {"papel": "revisor", "plataforma": "Codex", "fornecedor": "OpenAI", "modelo": "GPT-6.1-Sol", "esforco": "xhigh"},
              "inicio": "2026-10-23T10:05:00Z",
              "modelo_no_log": null,
              "avisos": ["modelo do log ainda não lido: conversa em andamento"]
            }
          ],
          "passagens": [
            {
              "de": "coordenador",
              "para": "arquiteto",
              "quando": "2026-10-22T18:20:00Z",
              "bloco": "Para: Círdan · De: Gandalf · Etapa: e3-carrinho\nSituação: portão aprovado no commit 1a2b3c4\nFeito: 3 fatias (carrinho, cupom, testes)\nPendente ou decisão: nenhuma\nPróximo passo: preparar a cópia de revisão\nDetalhe: sociedade/subordens/e3-carrinho-retorno.md"
            },
            {
              "de": "arquiteto",
              "para": "revisor",
              "quando": "2026-10-23T09:50:00Z",
              "bloco": "Para: Barbárvore · De: Círdan · Etapa: e3-carrinho\nSituação: cópia de revisão pronta\nFeito: candidato 1a2b3c4 sobre a base abc1234\nPendente ou decisão: revisão completa (protocolo de oito lentes)\nPróximo passo: emitir o parecer com hash\nDetalhe: sociedade/subordens/e3-carrinho-revisao.md"
            }
          ]
        }
      ],
      "pendencias": [
        {"tipo": "revisao_devida", "texto": "Revisão da e3-carrinho em andamento no Codex", "etapa": "e3-carrinho"},
        {"tipo": "troca_vencendo", "texto": "Coordenador temporário no Antigravity até 24/10", "etapa": null},
        {"tipo": "divergencia", "texto": "A pasta loja-exemplo-codex parece um clone da canônica; confirme no mapa de projetos", "etapa": null}
      ],
      "ajustes_metodo": [
        {"id": "LOJA-D-004", "estado": "em_avaliacao", "resumo": "Cupom de teste fixo nas fixtures de checkout"}
      ]
    },
    {
      "id": "app-receitas",
      "nome": "App Receitas",
      "envio_ligado": true,
      "pastas": [
        {"ferramenta": "claude", "caminho": "/home/dono/Projetos/app-receitas", "tipo": "canonica", "ramo": "main", "sha": "77aa88b", "limpa": true},
        {"ferramenta": "antigravity", "caminho": "/home/dono/Projetos/app-receitas", "tipo": "canonica", "ramo": "main", "sha": "77aa88b", "limpa": true}
      ],
      "nucleo": "3.1.0",
      "formato_registro": "2.1.0",
      "etapas": [
        {
          "id": "r1-busca",
          "estacao": "ordem",
          "decisao": null,
          "grau": null,
          "interacoes": [],
          "passagens": []
        }
      ],
      "pendencias": [
        {"tipo": "aprovar_ordem", "texto": "Ordem r1-busca escrita pelo Círdan; falta a sua aprovação", "etapa": "r1-busca"},
        {"tipo": "versao_defasada", "texto": "Núcleo 3.1.0 no projeto; a fonte está em 3.4.0", "etapa": null}
      ],
      "ajustes_metodo": [
        {"id": "RCT-D-003", "estado": "identificada", "resumo": "Revisão por lote nas etapas só de tela"}
      ]
    },
    {
      "id": "diario-campo",
      "nome": "Diário de Campo",
      "envio_ligado": false,
      "pastas": [
        {"ferramenta": "antigravity", "caminho": "/home/dono/Projetos/diario-campo", "tipo": "canonica", "ramo": null, "sha": null, "limpa": null}
      ],
      "nucleo": null,
      "formato_registro": "desconhecido",
      "etapas": [],
      "pendencias": []
    }
  ],
  "diagnosticos": [
    {"projeto": "diario-campo", "campo": "nucleo", "motivo": "AGENTS.md sem o bloco da Sociedade"},
    {"projeto": "diario-campo", "campo": "etapas", "motivo": "sociedade/registro.json ilegível (JSON inválido na linha 3)"},
    {"projeto": "diario-campo", "campo": "pastas[0].ramo", "motivo": "pasta sem repositório Git"},
    {"projeto": null, "campo": "pacote.instalacoes[2].origem", "motivo": "instalação do Antigravity sem registro de origem"}
  ]
} satisfies Painel1;
